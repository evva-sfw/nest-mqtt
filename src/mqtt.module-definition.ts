import { ConfigurableModuleBuilder } from '@nestjs/common';
import { MqttModuleOptions } from './mqtt.interface';

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<MqttModuleOptions>().setClassMethodName('forRoot').build();