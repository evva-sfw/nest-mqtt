import { MqttMessageTransformer } from './mqtt.interface';

export const JsonTransform: MqttMessageTransformer = (payload) => {
  return JSON.parse(payload.toString('utf-8'));
};

export const TextTransform: MqttMessageTransformer = (payload) => {
  return payload.toString('utf-8');
};

export const RawTransform: MqttMessageTransformer = (payload) => {
  return payload;
};

export function getTransform(
  transform: 'json' | 'text' | 'raw' | MqttMessageTransformer = 'json',
) {
  if (typeof transform === 'function') {
    return transform;
  }
  switch (transform) {
    case 'text':
      return TextTransform;
    case 'json':
      return JsonTransform;
    case 'raw':
      return RawTransform;
  }
}
