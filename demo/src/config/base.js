import { platformCapabilities } from '../utils/platform.js';

export const BASE_FEATURES = Object.freeze({
  VALIDATION: true,
  EVENT_BUS: true,
  SERVICE_MANAGER: true,
  PWA: false,
  CLIENT_NAVIGATION: false,
  I18N: false,
  INDEXEDDB: false,
  LLM_INSTRUCTOR: false,
  CACHE_MANAGER: true,
  DATA_AGGREGATOR: true,
  API_WRAPPER: true,
  AUTH_SERVICE: true,
  FORM_VALIDATOR: false,
  FORM_MANAGEMENT: true,
  MODAL_SYSTEM: true,
  AUTH_UI_MODULE: false,
  CHECKOUT_MODULE: true,
  HMAC_INTEGRITY: false,
  DATA_TABLE_MODULE: false,
  SEARCH_MODULE: false,
  ANALYTICS_CONSENT: true,
  ANALYTICS_MODULE: true,
  AI_MODULE: false,
  MEDIA_CAPTURE: false,
  CAMERA_MODULE: false,
  LOCATION_MODULE: false,
  MEDIA_TRANSFORM: false,
  IMAGE_OPTIMIZER: false,
  NETWORK_STATUS_MODULE: true,
  SYNC_QUEUE: true,
  OPTIMISTIC_SYNC: true,
  LOG_ACCUMULATOR: true,
  META_MANAGER: true,
  THREAD_MANAGER: false,
  FILE_SYSTEM: platformCapabilities.fileSystem(),
  CAMERA: platformCapabilities.camera(),
  NOTIFICATIONS: platformCapabilities.notifications(),
  SERVICE_WORKER: platformCapabilities.serviceWorker(),
  GEOLOCATION: platformCapabilities.geolocation(),
  VIBRATION: platformCapabilities.vibration()
});

export const BASE_SEARCH_CONFIG = Object.freeze({
  tier: 'core',
  maxResults: 20,
  minQueryLength: 2
});

export const BASE_STATIC_RENDER_CONFIG = Object.freeze({
  outDir: 'dist-static/demo',
  pagesModule: './render.pages.js',
  payloadScriptId: 'csma-render-bootstrap'
});

export const BASE_SSR_CONFIG = Object.freeze({
  pagesModule: './render.pages.js',
  publicAssetsDir: 'dist-ssr/demo',
  payloadScriptId: 'csma-render-bootstrap',
  ssmaBaseUrl: '',
  site: 'default',
  port: 8787
});

export const PROTOCOL = Object.freeze({
  subprotocol: '1.0.0'
});

export const BASE_RUNTIME_CONFIG = Object.freeze({
  search: BASE_SEARCH_CONFIG,
  protocol: PROTOCOL,
  ssma: {
    baseUrl: ''
  },
  optimisticSync: {
    wsEndpoint: '',
    eventsEndpoint: '',
    allowGuestCheckout: false
  },
  checkout: {},
  ai: {},
  analytics: {},
  clientNavigation: {
    enabled: false
  }
});
