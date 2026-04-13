import { APP_RUNTIME_CONFIG, FEATURES } from './config.js';
import { RENDER_PAGES } from './render.pages.js';
import { activateContractPage } from '../../library/runtime/pageActivation.js';

activateContractPage({ FEATURES, runtimeConfig: APP_RUNTIME_CONFIG, pages: RENDER_PAGES }).catch((error) => {
  console.error('[CSMA] Page activation failed:', error);
});
