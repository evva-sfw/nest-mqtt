import { Test, TestingModule } from '@nestjs/testing';
import { MqttModule } from '../src/mqtt.module';
import Aedes, { AedesOptions } from 'aedes';
import { createServer } from 'net';
import { MqttModuleOptions } from '../src/mqtt.interface';

import {
  EventEmitter2,
  EventEmitterModule,
  OnEvent,
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
import { readFileSync } from 'node:fs';

describe('MQTT Module (e2e)', () => {
  const aedesServer = new Aedes({} as AedesOptions);
  const server = createServer(aedesServer.handle);
  const mqttHost = '127.0.0.1';
  const mqttProtocol = 'mqtt';
  const mqttPort = 1883;
  const mqttUser = 'test';
  const mqttPassword = 'test';
  let moduleFixture: TestingModule;
  let brokerService;
  let eventEmitter;

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
        MqttModule.forRootAsync({
          useFactory: async () =>
            ({
              host: mqttHost,
              port: mqttPort,
              protocol: mqttProtocol,
              username: mqttUser,
              passwordProvider: providePassword,
              topicResolver: resolveTopic,
              rejectUnauthorized: false,
            }) as MqttModuleOptions,
        }),
      ],
      providers: [BrokerService],
    }).compile();
    await moduleFixture.init();
    eventEmitter = await moduleFixture.resolve(EventEmitter2);
    brokerService = await moduleFixture.resolve(BrokerService);
  });

  afterAll(async () => {
    moduleFixture.close();
    server.close();
    aedesServer.close();
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
    eventEmitter.emitAsync(MQTT_SEND_VARIABLE_EVENT, testMsg);
    const event = await asyncEvent;
    expect(event.topic).toEqual(VARIABLE_TEST_TOPIC_RESULT);
    expect(event.payload).toEqual(testMsg);
  });
});
