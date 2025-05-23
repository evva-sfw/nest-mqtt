# Nest MQTT

[![NPM Version](https://img.shields.io/npm/v/%40evva%2Fnest-mqtt)](https://www.npmjs.com/package/@evva/nest-mqtt)
[![NPM Downloads](https://img.shields.io/npm/dy/%40evva%2Fnest-mqtt)](https://www.npmjs.com/package/@evva/nest-mqtt)
![NPM Unpacked Size (with version)](https://img.shields.io/npm/unpacked-size/%40evva%2Fnest-mqtt/latest)
![GitHub last commit](https://img.shields.io/github/last-commit/evva-sfw/nest-mqtt)
[![GitHub branch check runs](https://img.shields.io/github/check-runs/evva-sfw/nest-mqtt/main)]([URL](https://github.com/evva-sfw/nest-mqtt/actions))
[![EVVA License](https://img.shields.io/badge/license-EVVA_License-yellow.svg?color=fce500&logo=data:image/svg+xml;base64,PCEtLSBHZW5lcmF0ZWQgYnkgSWNvTW9vbi5pbyAtLT4KPHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IjY0MCIgaGVpZ2h0PSIxMDI0IiB2aWV3Qm94PSIwIDAgNjQwIDEwMjQiPgo8ZyBpZD0iaWNvbW9vbi1pZ25vcmUiPgo8L2c+CjxwYXRoIGZpbGw9IiNmY2U1MDAiIGQ9Ik02MjIuNDIzIDUxMS40NDhsLTMzMS43NDYtNDY0LjU1MmgtMjg4LjE1N2wzMjkuODI1IDQ2NC41NTItMzI5LjgyNSA0NjYuNjY0aDI3NS42MTJ6Ij48L3BhdGg+Cjwvc3ZnPgo=)](LICENSE)

## Install

`npm i @evva/nest-mqtt`

## Description

Client implementation for an MQTT Broker that also supports shared subscriptions.
Offers additional decorators to simply usage.

## Build & Package
```bash
# Nest Build
$ nest build
```

## Usage

Import the module wherever needed and inject the `MqttService` into your service for use.

```ts
@Module({
  imports: [MqttModule],
})
export class ExampleModule {
  constructor(private readonly mqttService: MqttService) {}
  
  public async example() {
    try {
      await this.mqttService.connect({
        host: '127.0.0.1',
        protocol: 'mqtt',
        port: 1883,
        username: 'test',
        password: 'test',
        autoSubscribe: true
      })
    } catch (e) {
      console.log(`Failed to connect: ${e}`)
    }
  }

  @Subscribe('exampleTopic')
  public onExampleTopicEvent(@Payload() payload: object) {
    console.log(payload)
  }
}
```
> Tip: Use the `autoSubscribe` flag to automatically explore and subscribe to configured topics.

## Stay in touch

- Author - microud/nest-mqtt
- Author - sfw-e

## License

Proprietary
