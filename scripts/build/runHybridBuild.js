import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { analyzeRoutes } from './analyze-routes.js';
import { createTriggerBundles } from './createBundles.js';

const require = createRequire(import.meta.url);
const mikadoCompile = require('mikado-compile');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const PAGES_DIR = path.resolve(ROOT, 'src/pages');
const DIST_ROOT = path.resolve(ROOT, 'dist');
const DIST_PAGES_DIR = path.join(DIST_ROOT, 'pages');
const ISLAND_DIR = path.join(DIST_ROOT, '_islands');
const COMPILED_TPL_DIR = path.join(DIST_ROOT, '_templates');
const BUILD_CACHE_PATH = path.join(ROOT, '.csma', 'cache', 'hybrid-manifest.json');
const DEFAULT_TRANSPORT_BASE = process.env.CSMA_OPTIMISTIC_BASE_URL || 'http://127.0.0.1:5050';

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
    ensureDir(dir);
}

function getEntryScriptTag() {
    const indexPath = path.join(DIST_ROOT, 'index.html');
    if (!fs.existsSync(indexPath)) {
        console.warn('[build-static] No dist/index.html found; islands will not hydrate. Run vite build first.');
        return null;
    }
    const html = fs.readFileSync(indexPath, 'utf-8');
    const match = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/i);
    if (!match) {
        console.warn('[build-static] Could not detect entry script tag in dist/index.html');
        return null;
    }
    const src = match[1];
    return `<script type="module" crossorigin data-static-entry src="${src}"></script>`;
}

function getTransportBootstrap(baseUrl) {
    const wsUrl = baseUrl.replace(/^http/i, 'ws').replace(/\/$/, '') + '/optimistic/ws';
    const eventsUrl = baseUrl.replace(/\/$/, '') + '/optimistic/events';
    return `<script>\n    window.csma = window.csma || {};\n    window.csma.config = Object.assign({}, window.csma.config || {}, {\n      optimisticSync: Object.assign({}, window.csma.config?.optimisticSync || {}, {\n        wsEndpoint: window.csma.config?.optimisticSync?.wsEndpoint || '${wsUrl}',\n        eventsEndpoint: window.csma.config?.optimisticSync?.eventsEndpoint || '${eventsUrl}',\n        allowGuestCheckout: true\n      })\n    });\n  </script>`;
}

function injectEntryScript(html, { entryScriptTag, bootstrapScript }) {
    if (!entryScriptTag) {
        return html;
    }
    if (html.includes('data-static-entry')) {
        return html;
    }
    const injection = [bootstrapScript, entryScriptTag].filter(Boolean).join('\n  ');
    if (html.includes('</body>')) {
        return html.replace('</body>', `  ${injection}\n</body>`);
    }
    return `${html}\n${injection}`;
}

async function compileTemplates(templates) {
    for (const template of templates) {
        await mikadoCompile(template.src, template.destDir, {
            type: 'json',
            force: true,
            pretty: false
        });
    }
}

function loadPreviousManifest() {
    if (!fs.existsSync(BUILD_CACHE_PATH)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(BUILD_CACHE_PATH, 'utf-8'));
    } catch (error) {
        console.warn('[build-static] Failed to parse previous manifest:', error.message);
        return null;
    }
}

function saveManifest(manifest) {
    ensureDir(path.dirname(BUILD_CACHE_PATH));
    fs.writeFileSync(BUILD_CACHE_PATH, JSON.stringify(manifest, null, 2));
}

export async function runHybridBuild(options = {}) {
    const pagesDir = options.pagesDir || PAGES_DIR;
    const transportBase = options.transportBase || DEFAULT_TRANSPORT_BASE;
    const incremental = Boolean(options.incremental);

    if (!fs.existsSync(pagesDir)) {
        console.warn('[build-static] skipped – no src/pages directory found');
        return;
    }

    const previousManifest = loadPreviousManifest();
    if (!options.incremental) {
        cleanDir(DIST_PAGES_DIR);
        cleanDir(ISLAND_DIR);
        cleanDir(COMPILED_TPL_DIR);
    } else {
        ensureDir(DIST_PAGES_DIR);
        ensureDir(ISLAND_DIR);
        ensureDir(COMPILED_TPL_DIR);
    }

    const entryScriptTag = getEntryScriptTag();
    const bootstrapScript = getTransportBootstrap(transportBase);

    const routeEntries = await analyzeRoutes({ pagesDir, previousManifest });
    if (!routeEntries.length) {
        console.warn('[build-static] no templates discovered');
        return;
    }

    const manifest = {
        generatedAt: new Date().toISOString(),
        routes: {},
        islands: {}
    };
    const templatesToCompile = [];

    for (const entry of routeEntries) {
        if (incremental && previousManifest && !entry.changed) {
            continue;
        }
        const enhancedHtml = injectEntryScript(entry.html, { entryScriptTag, bootstrapScript });
        manifest.routes[entry.route] = entry.classification;
        for (const island of entry.classification.islands || []) {
            manifest.islands[island.id] = {
                id: island.id,
                contract: island.contract,
                trigger: island.trigger,
                parameters: island.parameters
            };
        }

        const outputPath = path.join(DIST_PAGES_DIR, entry.relativePath);
        ensureDir(path.dirname(outputPath));
        fs.writeFileSync(outputPath, enhancedHtml, 'utf-8');
        console.log(`[build-static] wrote ${entry.route}`);

        const templateRelDir = path.dirname(entry.relativePath);
        const compiledDir = path.join(COMPILED_TPL_DIR, templateRelDir);
        ensureDir(compiledDir);
        const unixRelative = entry.relativePath.replace(/\\/g, '/');
        const relativeDirPosix = path.posix.dirname(unixRelative);
        const destDirPosix = relativeDirPosix === '.'
            ? 'dist/_templates/'
            : `${path.posix.join('dist/_templates', relativeDirPosix)}/`;
        templatesToCompile.push({
            src: path.posix.join('src/pages', unixRelative),
            destDir: destDirPosix
        });
    }

    ensureDir(ISLAND_DIR);
    const registryPath = path.join(ISLAND_DIR, 'registry.json');
    fs.writeFileSync(
        registryPath,
        JSON.stringify(manifest, null, 2)
    );
    console.log(`[build-static] registry created (${Object.keys(manifest.routes).length} routes)`);

    createTriggerBundles({ distRoot: DIST_ROOT, manifest });
    console.log('[build-static] trigger bundles created');

    if (templatesToCompile.length) {
        await compileTemplates(templatesToCompile);
        console.log('[build-static] templates compiled via mikado-compile');
    } else {
        console.log('[build-static] no template changes detected');
    }

    saveManifest(manifest);
}
