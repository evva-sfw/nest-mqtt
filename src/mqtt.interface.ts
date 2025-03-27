import { IClientOptions, MqttProtocol, Packet } from 'mqtt/*';

export interface MqttModuleOptions extends IClientOptions {
  /**
   * MQTT Broker host
   */
  host: string;
  /**
   * MQTT Broker port
   */
  port: number;
  /**
   * MQTT Broker protocol
   */
  protocol: MqttProtocol;
  /**
   * MQTT username
   */
  username: string;
  /**
   * Mqtt password
   */
  password?: string;

  /**
   * Mqtt password provider; may be used to obtain a password.
   * Will be called upon reconnect.
   * @returns
   */
  passwordProvider?: () => Promise<string>;

  /**
   * Mqtt topic resolver; may be used to resolve a topic variable
   * at runtime. Will be called on explore/processing decorators.
   * @returns the value as {string}.
   */
  topicResolver?: (varname: string) => string;

  /**
   * Global queue subscribe.
   * All topic will be prepend '$queue/' prefix automatically.
   * More information is here:
   * https://docs.emqx.io/broker/latest/cn/advanced/shared-subscriptions.html
   */
  queue?: boolean;

  /**
   * Global shared subscribe.
   * All topic will be prepend '$share/group/' prefix automatically.
   * More information is here:
   * https://docs.emqx.io/broker/latest/cn/advanced/shared-subscriptions.html
   */
  share?: string;

  topic?: string;
  beforeHandle?: (topic: string, payload: Buffer, packet: Packet) => any;
}

export type MqttMessageTransformer = (payload: Buffer) => any;

export interface MqttSubscribeOptions {
  topic: string | string[];
  queue?: boolean;
  share?: string;
  transform?: 'json' | 'text' | MqttMessageTransformer;
}

export interface MqttSubscriberParameter {
  index: number;
  type: 'payload' | 'topic' | 'packet' | 'params';
  transform?: 'json' | 'text' | MqttMessageTransformer;
}

export interface MqttSubscriber {
  topic: string;
  handle: any;
  route: string;
  provider: any;
  regexp: RegExp;
  options: MqttSubscribeOptions;
  parameters: MqttSubscriberParameter[];
}

export { MqttProtocol };
