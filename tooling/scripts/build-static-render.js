import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { EventBus } from '../../library/runtime/EventBus.js';
import { MetaManager } from '../../library/runtime/MetaManager.js';
import { normalizeRoutePath } from '../../library/runtime/pageRouting.js';
import { AIUIComposerService } from '../../library/modules/ai-ui/services/AIUIComposerService.js';
import { componentCatalog } from '../../library/modules/ai-ui/catalog/componentCatalog.js';
import { renderStaticDocument } from '../../library/modules/ai-ui/services/renderStaticHtml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_PAYLOAD_SCRIPT_ID = 'csma-render-bootstrap';
export const SUPPORTED_APPS = new Set(['demo', 'template']);

function ensureObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[static-render] ${label} must be an object.`);
  }
  return value;
}

function ensureString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`[static-render] ${label} must be a non-empty string.`);
  }
  return value.trim();
}

function toInputAttrs(snapshotRecord = {}) {
  const attrs = {
    ...(snapshotRecord.attrs || {})
  };
  if ((snapshotRecord.classes || []).length > 0) {
    attrs.class = snapshotRecord.classes.join(' ');
  }
  if (snapshotRecord.style && Object.keys(snapshotRecord.style).length > 0) {
    attrs.style = { ...snapshotRecord.style };
  }
  return attrs;
}

function tagKeyToInputKey(key = '') {
  return key.includes(':key:') ? key.split(':key:')[1] : key.replace(/^[^:]+:/, '');
}

function snapshotToMetaEntry(snapshot) {
  const entry = {
    title: snapshot.title,
    htmlAttrs: toInputAttrs(snapshot.htmlAttrs),
    bodyAttrs: toInputAttrs(snapshot.bodyAttrs),
    meta: [],
    link: [],
    script: []
  };

  (snapshot.tags || []).forEach((tag) => {
    if (tag.tag === 'meta') {
      entry.meta.push({
        ...tag.props,
        ...(tag.key ? { key: tagKeyToInputKey(tag.key) } : {})
      });
      return;
    }

    if (tag.tag === 'link') {
      entry.link.push({
        ...tag.props,
        ...(tag.key ? { key: tagKeyToInputKey(tag.key) } : {})
      });
      return;
    }

    if (tag.tag === 'script' && tag.json !== undefined) {
      entry.script.push({
        type: tag.props?.type,
        json: tag.json,
        ...(tag.key ? { key: tagKeyToInputKey(tag.key) } : {})
      });
    }
  });

  return entry;
}

function pageAttrsToMetaEntry(page) {
  const entry = {};

  if (page.htmlAttrs) {
    entry.htmlAttrs = toInputAttrs(page.htmlAttrs);
  }
  if (page.bodyAttrs) {
    entry.bodyAttrs = toInputAttrs(page.bodyAttrs);
  }

  return entry;
}

function normalizePage(page) {
  const normalized = ensureObject(page, 'static render page');
  return {
    id: ensureString(normalized.id, 'page.id'),
    routePath: normalizeRoutePath(ensureString(normalized.routePath, 'page.routePath')),
    viewId: ensureString(normalized.viewId, 'page.viewId'),
    ...(normalized.title ? { title: ensureString(normalized.title, 'page.title') } : {}),
    ...(normalized.description ? { description: ensureString(normalized.description, 'page.description') } : {}),
    ...(normalized.canonicalUrl ? { canonicalUrl: ensureString(normalized.canonicalUrl, 'page.canonicalUrl') } : {}),
    ...(normalized.lang ? { lang: ensureString(normalized.lang, 'page.lang') } : {}),
    ...(normalized.props ? { props: ensureObject(normalized.props, 'page.props') } : {}),
    ...(normalized.state ? { state: ensureObject(normalized.state, 'page.state') } : {}),
    ...(normalized.htmlAttrs ? { htmlAttrs: ensureObject(normalized.htmlAttrs, 'page.htmlAttrs') } : {}),
    ...(normalized.bodyAttrs ? { bodyAttrs: ensureObject(normalized.bodyAttrs, 'page.bodyAttrs') } : {}),
    ...(normalized.ssmaQuery ? { ssmaQuery: ensureObject(normalized.ssmaQuery, 'page.ssmaQuery') } : {})
  };
}

function pickPagesExport(module) {
  return module.RENDER_PAGES || module.STATIC_RENDER_PAGES || module.default;
}

function routeToOutputFile(outDir, routePath) {
  if (routePath === '/') {
    return path.join(outDir, 'index.html');
  }

  const normalized = routePath.replace(/^\/+|\/+$/g, '');
  return path.join(outDir, normalized, 'index.html');
}

function toRelativeUrl(fromFile, targetFile) {
  return path.relative(path.dirname(fromFile), targetFile).replaceAll(path.sep, '/');
}

function collectBuiltAssets(manifest, outDir) {
  const css = new Set();
  const appJs = new Set();
  const activationJs = new Set();

  Object.entries(manifest).forEach(([key, entry]) => {
    if (entry.isEntry && entry.file?.endsWith('.js')) {
      const src = `${entry.src || ''} ${key}`;
      if (src.includes('page-activation') || key === 'activation') {
        activationJs.add(path.join(outDir, entry.file));
      } else {
        appJs.add(path.join(outDir, entry.file));
      }
    }
    (entry.css || []).forEach((cssFile) => css.add(path.join(outDir, cssFile)));
  });

  return {
    css: [...css],
    appJs: [...appJs],
    activationJs: [...activationJs]
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

export async function loadStaticRenderConfig(appName) {
  const restore = withBuildGlobals();

  try {
    const configModule = await import(pathToFileURL(path.join(ROOT, appName, 'src', 'config.js')).href);
    const config = configModule.STATIC_RENDER_CONFIG || {};

    return {
      appPreset: configModule.APP_PRESET || '',
      enabled: config.enabled === true,
      outDir: config.outDir || `dist-static/${appName}`,
      pagesModule: config.pagesModule || './render.pages.js',
      payloadScriptId: config.payloadScriptId || DEFAULT_PAYLOAD_SCRIPT_ID
    };
  } finally {
    restore();
  }
}

export async function loadStaticRenderPages(appName, config) {
  const pagesModulePath = path.resolve(ROOT, appName, 'src', config.pagesModule.replace(/^\.\//, ''));
  const module = await import(pathToFileURL(pagesModulePath).href);
  const pages = pickPagesExport(module);

  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error(`[static-render] ${appName} render pages module must export a non-empty RENDER_PAGES array.`);
  }

  return pages.map(normalizePage);
}

export async function buildStaticAssets(appName, outDir) {
  const restore = withBuildGlobals();

  try {
    const { build: viteBuild } = await import('vite');
    const absoluteOutDir = path.resolve(ROOT, outDir);
    const appRoot = path.join(ROOT, appName);

    await viteBuild({
      configFile: false,
      publicDir: path.join(appRoot, 'public'),
      resolve: {
        alias: {
          library: path.join(ROOT, 'library')
        }
      },
      build: {
        target: 'es2020',
        outDir: absoluteOutDir,
        emptyOutDir: true,
        manifest: 'asset-manifest.json',
        rollupOptions: {
          input: {
            app: path.join(appRoot, 'src', 'main.js'),
            activation: path.join(appRoot, 'src', 'page-activation.js'),
            styles: path.join(appRoot, 'src', 'app.css')
          }
        }
      }
    });

    const manifestPath = path.join(absoluteOutDir, 'asset-manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    return {
      outDir: absoluteOutDir,
      manifest,
      assets: collectBuiltAssets(manifest, absoluteOutDir)
    };
  } finally {
    restore();
  }
}

export function buildMetaSnapshot(contract, page) {
  const eventBus = new EventBus();
  const metaManager = new MetaManager(eventBus, { document: null });
  metaManager.push(snapshotToMetaEntry(contract.head), {
    owner: 'static-render:contract',
    safe: true,
    priority: 0
  });

  const pageAttrs = pageAttrsToMetaEntry(page);
  if (Object.keys(pageAttrs).length > 0) {
    metaManager.push(pageAttrs, {
      owner: 'static-render:page',
      safe: true,
      priority: 1
    });
  }

  const snapshot = metaManager.snapshot();
  metaManager.destroy();
  return snapshot;
}

export async function renderStaticPages(appName, config, assetBuild) {
  const pages = await loadStaticRenderPages(appName, config);
  const composer = new AIUIComposerService(null);

  for (const page of pages) {
    if (!page.viewId.startsWith('ai-ui.')) {
      throw new Error(`[static-render] Unsupported static render view "${page.viewId}". Phase 3 supports ai-ui views only.`);
    }

    const contentArchetypeId = page.viewId.replace(/^ai-ui\./, '');
    const contract = composer.renderContentContract(contentArchetypeId, {
      viewId: page.viewId,
      pageId: page.id,
      routePath: page.routePath,
      canonicalUrl: page.canonicalUrl,
      lang: page.lang,
      props: {
        ...(page.props || {}),
        ...(page.title ? { title: page.title } : {}),
        ...(page.description ? { description: page.description } : {})
      },
      state: page.state || {}
    }, {
      source: 'static-render'
    });

    const metaSnapshot = buildMetaSnapshot(contract, page);
    const outputFile = routeToOutputFile(assetBuild.outDir, page.routePath);
    await mkdir(path.dirname(outputFile), { recursive: true });

    const assetUrls = {
      css: assetBuild.assets.css.map((assetFile) => toRelativeUrl(outputFile, assetFile)),
      js: contract.activation.required
        ? assetBuild.assets.activationJs.map((assetFile) => toRelativeUrl(outputFile, assetFile))
        : []
    };

    const html = renderStaticDocument({
      contract,
      metaSnapshot,
      catalog: componentCatalog,
      assetUrls,
      payloadScriptId: config.payloadScriptId,
      payload: contract.activation.required
        ? {
            app: appName,
            generatedAt: new Date().toISOString(),
            contract
          }
        : undefined
    });

    await writeFile(outputFile, html + '\n', 'utf8');
  }

  return pages;
}

export async function buildStaticRender(appName = 'demo') {
  if (!SUPPORTED_APPS.has(appName)) {
    throw new Error(`[static-render] Unsupported app "${appName}". Expected one of: ${[...SUPPORTED_APPS].join(', ')}`);
  }

  const config = await loadStaticRenderConfig(appName);
  if (!config.enabled) {
    throw new Error(
      `[static-render] ${appName} has static export disabled. Enable STATIC_RENDER_CONFIG.enabled or use an ssg-ready/ssr-ready preset first.`
    );
  }
  const outDir = path.resolve(ROOT, config.outDir);

  await rm(outDir, { recursive: true, force: true });
  const assetBuild = await buildStaticAssets(appName, outDir);
  const pages = await renderStaticPages(appName, config, assetBuild);

  return {
    appName,
    outDir,
    pages
  };
}

function parseAppArg(argv) {
  const appIndex = argv.indexOf('--app');
  if (appIndex >= 0 && argv[appIndex + 1]) {
    return argv[appIndex + 1];
  }
  return 'demo';
}

async function main() {
  const appName = parseAppArg(process.argv.slice(2));
  const result = await buildStaticRender(appName);
  console.log(`[static-render] Wrote ${result.pages.length} pages to ${path.relative(ROOT, result.outDir)}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
