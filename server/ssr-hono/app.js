import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Hono } from 'hono';

import { ROOT, SUPPORTED_APPS, buildMetaSnapshot, loadStaticRenderPages } from '../../tooling/scripts/build-static-render.js';
import { AIUIComposerService } from '../../library/modules/ai-ui/services/AIUIComposerService.js';
import { componentCatalog } from '../../library/modules/ai-ui/catalog/componentCatalog.js';
import { renderStaticDocument } from '../../library/modules/ai-ui/services/renderStaticHtml.js';
import { matchRenderPage, normalizeRoutePath } from '../../library/runtime/pageRouting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PAYLOAD_SCRIPT_ID = 'csma-render-bootstrap';
const DEFAULT_SITE = 'default';
const DEFAULT_PORT = 8787;

function ensureObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[ssr] ${label} must be an object.`);
  }
  return value;
}

function normalizeAssetUrls(manifest = {}) {
  const css = new Set();
  const js = new Set();

  Object.entries(manifest).forEach(([key, entry]) => {
    if (!entry || typeof entry !== 'object') {
      return;
    }

    if (entry.isEntry && typeof entry.file === 'string' && entry.file.endsWith('.js')) {
      const src = `${entry.src || ''} ${key}`;
      if (!src.includes('page-activation') && key !== 'activation') {
        return;
      }
      js.add(`/${entry.file.replace(/^\/+/, '')}`);
    }

    (entry.css || []).forEach((cssFile) => {
      if (typeof cssFile === 'string' && cssFile.trim()) {
        css.add(`/${cssFile.replace(/^\/+/, '')}`);
      }
    });
  });

  return {
    css: [...css],
    js: [...js]
  };
}

function withBuildGlobals() {
  const previousWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  if (!globalThis.window) {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: {}
    });
  }

  if (!globalThis.navigator) {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {}
    });
  }

  return () => {
    if (previousWindowDescriptor === undefined) {
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, 'window', previousWindowDescriptor);
    }

    if (previousNavigatorDescriptor === undefined) {
      delete globalThis.navigator;
    } else {
      Object.defineProperty(globalThis, 'navigator', previousNavigatorDescriptor);
    }
  };
}

function normalizeSsrConfig(appName, config = {}) {
  return {
    enabled: config.enabled === true,
    pagesModule: config.pagesModule || './render.pages.js',
    publicAssetsDir: config.publicAssetsDir || `dist-ssr/${appName}`,
    payloadScriptId: config.payloadScriptId || DEFAULT_PAYLOAD_SCRIPT_ID,
    ssmaBaseUrl: typeof config.ssmaBaseUrl === 'string' ? config.ssmaBaseUrl.replace(/\/+$/, '') : '',
    site: typeof config.site === 'string' && config.site.trim() ? config.site.trim() : DEFAULT_SITE,
    port: Number.isInteger(config.port) ? config.port : DEFAULT_PORT
  };
}

export async function loadSSRConfig(appName) {
  if (!SUPPORTED_APPS.has(appName)) {
    throw new Error(`[ssr] Unsupported app "${appName}". Expected one of: ${[...SUPPORTED_APPS].join(', ')}`);
  }

  const restore = withBuildGlobals();

  try {
    const configModule = await import(pathToFileURL(path.join(ROOT, appName, 'src', 'config.js')).href);
    return {
      appPreset: configModule.APP_PRESET || '',
      ...normalizeSsrConfig(appName, configModule.SSR_CONFIG || {})
    };
  } finally {
    restore();
  }
}

export async function loadSSRPages(appName, config) {
  return loadStaticRenderPages(appName, {
    pagesModule: config.pagesModule || './render.pages.js'
  });
}

export function matchSSRPage(pages, pathname) {
  return matchRenderPage(pages, pathname);
}

function normalizeQueryResponse(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

function mergeAttrRecord(base = {}, override = {}) {
  if (!override || typeof override !== 'object') {
    return base;
  }

  return {
    attrs: {
      ...(base.attrs || {}),
      ...(override.attrs || {})
    },
    classes: [
      ...new Set([...(base.classes || []), ...(override.classes || [])])
    ],
    style: {
      ...(base.style || {}),
      ...(override.style || {})
    }
  };
}

function mergePageData(page, overrides = {}) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return page;
  }

  return {
    ...page,
    ...overrides,
    props: {
      ...(page.props || {}),
      ...(overrides.props || {})
    },
    state: {
      ...(page.state || {}),
      ...(overrides.state || {})
    },
    htmlAttrs: mergeAttrRecord(page.htmlAttrs || {}, overrides.htmlAttrs || {}),
    bodyAttrs: mergeAttrRecord(page.bodyAttrs || {}, overrides.bodyAttrs || {})
  };
}

function getIncomingRequestId(request) {
  const value = request.headers.get('x-request-id');
  if (value && value.trim()) {
    return value.trim();
  }

  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}`;
}

function getForwardedIp(request) {
  return request.headers.get('x-forwarded-for') || '';
}

function buildSsmaHeaders(request, config, requestId) {
  const headers = {
    'Content-Type': 'application/json',
    'x-ssma-site': config.site,
    'x-request-id': requestId
  };

  const cookie = request.headers.get('cookie');
  const userAgent = request.headers.get('user-agent');
  const forwardedFor = getForwardedIp(request);

  if (cookie) {
    headers.cookie = cookie;
  }
  if (userAgent) {
    headers['user-agent'] = userAgent;
  }
  if (forwardedFor) {
    headers['x-forwarded-for'] = forwardedFor;
  }

  return headers;
}

function validateSsmaQueryDefinition(page) {
  if (!page.ssmaQuery) {
    return;
  }

  ensureObject(page.ssmaQuery, `${page.id}.ssmaQuery`);
  if (typeof page.ssmaQuery.name !== 'string' || !page.ssmaQuery.name.trim()) {
    throw new Error(`[ssr] page "${page.id}" ssmaQuery.name must be a non-empty string.`);
  }
}

function renderErrorDocument(status, title, message) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
    <p>Status: ${status}</p>
  </main>
</body>
</html>`;
}

function contentTypeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.ico':
      return 'image/x-icon';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

async function serveAsset(publicAssetsDir, requestPath) {
  const relativePath = requestPath.replace(/^\/+/, '');
  const absoluteRoot = path.resolve(ROOT, publicAssetsDir);
  const absolutePath = path.resolve(absoluteRoot, relativePath);

  if (!absolutePath.startsWith(absoluteRoot + path.sep) && absolutePath !== absoluteRoot) {
    return null;
  }

  try {
    const body = await readFile(absolutePath);
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': contentTypeForFile(absolutePath),
        'cache-control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function loadAssetManifest(publicAssetsDir) {
  const manifestPath = path.resolve(ROOT, publicAssetsDir, 'asset-manifest.json');
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

async function resolvePageData(page, requestContext, config, fetchImpl) {
  validateSsmaQueryDefinition(page);
  const relayHeaders = {};
  let resolvedPage = page;
  let resolvedRequestId = requestContext.requestId;

  if (!page.ssmaQuery) {
    return { page: resolvedPage, relayHeaders, requestId: resolvedRequestId };
  }

  if (!config.ssmaBaseUrl) {
    throw new Error(`[ssr] page "${page.id}" requires SSR_CONFIG.ssmaBaseUrl because it declares ssmaQuery.`);
  }

  const payload = typeof page.ssmaQuery.buildPayload === 'function'
    ? await page.ssmaQuery.buildPayload(requestContext)
    : (page.ssmaQuery.payload || {});
  const response = await fetchImpl(`${config.ssmaBaseUrl}/query/${encodeURIComponent(page.ssmaQuery.name)}`, {
    method: 'POST',
    headers: buildSsmaHeaders(requestContext.request, config, requestContext.requestId),
    body: JSON.stringify({ payload })
  });

  if (!response.ok) {
    const error = new Error(`[ssr] SSMA query "${page.ssmaQuery.name}" failed with status ${response.status}.`);
    error.status = 502;
    throw error;
  }

  const ssmaRequestId = response.headers.get('x-request-id');
  if (ssmaRequestId) {
    relayHeaders['x-request-id'] = ssmaRequestId;
    resolvedRequestId = ssmaRequestId;
  }

  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    relayHeaders['set-cookie'] = setCookie;
  }

  const responsePayload = normalizeQueryResponse(await response.json());
  const mapped = typeof page.ssmaQuery.mapResponse === 'function'
    ? await page.ssmaQuery.mapResponse(requestContext, responsePayload)
    : {};
  resolvedPage = mergePageData(page, mapped);

  return {
    page: resolvedPage,
    relayHeaders,
    requestId: resolvedRequestId
  };
}

export async function createSSRApp({
  appName = 'demo',
  config: providedConfig,
  pages: providedPages,
  assetManifest: providedAssetManifest,
  fetchImpl = globalThis.fetch?.bind(globalThis)
} = {}) {
  const config = providedConfig
    ? normalizeSsrConfig(appName, providedConfig)
    : await loadSSRConfig(appName);
  if (!providedConfig && !config.enabled) {
    throw new Error(
      `[ssr] ${appName} has SSR disabled. Enable SSR_CONFIG.enabled or use an ssr-ready preset first.`
    );
  }
  const pages = providedPages || await loadSSRPages(appName, config);
  const assetManifest = providedAssetManifest || await loadAssetManifest(config.publicAssetsDir);
  const assetUrls = normalizeAssetUrls(assetManifest);
  const composer = new AIUIComposerService(null);
  const app = new Hono();

  app.get('/assets/*', async (c) => {
    const response = await serveAsset(config.publicAssetsDir, new URL(c.req.url).pathname);
    if (!response) {
      return c.html(renderErrorDocument(404, 'Asset Not Found', 'The requested asset could not be found.'), 404);
    }
    return response;
  });

  app.get('*', async (c) => {
    const url = new URL(c.req.url);
    const normalizedPath = normalizeRoutePath(url.pathname);
    const page = matchSSRPage(pages, normalizedPath);

    if (!page) {
      return c.html(renderErrorDocument(404, 'Page Not Found', `No SSR page matches "${normalizedPath}".`), 404);
    }

    if (!page.viewId.startsWith('ai-ui.')) {
      return c.html(renderErrorDocument(500, 'SSR Configuration Error', `Unsupported SSR view "${page.viewId}".`), 500);
    }

    const requestId = getIncomingRequestId(c.req.raw);
    const requestContext = {
      request: c.req.raw,
      url,
      routePath: page.routePath,
      searchParams: url.searchParams,
      headers: c.req.raw.headers,
      requestId,
      site: config.site,
      cookies: c.req.raw.headers.get('cookie') || ''
    };

    try {
      const resolved = await resolvePageData(page, requestContext, config, fetchImpl);
      const contentArchetypeId = resolved.page.viewId.replace(/^ai-ui\./, '');
      const contract = composer.renderContentContract(contentArchetypeId, {
        viewId: resolved.page.viewId,
        pageId: resolved.page.id,
        routePath: resolved.page.routePath,
        canonicalUrl: resolved.page.canonicalUrl,
        lang: resolved.page.lang,
        props: {
          ...(resolved.page.props || {}),
          ...(resolved.page.title ? { title: resolved.page.title } : {}),
          ...(resolved.page.description ? { description: resolved.page.description } : {})
        },
        state: resolved.page.state || {}
      }, {
        source: 'ssr'
      });
      const metaSnapshot = buildMetaSnapshot(contract, resolved.page);
      const html = renderStaticDocument({
        contract,
        metaSnapshot,
        catalog: componentCatalog,
        assetUrls: {
          css: assetUrls.css,
          js: contract.activation.required ? assetUrls.js : []
        },
        payloadScriptId: config.payloadScriptId,
        payload: contract.activation.required
          ? {
              app: appName,
              requestId: resolved.requestId,
              renderedAt: new Date().toISOString(),
              contract
            }
          : undefined
      });
      const responseHeaders = new Headers({
        'content-type': 'text/html; charset=utf-8',
        'x-request-id': resolved.requestId
      });

      Object.entries(resolved.relayHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      return new Response(html, {
        status: 200,
        headers: responseHeaders
      });
    } catch (error) {
      const status = error?.status || 500;
      const title = status === 502 ? 'Upstream SSR Error' : 'SSR Render Error';
      return c.html(renderErrorDocument(status, title, error.message), status);
    }
  });

  return {
    app,
    config,
    pages,
    assetManifest
  };
}
