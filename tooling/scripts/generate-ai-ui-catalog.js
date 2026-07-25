#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const COMPONENTS_DIR = path.join(ROOT, 'src', 'ui', 'components');
const MODULES_DIR = path.join(ROOT, 'src', 'modules');
const OUTPUT_PATH = path.join(ROOT, 'src', 'modules', 'ai-ui', 'catalog', 'componentCatalog.js');

function toPosix(value) {
  return value.replaceAll(path.sep, '/');
}

/**
 * Normalize a component manifest (UI primitive or module aiui surface).
 *
 * `owner` is 'core' for UI primitives and the module id for aiui module
 * surfaces. Module surfaces additionally carry `moduleId`/`surfaceId` so the
 * composer can delegate rendering to the owning module's service.
 */
function normalizeComponent(manifest, manifestPath, owner = 'core') {
  const aiUi = manifest.aiUi;
  if (!aiUi || aiUi.enabled === false) {
    return null;
  }

  const id = manifest.component?.name || aiUi.alias;
  if (!id) {
    throw new Error(`Missing component name in ${path.relative(ROOT, manifestPath)}`);
  }

  const moduleId = manifest.component?.moduleId || null;
  const surfaceId = manifest.component?.surfaceId || id;

  return {
    id,
    owner: moduleId || owner,
    alias: aiUi.alias || id,
    title: aiUi.title || id,
    category: aiUi.category || 'Uncategorized',
    type: manifest.component?.type || 'I',
    moduleId,
    surfaceId,
    path: toPosix(path.relative(ROOT, path.dirname(manifestPath))),
    manifestPath: toPosix(path.relative(ROOT, manifestPath)),
    preferred: aiUi.preferred === true,
    summary: aiUi.summary || manifest.metadata?.description || '',
    propsSchema: aiUi.propsSchema || {},
    defaultSlot: aiUi.defaultSlot || 'default',
    slots: aiUi.slots || {},
    allowedChildren: aiUi.allowedChildren || [],
    behavior: aiUi.behavior || {},
    style: aiUi.style || {},
    textTargets: aiUi.textTargets || {},
    dependencies: manifest.dependencies || { runtime: [], components: [] },
    contracts: manifest.contracts || { published: [], subscribed: [] },
    template: aiUi.template,
    render: aiUi.render || null
  };
}

async function readManifest(manifestPath) {
  const manifestSource = await readFile(manifestPath, 'utf8');
  return JSON.parse(manifestSource);
}

/**
 * Scan UI primitive components: src/ui/components/<name>/manifest.json.
 */
async function collectPrimitiveComponents(componentsDir) {
  const entries = await readdir(componentsDir, { withFileTypes: true });
  const components = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(componentsDir, entry.name, 'manifest.json');
    let manifest;
    try {
      manifest = await readManifest(manifestPath);
    } catch {
      continue;
    }

    const component = normalizeComponent(manifest, manifestPath, 'core');
    if (component) {
      components.push(component);
    }
  }

  return components;
}

/**
 * Scan module aiui surfaces: src/modules/<module>/aiui/*.json.
 *
 * Each aiui/ subdir may hold one or more component manifests (same schema as a
 * UI primitive manifest) that describe mountable module surfaces. The owning
 * module id is derived from the module directory name.
 */
async function collectModuleSurfaces(modulesDir) {
  let moduleEntries;
  try {
    moduleEntries = await readdir(modulesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const components = [];

  for (const moduleEntry of moduleEntries) {
    if (!moduleEntry.isDirectory()) continue;

    const aiuiDir = path.join(modulesDir, moduleEntry.name, 'aiui');
    let manifestFiles;
    try {
      manifestFiles = await readdir(aiuiDir);
    } catch {
      continue;
    }

    for (const fileName of manifestFiles) {
      if (!fileName.endsWith('.json')) continue;
      const manifestPath = path.join(aiuiDir, fileName);
      const manifest = await readManifest(manifestPath);

      // Inject the owning module id if the manifest did not declare it.
      if (manifest.component && !manifest.component.moduleId) {
        manifest.component.moduleId = moduleEntry.name;
      }

      const component = normalizeComponent(manifest, manifestPath, moduleEntry.name);
      if (component) {
        components.push(component);
      }
    }
  }

  return components;
}

/**
 * Collect the merged AI UI catalog.
 *
 * @param {Object} [options]
 * @param {string} [options.componentsDir] - UI primitive scan root.
 * @param {string|null} [options.modulesDir] - Module aiui surface scan root.
 *   When `null`, module surfaces are not scanned (used by isolated tests).
 */
export async function collectAIUIComponentCatalog({ componentsDir = COMPONENTS_DIR, modulesDir = null } = {}) {
  const components = await collectPrimitiveComponents(componentsDir);

  if (modulesDir) {
    const surfaces = await collectModuleSurfaces(modulesDir);
    components.push(...surfaces);
  }

  components.sort((a, b) => a.id.localeCompare(b.id));

  const duplicates = components
    .map((component) => component.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate AI UI component ids: ${[...new Set(duplicates)].join(', ')}`);
  }

  return Object.fromEntries(components.map((component) => [component.id, component]));
}

function buildCatalogSource(catalog) {
  return `/**
 * Generated AI UI component catalog.
 *
 * Sources:
 *   - src/ui/components/[component]/manifest.json      (UI primitives)
 *   - src/modules/[module]/aiui/*.json                 (module surfaces)
 * Do not edit manually. Run \`npm run generate-ai-ui-catalog\`.
 */

export const componentCatalog = ${JSON.stringify(catalog, null, 2)};

export function listComponents() {
  return Object.keys(componentCatalog);
}

export function listTypeIIComponents() {
  return Object.entries(componentCatalog)
    .filter(([, def]) => def.type === 'II')
    .map(([id]) => id);
}

export function componentsRequiring(dependency) {
  return Object.entries(componentCatalog)
    .filter(([, def]) => (def.dependencies?.runtime || []).includes(dependency))
    .map(([id]) => id);
}
`;
}

export async function writeAIUIComponentCatalog(outputPath = OUTPUT_PATH) {
  const catalog = await collectAIUIComponentCatalog({
    componentsDir: COMPONENTS_DIR,
    modulesDir: MODULES_DIR
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buildCatalogSource(catalog), 'utf8');
  return catalog;
}

async function main() {
  const catalog = await writeAIUIComponentCatalog();
  console.log(`[generate-ai-ui-catalog] Wrote ${Object.keys(catalog).length} components to ${path.relative(ROOT, OUTPUT_PATH)}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
