import { Injectable, Logger, } from '@nestjs/common';
import {
  MqttClient,
  Packet,
  IClientPublishOptions,
  IClientSubscribeOptions,
  ISubscriptionGrant,
  connectAsync,
} from 'mqtt';
import {
  MqttConnectOptions,
  MqttSubscribeOptions,
  MqttSubscriber,
  MqttSubscriberParameter,
} from './mqtt.interface';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import {
  MAX_VAR_TOPIC_LENGTH,
  MQTT_SUBSCRIBE_OPTIONS,
  MQTT_SUBSCRIBER_PARAMS,
  TOPIC_VAR_REGEX,
} from './mqtt.constants';
import { getTransform } from './mqtt.transform';

@Injectable()
export class MqttService {
  private readonly logger = new Logger('MqttService');
  private readonly reflector = new Reflector();
  private readonly subscribers: MqttSubscriber[];

  private client?: MqttClient;
  private options?: MqttConnectOptions;

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {
    this.subscribers = [];
  }

  /**
   * Getter for the underlying MQTT client.
   *
   * @returns {MqttClient | undefined}
   */
  getClient(): MqttClient | undefined {
    return this.client;
  }

  /**
   * Connect to the configured MQTT broker.
   *
   * @param {MqttConnectOptions} options
   * @throws
   */
  async connect(options: MqttConnectOptions) {
    this.options = options

    // Use password provider to obtain password
    if (this.options.passwordProvider) {
      this.options.password = await this.options.passwordProvider();
    }

    this.client = await connectAsync(this.options);

    this.client.on('connect', () => {
      this.logger.log('MQTT connected');
    });
    this.client.on('disconnect', () => {
      this.logger.log('MQTT disconnected');
    });
    this.client.on('error', (error) => {
      this.logger.log('MQTT error', error);
    });
    this.client.on('reconnect', async () => {
      this.logger.log('MQTT reconnecting');
      if (this.options.passwordProvider) {
        this.logger.log('Updating password');
        this.options.password = await this.options.passwordProvider();
      }
    });
    this.client.on('close', () => {
      this.logger.log('MQTT closed');
    });
    this.client.on('offline', () => {
      this.logger.log('MQTT offline');
    });
    this.logger.log(`Connected to ${this.options.host}:${this.options.port}`);

    if (options.autoSubscribe === true) {
      await this.explore();
    }
  }

  /**
   * Disconnect from the MQTT broker.
   *
   * @throws
   */
  async disconnect() {
    await this.client?.endAsync(true);
  }

  /**
   * Subscribe to the given topic with options.
   *
   * @param {string | string[]} topic
   * @param {IClientSubscribeOptions} opts
   * @returns {ISubscriptionGrant[]}
   * @throws
   */
  async subscribe(
    topic: string | string[],
    opts?: IClientSubscribeOptions,
  ): Promise<ISubscriptionGrant[]> {
    const result = await this.client.subscribeAsync(topic, opts || null);
    this.logger.log(`Subscribed to topic {${topic}}`);

    return result;
  }

  /**
   * Unsubscribes from the given topic with options.
   *
   * @param {string} topic
   * @param {IClientSubscribeOptions} opts
   * @returns {Packet}
   * @throws
   */
  async unsubscribe(
    topic: string,
    opts?: IClientSubscribeOptions,
  ): Promise<Packet> {
    const result = await this.client.unsubscribeAsync(topic, opts || null);
    this.logger.log(`Unsubscribed from topic {${topic}}`);

    return result;
  }

  /**
   * Publishes the given message to the given topic.
   *
   * @param {string} topic
   * @param {string | Buffer | object} message
   * @param {IClientPublishOptions} opts
   * @returns {Packet}
   * @throws
   */
  async publish(
    topic: string,
    message: string | Buffer | object,
    opts?: IClientPublishOptions,
  ): Promise<Packet> {
    if (typeof message === 'object') {
      message = JSON.stringify(message);
    }
    const result = await this.client.publishAsync(topic, message, opts || null);
    this.logger.log(`Published message to topic {${topic}}`);

    return result;
  }

  /**
   * Explores topics to be subscribed to.
   *
   * @throws
   */
  async explore() {
    let counter = 0;
    this.client.on(
      'message',
      (topic: string, payload: Buffer, packet: Packet) => {
        const subscriber = this.getSubscriber(topic);
        if (subscriber) {
          const parameters = subscriber.parameters || [];
          const scatterParameters: MqttSubscriberParameter[] = [];
          for (const parameter of parameters) {
            scatterParameters[parameter.index] = parameter;
          }
          try {
            const transform = getTransform(subscriber.options.transform);

            // add an option to do something before handle message.
            if (this.options.beforeHandle) {
              this.options.beforeHandle(topic, payload, packet);
            }
            subscriber.handle.bind(subscriber.provider)(
              ...scatterParameters.map((parameter) => {
                switch (parameter?.type) {
                  case 'payload':
                    return transform(payload);
                  case 'topic':
                    return topic;
                  case 'packet':
                    return packet;
                  case 'params':
                    return MqttService.matchGroups(topic, subscriber.regexp);
                  default:
                    return null;
                }
              }),
            );
          } catch (err) {
            this.logger.error(err);
          }
        }
      },
    );
    this.logger.log(`Registered handler for incoming messages`);
    const providers: InstanceWrapper[] = this.discoveryService.getProviders();
    for (const provider of providers) {
      const { instance } = provider;
      if (!instance) {
        continue;
      }
      const keys = this.metadataScanner.getAllMethodNames(
        Object.getPrototypeOf(instance),
      );
      for (const key of keys) {
        const subscribeOptions: MqttSubscribeOptions = this.reflector.get(
          MQTT_SUBSCRIBE_OPTIONS,
          instance[key],
        );
        const parameters = this.reflector.get(
          MQTT_SUBSCRIBER_PARAMS,
          instance[key],
        );
        if (subscribeOptions) {
          await this._subscribe(
            subscribeOptions,
            parameters,
            instance[key],
            instance,
          );
          counter++;
        }
      }
    }
    this.logger.log(`Explored ${counter} topics`);
  }

  /**
   * Preprocesses the topic by replacing or resolving vars.
   *
   * @param {MqttSubscribeOptions} subscribeOptions
   * @returns {string | string[]}
   * @private
   */
  private preprocess(
    subscribeOptions: MqttSubscribeOptions,
  ): string | string[] {
    const topicResolver = this.options.topicResolver;

    const processTopic = (topic: string) => {
      const queue =
        typeof subscribeOptions.queue === 'boolean'
          ? subscribeOptions.queue
          : this.options.queue;
      const share =
        typeof subscribeOptions.share === 'string'
          ? subscribeOptions.share
          : this.options.share;
      topic = topic
        .replace('$queue/', '')
        .replace(/^\$share\/([A-Za-z0-9]+)\//, '');

      if (topicResolver && topic.length < MAX_VAR_TOPIC_LENGTH) {
        topic = topic.replace(
          TOPIC_VAR_REGEX,
          (match: string, varname: string) => topicResolver(varname),
        );
      }

      if (queue) {
        return `$queue/${topic}`;
      }

      if (share) {
        return `$share/${share}/${topic}`;
      }

      return topic;
    };
    if (Array.isArray(subscribeOptions.topic)) {
      return subscribeOptions.topic.map(processTopic);
    } else {
      return processTopic(subscribeOptions.topic);
    }
  }

  /**
   * Subscribe helper that subscribes and populates the local
   * subscribers list.
   *
   * @param {MqttSubscribeOptions} options
   * @param {MqttSubscriberParameter[]} parameters
   * @param {any }handle
   * @param {any} provider
   * @private
   */
  private async _subscribe(
    options: MqttSubscribeOptions,
    parameters: MqttSubscriberParameter[],
    handle: any,
    provider: any,
  ) {
    const topic = this.preprocess(options);
    try {
      if (!Array.isArray(options.topic)) {
        const topics = new Array<string>();
        const topicToPush =
          options.topic.length < MAX_VAR_TOPIC_LENGTH &&
          options.topic.search(TOPIC_VAR_REGEX) > -1
            ? (topic as string)
            : options.topic;
        topics.push(topicToPush);
        options.topic = topics;
      }
      options.topic.forEach((aTopic) => {
        this.subscribers.push({
          topic: aTopic,
          route: aTopic
            .replace('$queue/', '')
            .replace(/^\$share\/([A-Za-z0-9]+)\//, ''),
          regexp: MqttService.topicToRegexp(aTopic),
          provider,
          handle,
          options,
          parameters,
        });
      });
      await this.client.subscribeAsync(topic);
      this.logger.log(`Subscribed to topic {${topic}}`);
    } catch (err) {
      this.logger.error(`Failed to subscribe to topic {${options.topic}}`);
    }
  }

  /**
   * Returns a potential subscriber in the local list.
   *
   * @param {string} topic
   * @returns {MqttSubscriber | null}
   * @private
   */
  private getSubscriber(topic: string): MqttSubscriber | null {
    for (const subscriber of this.subscribers) {
      subscriber.regexp.lastIndex = 0;
      if (subscriber.regexp.test(topic)) {
        return subscriber;
      }
    }
    return null;
  }

  /**
   * Returns a prepared RegExp for the given topic.
   *
   * @param {string} topic
   * @returns {RegExp}
   * @private
   */
  private static topicToRegexp(topic: string): RegExp {
    // Compatible with emqtt
    return new RegExp(
      '^' +
        topic
          .replace('$queue/', '')
          .replace(/^\$share\/([A-Za-z0-9]+)\//, '')
          .replace(/([\[\]?()\\$^*.|])/g, '\\$1')
          .replace(/\+/g, '([^/]+)')
          .replace(/\/#$/, '(/.*)?') +
        '$',
      'y',
    );
  }

  /**
   * Returns matches for the given string and RegExp.
   *
   * @param {string} str
   * @param {RegExp} regex
   * @returns {string[]}
   * @private
   */
  private static matchGroups(str: string, regex: RegExp): string[] {
    regex.lastIndex = 0;
    let m = regex.exec(str);
    const matches: string[] = [];

    while (m !== null) {
      // This is necessary to avoid infinite loops with zero-width matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }

      // The result can be accessed through the `m`-variable.
      m.forEach((match, groupIndex) => {
        if (groupIndex !== 0) {
          matches.push(match);
        }
      });
      m = regex.exec(str);
    }
    return matches;
  }
}
