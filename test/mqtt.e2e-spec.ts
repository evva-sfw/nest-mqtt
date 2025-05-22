import { Test, TestingModule } from '@nestjs/testing';
import Aedes, { AedesOptions } from 'aedes';
import { createServer } from 'net';
import { MqttModule } from '../src';
import {
  EventEmitter2,
  EventEmitterModule,
} from '@nestjs/event-emitter';
import { BrokerService } from './test.broker.service';
import {
  MQTT_RECEIVE_EVENT,
  MQTT_SEND_EVENT,
  MQTT_SEND_VARIABLE_EVENT,
  TEST_TOPIC,
  VARIABLE_TEST_TOPIC_RESULT,
  VARIABLE_TEST_TOPIC_VERSION,
} from './test.constants';
import { DiscoveryModule } from '@nestjs/core';
import { MqttService } from '../src';

describe('MQTT Module (e2e)', () => {
  const aedesServer = new Aedes({} as AedesOptions);
  const server = createServer(aedesServer.handle);
  const mqttHost = '127.0.0.1';
  const mqttProtocol = 'mqtt';
  const mqttPort = 1883;
  const mqttUser = 'test';
  const mqttPassword = 'test';

  let moduleFixture: TestingModule;
  let eventEmitter: EventEmitter2;
  let mqttService: MqttService;

  aedesServer.authenticate = (client, username, password, callback) => {
    callback(
      null,
      username === mqttUser &&
        password.equals(Buffer.from(mqttPassword, 'utf8')),
    );
  }; // authenticate

  function providePassword(): Promise<string> {
    return Promise.resolve(mqttPassword);
  }

  function resolveTopic(varname: string): string {
    if (varname === 'version') {
      return VARIABLE_TEST_TOPIC_VERSION;
    }
  }

  beforeAll(async () => {
    server.listen(mqttPort);

    moduleFixture = await Test.createTestingModule({
      imports: [
        DiscoveryModule,
        EventEmitterModule.forRoot(),
        MqttModule
      ],
      providers: [BrokerService],
    }).compile();

    await moduleFixture.init();

    eventEmitter = await moduleFixture.resolve(EventEmitter2);
    mqttService = await moduleFixture.resolve(MqttService);

    await mqttService.connect({
      host: mqttHost,
      port: mqttPort,
      protocol: mqttProtocol,
      username: mqttUser,
      rejectUnauthorized: false,
      autoSubscribe: true,
      passwordProvider: providePassword,
      topicResolver: resolveTopic,
    })
  });

  afterAll(async () => {
    await mqttService.disconnect();
    await moduleFixture.close();
    aedesServer.close();
    server.close();
  });

  it('test publish/subscribe', async () => {
    const testMsg = { blubb: 'blubb' };
    const asyncEvent = new Promise<{ topic: string; payload: any }>(
      (resolve, reject) => {
        eventEmitter.on(MQTT_RECEIVE_EVENT, (topic, payload) => {
          resolve({ topic, payload } as { topic: string; payload: any });
        });
      },
    );
    eventEmitter.emit(MQTT_SEND_EVENT, testMsg);
    const event = await asyncEvent;
    expect(event.topic).toEqual(TEST_TOPIC);
    expect(event.payload).toEqual(testMsg);
  });

  it('test variable subscribe', async () => {
    const testMsg = { blubb2: 'blubb2' };
    const asyncEvent = new Promise<{ topic: string; payload: any }>(
      (resolve, reject) => {
        eventEmitter.on(MQTT_RECEIVE_EVENT, (topic, payload) => {
          resolve({ topic, payload } as { topic: string; payload: any });
        });
      },
    );
    eventEmitter.emit(MQTT_SEND_VARIABLE_EVENT, testMsg);
    const event = await asyncEvent;
    expect(event.topic).toEqual(VARIABLE_TEST_TOPIC_RESULT);
    expect(event.payload).toEqual(testMsg);
  });
});
