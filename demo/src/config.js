import { applyDeliveryPreset } from '../../library/runtime/deliveryPresets.js';
import { BASE_FEATURES, BASE_RUNTIME_CONFIG, BASE_SEARCH_CONFIG, BASE_STATIC_RENDER_CONFIG, BASE_SSR_CONFIG, PROTOCOL as BASE_PROTOCOL } from './config/base.js';
import { APP_PRESET } from './preset.js';

const config = applyDeliveryPreset({
  preset: APP_PRESET,
  appName: 'demo',
  baseFeatures: BASE_FEATURES,
  baseSearchConfig: BASE_SEARCH_CONFIG,
  baseStaticRenderConfig: BASE_STATIC_RENDER_CONFIG,
  baseSsrConfig: BASE_SSR_CONFIG,
  baseRuntimeConfig: BASE_RUNTIME_CONFIG,
  protocol: BASE_PROTOCOL
});

export { APP_PRESET };
export const FEATURES = config.FEATURES;
export const SEARCH_CONFIG = config.SEARCH_CONFIG;
export const APP_RUNTIME_CONFIG = config.APP_RUNTIME_CONFIG;
export const STATIC_RENDER_CONFIG = config.STATIC_RENDER_CONFIG;
export const SSR_CONFIG = config.SSR_CONFIG;
export const PROTOCOL = config.PROTOCOL;
