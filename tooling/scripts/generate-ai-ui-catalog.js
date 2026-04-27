#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const COMPONENTS_DIR = path.join(ROOT, 'src', 'ui', 'components');
const OUTPUT_PATH = path.join(ROOT, 'src', 'modules', 'ai-ui', 'catalog', 'componentCatalog.js');

function toPosix(value) {
  return value.replaceAll(path.sep, '/');
}

function normalizeComponent(manifest, manifestPath) {
  const aiUi = manifest.aiUi;
  if (!aiUi || aiUi.enabled === false) {
    return null;
  }

  const id = manifest.component?.name || aiUi.alias;
  if (!id) {
    throw new Error(`Missing component name in ${path.relative(ROOT, manifestPath)}`);
  }

  return {
    id,
    owner: 'core',
    alias: aiUi.alias || id,
    title: aiUi.title || id,
    category: aiUi.category || 'Uncategorized',
    type: manifest.component?.type || 'I',
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

export async function collectAIUIComponentCatalog({ componentsDir = COMPONENTS_DIR } = {}) {
  const entries = await readdir(componentsDir, { withFileTypes: true });
  const components = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(componentsDir, entry.name, 'manifest.json');
    let manifestSource;
    try {
      manifestSource = await readFile(manifestPath, 'utf8');
    } catch {
      continue;
    }

    const manifest = JSON.parse(manifestSource);
    const component = normalizeComponent(manifest, manifestPath);
    if (component) {
      components.push(component);
    }
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
 * Source: src/ui/components/[component]/manifest.json
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
  const catalog = await collectAIUIComponentCatalog();
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
