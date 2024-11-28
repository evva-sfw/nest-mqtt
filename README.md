## Description

Client implementation for an MQTT Broker that also supports shared subscriptions.
Offers additional decorators to simply usage.

## Build & Package
```bash
# Nest Build
$ nest build
```

## Usage

```
  MqttModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        ({
          host: configService.get<string>(BROKER_HOST),
          port: configService.get<Number>(BROKER_PORT, {'infer': true}),
          protocol: configService.get<string>(BROKER_PROTOCOL),
          username: configService.get<string>(BROKER_CLIENT_USER),
          password: configService.get<string>(
            BROKER_CLIENT_PASSWORD,
          ),
          share: configService.get<string>(BROKER_SHARED_PREFIX),
        }) as MqttModuleOptions,
    }),
```

When using the ConfigService, make sure that the variables are loaded before accessing them.
This usually works as follows:
```
export class MyModule implements OnModuleInit {
  
  
  async onModuleInit() {
    await ConfigModule.envVariablesLoaded;
  }
}
```

## Support

## Stay in touch

- Author - microud/nest-mqtt
- Author - sfw-e

## License

Proprietary
