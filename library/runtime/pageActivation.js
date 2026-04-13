import { componentCatalog } from '../modules/ai-ui/catalog/componentCatalog.js';
import { mountRenderContractPage } from '../modules/ai-ui/services/renderPageDom.js';
import { initUI } from '../ui/init.js';
import { createRuntimeState, destroyRuntimeState, syncWindowRuntime } from './bootstrap.js';
import { loadOptionalFeatures } from './features.js';
import { loadTheme, resolveApiBaseUrl, setupThemeToggle } from '../style/theme/theme-helpers.js';

let runtimeState = null;
let activationPromise = null;

export function readRenderPayload({ documentRef = document, payloadScriptId = 'csma-render-bootstrap' } = {}) {
  const payloadNode = documentRef.getElementById(payloadScriptId);
  if (!payloadNode?.textContent) {
    return null;
  }

  return JSON.parse(payloadNode.textContent);
}

export function contractRequiresActivation(contract) {
  return Boolean(contract?.activation?.required);
}

export function mountContractPage({ documentRef = document, mount, contract, catalog = componentCatalog }) {
  return mountRenderContractPage({
    documentRef,
    mount,
    contract,
    catalog
  });
}

export async function activateContractPage({
  FEATURES,
  runtimeConfig = {},
  pages = [],
  payloadScriptId = 'csma-render-bootstrap',
  documentRef = globalThis.document,
  windowRef = globalThis.window
} = {}) {
  const payload = readRenderPayload({ documentRef, payloadScriptId });
  const contract = payload?.contract;

  if (!contract) {
    return { activated: false, reason: 'missing-payload', payload: null };
  }

  if (!contractRequiresActivation(contract)) {
    return { activated: false, reason: 'not-required', contract, payload };
  }

  if (activationPromise) {
    return activationPromise;
  }

  activationPromise = (async () => {
    const apiBaseUrl = resolveApiBaseUrl(runtimeConfig);
    runtimeState = createRuntimeState();
    runtimeState.runtimeConfig = runtimeConfig;
    syncWindowRuntime(runtimeState, { apiBaseUrl, destroyApp });

    await loadOptionalFeatures(runtimeState, {
      FEATURES,
      apiBaseUrl,
      runtimeConfig,
      pages,
      documentRef,
      windowRef
    });
    syncWindowRuntime(runtimeState, { apiBaseUrl, destroyApp });

    runtimeState.uiCleanup = initUI(runtimeState.eventBus) || null;
    runtimeState.themeToggleCleanup?.();
    runtimeState.themeToggleCleanup = setupThemeToggle(runtimeState.eventBus);
    loadTheme();

    const page = pages.find((entry) => entry.id === contract.page?.id || entry.routePath === contract.page?.routePath) || null;
    runtimeState.pageRuntime?.hydrateCurrentPage(page, contract);

    return { activated: true, contract, payload };
  })().finally(() => {
    activationPromise = null;
  });

  return activationPromise;

  async function destroyApp() {
    if (!runtimeState) {
      return;
    }

    await destroyRuntimeState(runtimeState, { destroyApp });
    runtimeState = null;
    if (windowRef?.csma) {
      windowRef.csma.destroyApp = destroyApp;
    }
  }
}
