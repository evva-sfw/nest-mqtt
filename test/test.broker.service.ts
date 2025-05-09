import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { MqttService, Payload, Subscribe, Topic } from '../src';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  MQTT_RECEIVE_EVENT,
  MQTT_SEND_EVENT,
  MQTT_SEND_VARIABLE_EVENT,
  TEST_TOPIC,
  VARIABLE_TEST_TOPIC,
  VARIABLE_TEST_TOPIC_RESULT,
} from './test.constants';

@Injectable()
export class BrokerService {
  constructor(
    @Inject(MqttService) private readonly mqttService: MqttService,
    @Inject(EventEmitter2) private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Subscribes to the incoming request topic and emits internal events.
   * @param topic {string} - the topic
   * @param payload {any} - the payload object in the request
   */
  @Subscribe(TEST_TOPIC)
  async handleSubscribed(
    @Topic() topic: string,
    @Payload()
    payload: any,
  ) {
    this.eventEmitter.emit(MQTT_RECEIVE_EVENT, topic, payload);
  }

  /**
   * Subscribes to the incoming request topic and emits internal events.
   * @param topic {string} - the topic
   * @param payload {any} - the payload object in the request
   */
  @Subscribe(VARIABLE_TEST_TOPIC)
  async handleSubscribedVariable(
    @Topic() topic: string,
    @Payload()
    payload: any,
  ) {
    this.eventEmitter.emit(MQTT_RECEIVE_EVENT, topic, payload);
  }

  /**
   * Publishes to the broker
   * @param notification {MobileRegistrationRequested} - the notification.
   */
  @OnEvent(MQTT_SEND_EVENT)
  async handlePublish(notification: any) {
    await this.mqttService.publish(TEST_TOPIC, JSON.stringify(notification), {
      qos: 2,
    });
  }

  /**
   * Publishes to the broker
   * @param notification {MobileRegistrationRequested} - the notification.
   */
  @OnEvent(MQTT_SEND_VARIABLE_EVENT)
  async handlePublishVariable(notification: any) {
    await this.mqttService.publish(
      VARIABLE_TEST_TOPIC_RESULT,
      JSON.stringify(notification),
      { qos: 2 },
    );
  }
}
