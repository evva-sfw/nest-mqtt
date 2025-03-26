import { Global, Module } from '@nestjs/common';
import { MqttService } from './mqtt.service';
import {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
} from './mqtt.module-definition';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';

@Global()
@Module({
  providers: [MqttService, DiscoveryService],
  imports: [DiscoveryModule],
  exports: [MqttService, MODULE_OPTIONS_TOKEN],
})
export class MqttModule extends ConfigurableModuleClass {}
