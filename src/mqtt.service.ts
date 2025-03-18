import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  MqttClient,
  Packet,
  IClientPublishOptions,
  IClientSubscribeOptions,
  ISubscriptionGrant,
  connectAsync,
} from 'mqtt';
import { MODULE_OPTIONS_TOKEN } from './mqtt.module-definition';
import { MqttModuleOptions, MqttSubscribeOptions, MqttSubscriber, MqttSubscriberParameter } from './mqtt.interface';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { MQTT_SUBSCRIBE_OPTIONS, MQTT_SUBSCRIBER_PARAMS, TOPIC_VAR_REGEX } from './mqtt.constants';
import { getTransform } from './mqtt.transform';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('MqttService');
  private client: MqttClient;
  private readonly reflector = new Reflector();
  private subscribers: MqttSubscriber[];
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: MqttModuleOptions,
  ) {
    this.subscribers = [];
  }

  getClient(): MqttClient {
    return this.client;
  }

  async connect() {
    // Use password provider to obtain password
    if (this.options.passwordProvider) {
      this.options.password = await this.options.passwordProvider();
    }
    this.client = await connectAsync(this.options);
    this.client.on('connect', () => {
      this.logger.log('MQTT connected');
    });

    this.client.on('disconnect', packet => {
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

    this.logger.log('MqttService::connected');
  }

  subscribe(
    topic: string | string[],
    opts?: IClientSubscribeOptions,
  ): Promise<ISubscriptionGrant[]> {
    this.logger.log(`subscribe ${topic}`)
    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, opts || null, (err, granted) => {
        if (err) {
          reject(err);
        } else {
          resolve(granted);
        }
      });
    });
  }

  unsubscribe(topic: string, opts?: IClientSubscribeOptions): Promise<Packet> {
    return new Promise<Packet>((resolve, reject) => {
      this.client.unsubscribe(topic, opts || null, (error, packet) => {
        if (error) {
          reject(error);
        } else {
          resolve(packet);
        }
      });
    });
  }

  publish(
    topic: string,
    message: string | Buffer | object,
    opts?: IClientPublishOptions,
  ): Promise<Packet> {
    return new Promise<Packet>((resolve, reject) => {
      if (typeof message === 'object') {
        message = JSON.stringify(message);
      }
      this.client.publish(topic, message, opts || null, (error, packet) => {
        if (error) {
          reject(error);
        } else {
          resolve(packet);
        }
      });
    });
  }

  /**
   * Explorer parts
   */
  preprocess(subscribeOptions: MqttSubscribeOptions): string | string[] {
    const topicResolver = this.options.topicResolver;

    const processTopic = (topic) => {
      const queue =
        typeof subscribeOptions.queue === 'boolean' ? subscribeOptions.queue : this.options.queue;
      const share =
        typeof subscribeOptions.share === 'string' ? subscribeOptions.share : this.options.share;
      topic = topic
        .replace('$queue/', '')
        .replace(/^\$share\/([A-Za-z0-9]+)\//, '');

      if (topicResolver) {
        topic = topic.replace(TOPIC_VAR_REGEX, (match: string, varname: string) => topicResolver(varname));
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
      this.logger.log(this.options.topic);
      return processTopic(subscribeOptions.topic);
    }
  }// preprocess

  _subscribe(
    options: MqttSubscribeOptions,
    parameters: MqttSubscriberParameter[],
    handle,
    provider,
  ) {
    const topicResolver = this.options.topicResolver;
    const topic = this.preprocess(options);
    this.client.subscribe(topic, (err) => {
      if (!err) {
        // put it into this.subscribers;
        if (!Array.isArray(options.topic)) {
          const topics = new Array<string>();
          const topicToPush = (options.topic.search(TOPIC_VAR_REGEX) > -1)? topic as string: options.topic;
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
      } else {
        this.logger.error(`subscribe topic [${options.topic} failed]`);
      }

    });
  }// _subscribe

  explore() {
    const providers: InstanceWrapper[] = this.discoveryService.getProviders();
    providers.forEach((wrapper: InstanceWrapper) => {
      const { instance } = wrapper;
      if (!instance) {
        return;
      }
      this.metadataScanner.scanFromPrototype(
        instance,
        Object.getPrototypeOf(instance),
        (key) => {
          const subscribeOptions: MqttSubscribeOptions = this.reflector.get(
            MQTT_SUBSCRIBE_OPTIONS,
            instance[key],
          );
          const parameters = this.reflector.get(
            MQTT_SUBSCRIBER_PARAMS,
            instance[key],
          );
          if (subscribeOptions) {
            this._subscribe(
              subscribeOptions,
              parameters,
              instance[key],
              instance,
            );
          }
        },
      );
    });
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

            // add a option to do something before handle message.
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
  }

  private getSubscriber(topic: string): MqttSubscriber | null {
    for (const subscriber of this.subscribers) {
      subscriber.regexp.lastIndex = 0;
      if (subscriber.regexp.test(topic)) {
        return subscriber;
      }
    }
    return null;
  }

  private static topicToRegexp(topic: string) {
    // compatible with emqtt
    return new RegExp(
      '^' +
      topic
        .replace('$queue/', '')
        .replace(/^\$share\/([A-Za-z0-9]+)\//, '')
        .replace(/([\[\]\?\(\)\\\\$\^\*\.|])/g, '\\$1')
        .replace(/\+/g, '([^/]+)')
        .replace(/\/#$/, '(/.*)?') +
      '$',
      'y',
    );
  }

  private static matchGroups(str: string, regex: RegExp) {
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


  async onModuleInit() {
    await this.connect();
    this.logger.log('onModuleInit::connected::explore');
    this.explore();
  }

  async onModuleDestroy() {
    try {
      await this.client.endAsync(true);
    } catch (e) {
      this.logger.error(e);
    }
  }
}
