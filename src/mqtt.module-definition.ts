import { ConfigurableModuleBuilder } from '@nestjs/common';
import { MqttModuleOptions } from './mqtt.interface';

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, ASYNC_OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<MqttModuleOptions>({ 'moduleName': 'MqttModule' })
    .setClassMethodName('forRoot')
    .build();