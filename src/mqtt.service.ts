import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MQTT_CLIENT_INSTANCE } from './mqtt.constants';
import {
  MqttClient,
  Packet,
  IClientPublishOptions,
  IClientSubscribeOptions,
  ISubscriptionGrant,
} from 'mqtt';
import { MODULE_OPTIONS_TOKEN } from './mqtt.module-definition';
import { MqttModuleOptions } from './mqtt.interface';
import { connect } from 'mqtt';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('MqttService');
  private client: MqttClient;
  constructor(
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: MqttModuleOptions,
  ) {
  }

  async connect() {
    // Use password provider to obtain password
    if (this.options.passwordProvider) {
      this.options.password = await this.options.passwordProvider();
    }
    this.client = connect(this.options);
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
  }

  subscribe(
    topic: string | string[],
    opts?: IClientSubscribeOptions,
  ): Promise<ISubscriptionGrant[]> {
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

  async onModuleInit() {
    await this.connect();
  }

  onModuleDestroy() {
    try {
      if (this.client && this.client.connected) {
        this.client.end(true);
      }
    } catch (e) {
      this.logger.error(e);
    }
  }
}
