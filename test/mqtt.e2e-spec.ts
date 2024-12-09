import { Test, TestingModule } from '@nestjs/testing';
import { MqttModule } from '../src/mqtt.module';
import Aedes, { AedesOptions } from 'aedes';
import { createServer } from 'net';
import { MqttModuleOptions } from '../src/mqtt.interface';

import { EventEmitter2, EventEmitterModule, OnEvent } from '@nestjs/event-emitter';
import { BrokerService } from './test.broker.service';
import { MQTT_RECEIVE_EVENT, MQTT_SEND_EVENT, TEST_TOPIC } from './test.constants';
import { DiscoveryModule } from '@nestjs/core';

describe('MQTT Module (e2e)', () => {
  const aedesServer = new Aedes({} as AedesOptions);
  const server = createServer(aedesServer.handle);
  const mqttHost = '127.0.0.1';
  const mqttProtocol = 'mqtt';
  const mqttPort = 1883;
  const mqttUser = 'test';
  const mqttPassword = 'test'
  let moduleFixture: TestingModule;
  let brokerService, eventEmitter;

  aedesServer.authenticate = function (client, username, password, callback) {
    callback(null, username === mqttUser && password.equals(Buffer.from(mqttPassword, 'utf8')));
  }//authenticate

  function providePassword(): Promise<string> {
    return Promise.resolve(mqttPassword);
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
            }) as MqttModuleOptions,
        })
      ],
      providers: [BrokerService]
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
    const testMsg = {'blubb':'blubb'};
    let asyncEvent = new Promise<{topic: string, payload: any}>((resolve, reject) => {
      eventEmitter.on(MQTT_RECEIVE_EVENT, function (topic, payload) {
        resolve({topic, payload} as {topic: string, payload: any});
      }.bind(this));
    });
    eventEmitter.emit(MQTT_SEND_EVENT, testMsg)
    const event = await asyncEvent;
    expect(event.topic).toEqual(TEST_TOPIC);
    expect(event.payload).toEqual(testMsg);
  });
});
