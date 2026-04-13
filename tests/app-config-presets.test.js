import { describe, expect, it } from 'vitest';

import { APP_PRESETS, applyDeliveryPreset } from '../library/runtime/deliveryPresets.js';

function ensurePlatformGlobals() {
  if (!globalThis.window) {
    globalThis.window = {};
  }
  if (!globalThis.navigator) {
    globalThis.navigator = {};
  }
}

describe('app config presets', () => {
  it('keeps demo on full-csr by default', async () => {
    ensurePlatformGlobals();
    const {
      APP_PRESET: demoPreset,
      FEATURES: demoFeatures,
      APP_RUNTIME_CONFIG: demoRuntimeConfig,
      STATIC_RENDER_CONFIG: demoStaticConfig,
      SSR_CONFIG: demoSsrConfig
    } = await import('../demo/src/config.js');

    expect(demoPreset).toBe(APP_PRESETS.FULL_CSR);
    expect(demoFeatures.CSMA_MODE).toBe('full');
    expect(demoFeatures.STATIC_RENDER).toBe(false);
    expect(demoRuntimeConfig.protocol.subprotocol).toBe('1.0.0');
    expect(demoStaticConfig.enabled).toBe(false);
    expect(demoSsrConfig.enabled).toBe(false);
  });

  it('keeps template on starter-csr by default', async () => {
    ensurePlatformGlobals();
    const {
      APP_PRESET: templatePreset,
      FEATURES: templateFeatures,
      APP_RUNTIME_CONFIG: templateRuntimeConfig,
      STATIC_RENDER_CONFIG: templateStaticConfig,
      SSR_CONFIG: templateSsrConfig
    } = await import('../template/src/config.js');

    expect(templatePreset).toBe(APP_PRESETS.STARTER_CSR);
    expect(templateFeatures.CSMA_MODE).toBe('starter');
    expect(templateFeatures.STATIC_RENDER).toBe(false);
    expect(templateRuntimeConfig.clientNavigation.enabled).toBe(false);
    expect(templateStaticConfig.enabled).toBe(false);
    expect(templateSsrConfig.enabled).toBe(false);
  });

  it('derives ssg-ready and ssr-ready flags from the shared preset helper', () => {
    const baseFeatures = Object.freeze({ VALIDATION: true });
    const baseSearchConfig = Object.freeze({ tier: 'core' });
    const baseStaticRenderConfig = Object.freeze({
      outDir: 'dist-static/demo',
      pagesModule: './render.pages.js',
      payloadScriptId: 'csma-render-bootstrap'
    });
    const baseSsrConfig = Object.freeze({
      publicAssetsDir: 'dist-ssr/demo',
      pagesModule: './render.pages.js',
      payloadScriptId: 'csma-render-bootstrap',
      ssmaBaseUrl: '',
      site: 'default',
      port: 8787
    });
    const protocol = Object.freeze({ subprotocol: '1.0.0' });
    const baseRuntimeConfig = Object.freeze({
      search: baseSearchConfig,
      protocol,
      clientNavigation: {
        enabled: false
      }
    });

    const ssg = applyDeliveryPreset({
      preset: APP_PRESETS.SSG_READY,
      appName: 'demo',
      baseFeatures,
      baseSearchConfig,
      baseStaticRenderConfig,
      baseSsrConfig,
      baseRuntimeConfig,
      protocol
    });
    const ssr = applyDeliveryPreset({
      preset: APP_PRESETS.SSR_READY,
      appName: 'demo',
      baseFeatures,
      baseSearchConfig,
      baseStaticRenderConfig,
      baseSsrConfig,
      baseRuntimeConfig,
      protocol
    });

    expect(ssg.FEATURES.CSMA_MODE).toBe('full');
    expect(ssg.FEATURES.STATIC_RENDER).toBe(true);
    expect(ssg.APP_RUNTIME_CONFIG.protocol.subprotocol).toBe('1.0.0');
    expect(ssg.STATIC_RENDER_CONFIG.enabled).toBe(true);
    expect(ssg.SSR_CONFIG.enabled).toBe(false);

    expect(ssr.FEATURES.CSMA_MODE).toBe('full');
    expect(ssr.FEATURES.STATIC_RENDER).toBe(true);
    expect(ssr.STATIC_RENDER_CONFIG.enabled).toBe(true);
    expect(ssr.SSR_CONFIG.enabled).toBe(true);
  });
});
