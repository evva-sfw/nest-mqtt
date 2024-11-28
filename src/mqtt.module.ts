import {
  Global,
  Module,
} from '@nestjs/common';
import { MqttService } from './mqtt.service';
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } from './mqtt.module-definition';

@Global()
@Module({
  providers: [MqttService],
  exports: [MqttService, MODULE_OPTIONS_TOKEN],
})
export class MqttModule extends ConfigurableModuleClass {

}
