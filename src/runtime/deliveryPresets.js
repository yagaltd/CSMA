export const APP_PRESETS = Object.freeze({
  STARTER_CSR: 'starter-csr',
  FULL_CSR: 'full-csr',
  SSG_READY: 'ssg-ready',
  SSR_READY: 'ssr-ready'
});

export function createFeatureSet(baseFeatures, {
  csmaMode,
  staticRenderEnabled
}) {
  return Object.freeze({
    ...baseFeatures,
    CSMA_MODE: csmaMode,
    STATIC_RENDER: staticRenderEnabled
  });
}

export function applyDeliveryPreset({
  preset,
  appName,
  baseFeatures,
  baseSearchConfig,
  baseStaticRenderConfig,
  baseSsrConfig,
  baseRuntimeConfig,
  protocol
}) {
  const runtimeConfig = Object.freeze({
    ...structuredClone(baseRuntimeConfig || {}),
    search: Object.freeze({ ...(baseRuntimeConfig?.search || baseSearchConfig || {}) }),
    protocol: Object.freeze({ ...(baseRuntimeConfig?.protocol || protocol || {}) }),
    clientNavigation: Object.freeze({
      enabled: Boolean(baseRuntimeConfig?.clientNavigation?.enabled)
    })
  });

  switch (preset) {
    case APP_PRESETS.STARTER_CSR:
      return {
        APP_PRESET: preset,
        FEATURES: createFeatureSet(baseFeatures, {
          csmaMode: 'starter',
          staticRenderEnabled: false
        }),
        SEARCH_CONFIG: Object.freeze({ ...baseSearchConfig }),
        APP_RUNTIME_CONFIG: runtimeConfig,
        STATIC_RENDER_CONFIG: Object.freeze({
          ...baseStaticRenderConfig,
          enabled: false
        }),
        SSR_CONFIG: Object.freeze({
          ...baseSsrConfig,
          enabled: false
        }),
        PROTOCOL: Object.freeze({ ...protocol })
      };
    case APP_PRESETS.FULL_CSR:
      return {
        APP_PRESET: preset,
        FEATURES: createFeatureSet(baseFeatures, {
          csmaMode: 'full',
          staticRenderEnabled: false
        }),
        SEARCH_CONFIG: Object.freeze({ ...baseSearchConfig }),
        APP_RUNTIME_CONFIG: runtimeConfig,
        STATIC_RENDER_CONFIG: Object.freeze({
          ...baseStaticRenderConfig,
          enabled: false
        }),
        SSR_CONFIG: Object.freeze({
          ...baseSsrConfig,
          enabled: false
        }),
        PROTOCOL: Object.freeze({ ...protocol })
      };
    case APP_PRESETS.SSG_READY:
      return {
        APP_PRESET: preset,
        FEATURES: createFeatureSet(baseFeatures, {
          csmaMode: 'full',
          staticRenderEnabled: true
        }),
        SEARCH_CONFIG: Object.freeze({ ...baseSearchConfig }),
        APP_RUNTIME_CONFIG: runtimeConfig,
        STATIC_RENDER_CONFIG: Object.freeze({
          ...baseStaticRenderConfig,
          enabled: true
        }),
        SSR_CONFIG: Object.freeze({
          ...baseSsrConfig,
          enabled: false
        }),
        PROTOCOL: Object.freeze({ ...protocol })
      };
    case APP_PRESETS.SSR_READY:
      return {
        APP_PRESET: preset,
        FEATURES: createFeatureSet(baseFeatures, {
          csmaMode: 'full',
          staticRenderEnabled: true
        }),
        SEARCH_CONFIG: Object.freeze({ ...baseSearchConfig }),
        APP_RUNTIME_CONFIG: runtimeConfig,
        STATIC_RENDER_CONFIG: Object.freeze({
          ...baseStaticRenderConfig,
          enabled: true
        }),
        SSR_CONFIG: Object.freeze({
          ...baseSsrConfig,
          enabled: true
        }),
        PROTOCOL: Object.freeze({ ...protocol })
      };
    default:
      throw new Error(
        `[config] Unsupported APP_PRESET "${preset}" for ${appName}. Expected one of: ${Object.values(APP_PRESETS).join(', ')}`
      );
  }
}
