import { Global, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';

@Global()
@Module({
  providers: [MqttService, DiscoveryService],
  imports: [DiscoveryModule],
  exports: [MqttService],
})
export class MqttModule {}
