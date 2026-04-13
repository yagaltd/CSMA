#!/usr/bin/env node

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toolingGeneratedPath } from './generated-paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const COMPONENTS_DIR = path.join(ROOT, 'library', 'ui', 'components');
const OUTPUT_PATH = toolingGeneratedPath('ai-catalog.json');
const RUNTIME_CATALOG_OUTPUT_PATH = path.join(ROOT, 'library', 'modules', 'ai-ui', 'catalog', 'componentCatalog.js');

function compareEntries(a, b) {
  return a.alias.localeCompare(b.alias) || a.name.localeCompare(b.name);
}

function ensureObject(value, label, manifestPath) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[generate-ai-catalog] ${manifestPath}: ${label} must be an object.`);
  }

  return value;
}

function ensureString(value, label, manifestPath) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`[generate-ai-catalog] ${manifestPath}: ${label} must be a non-empty string.`);
  }

  return value.trim();
}

function ensureStringArray(value, label, manifestPath) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`[generate-ai-catalog] ${manifestPath}: ${label} must be an array of strings.`);
  }

  return [...value];
}

function normalizeSlotDefinitions(value, label, manifestPath) {
  const slots = ensureObject(value, label, manifestPath);

  return Object.fromEntries(
    Object.entries(slots).map(([slotName, slotDefinition]) => {
      const normalizedSlot = ensureObject(slotDefinition, `${label}.${slotName}`, manifestPath);
      return [
        slotName,
        {
          selector: ensureString(normalizedSlot.selector, `${label}.${slotName}.selector`, manifestPath),
          allowedChildren: ensureStringArray(normalizedSlot.allowedChildren || [], `${label}.${slotName}.allowedChildren`, manifestPath)
        }
      ];
    })
  );
}

export function buildCatalogEntry(manifest, manifestPath) {
  const component = ensureObject(manifest.component, 'component', manifestPath);
  const aiUi = ensureObject(manifest.aiUi, 'aiUi', manifestPath);
  const contracts = ensureObject(manifest.contracts, 'contracts', manifestPath);
  const dependencies = ensureObject(manifest.dependencies, 'dependencies', manifestPath);

  if (aiUi.enabled !== true) {
    return null;
  }

  const defaultSlot = ensureString(aiUi.defaultSlot, 'aiUi.defaultSlot', manifestPath);
  const slots = normalizeSlotDefinitions(aiUi.slots, 'aiUi.slots', manifestPath);
  if (!(defaultSlot in slots)) {
    throw new Error(`[generate-ai-catalog] ${manifestPath}: aiUi.defaultSlot must reference a declared slot.`);
  }

  return {
    name: ensureString(component.name, 'component.name', manifestPath),
    alias: ensureString(aiUi.alias, 'aiUi.alias', manifestPath),
    title: ensureString(aiUi.title, 'aiUi.title', manifestPath),
    summary: ensureString(aiUi.summary, 'aiUi.summary', manifestPath),
    category: ensureString(aiUi.category, 'aiUi.category', manifestPath),
    type: ensureString(component.type, 'component.type', manifestPath),
    owner: ensureString(component.owner, 'component.owner', manifestPath),
    lifecycle: ensureString(component.lifecycle, 'component.lifecycle', manifestPath),
    stability: ensureString(component.stability, 'component.stability', manifestPath),
    preferred: aiUi.preferred === true,
    manifestPath,
    description: ensureString(manifest.metadata?.description || aiUi.summary, 'metadata.description', manifestPath),
    contracts: {
      published: ensureStringArray(contracts.published || [], 'contracts.published', manifestPath),
      subscribed: ensureStringArray(contracts.subscribed || [], 'contracts.subscribed', manifestPath)
    },
    dependencies: {
      runtime: ensureStringArray(dependencies.runtime || [], 'dependencies.runtime', manifestPath),
      components: ensureStringArray(dependencies.components || [], 'dependencies.components', manifestPath)
    },
    propsSchema: ensureObject(aiUi.propsSchema, 'aiUi.propsSchema', manifestPath),
    defaultSlot,
    slots,
    allowedChildren: ensureStringArray(aiUi.allowedChildren || [], 'aiUi.allowedChildren', manifestPath),
    render: ensureObject(aiUi.render, 'aiUi.render', manifestPath),
    behavior: ensureObject(aiUi.behavior, 'aiUi.behavior', manifestPath),
    activation: aiUi.activation ? ensureObject(aiUi.activation, 'aiUi.activation', manifestPath) : {},
    style: ensureObject(aiUi.style, 'aiUi.style', manifestPath),
    textTargets: ensureObject(aiUi.textTargets, 'aiUi.textTargets', manifestPath),
    template: ensureString(aiUi.template, 'aiUi.template', manifestPath)
  };
}

export function buildRuntimeCatalogEntry(component) {
  const slots = Object.fromEntries(
    Object.entries(component.slots || {}).map(([slotName, slotDefinition]) => [slotName, [...(slotDefinition.allowedChildren || [])]])
  );

  const requiredSlots = Object.entries(component.slots || {})
    .filter(([slotName, slotDefinition]) => {
      if (slotDefinition.required === true) {
        return true;
      }

      return slotName === component.defaultSlot
        && slotDefinition.selector !== ':root'
        && (slotDefinition.allowedChildren || []).length > 0;
    })
    .map(([slotName]) => slotName);

  return {
    props: Object.keys(component.propsSchema || {}),
    slots,
    slotDefinitions: Object.fromEntries(
      Object.entries(component.slots || {}).map(([slotName, slotDefinition]) => [
        slotName,
        {
          selector: slotDefinition.selector,
          allowedChildren: [...(slotDefinition.allowedChildren || [])]
        }
      ])
    ),
    requiredSlots,
    componentType: component.type,
    runtimeDependencies: [...(component.dependencies?.runtime || [])],
    render: component.render,
    activation: structuredClone(component.activation || {}),
    textTargets: structuredClone(component.textTargets || {}),
    defaultSlot: component.defaultSlot
  };
}

export function buildRuntimeComponentCatalog(catalog) {
  return Object.fromEntries(
    (catalog.components || []).map((component) => [component.alias, buildRuntimeCatalogEntry(component)])
  );
}

export function serializeRuntimeComponentCatalog(runtimeCatalog) {
  return `export const componentCatalog = ${JSON.stringify(runtimeCatalog, null, 2)};\n`;
}

export async function collectComponentCatalog({
  componentsDir = COMPONENTS_DIR,
  generatedAt = new Date().toISOString()
} = {}) {
  const componentDirs = await readdir(componentsDir, { withFileTypes: true });
  const manifests = [];

  for (const entry of componentDirs) {
    if (!entry.isDirectory()) {
      continue;
    }

    const manifestPath = path.join(componentsDir, entry.name, 'manifest.json');
    try {
      const content = await readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(content);
      const relPath = path.relative(ROOT, manifestPath).replaceAll(path.sep, '/');
      const catalogEntry = buildCatalogEntry(manifest, relPath);

      if (catalogEntry) {
        manifests.push(catalogEntry);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  const components = manifests.sort(compareEntries);
  const categories = [...new Set(components.map((component) => component.category))].sort((a, b) => a.localeCompare(b));

  return {
    version: '1.0.0',
    generatedAt,
    source: 'library/ui/components/*/manifest.json',
    totalComponents: components.length,
    categories,
    components
  };
}

export async function writeAiCatalog(outputPath = OUTPUT_PATH) {
  const catalog = await collectComponentCatalog();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  return catalog;
}

export async function writeRuntimeComponentCatalog(outputPath = RUNTIME_CATALOG_OUTPUT_PATH, catalog = null) {
  const sourceCatalog = catalog || await collectComponentCatalog();
  const runtimeCatalog = buildRuntimeComponentCatalog(sourceCatalog);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeRuntimeComponentCatalog(runtimeCatalog), 'utf8');
  return runtimeCatalog;
}

export async function writeAiCatalogArtifacts({
  outputPath = OUTPUT_PATH,
  runtimeOutputPath = RUNTIME_CATALOG_OUTPUT_PATH
} = {}) {
  const catalog = await writeAiCatalog(outputPath);
  const runtimeCatalog = await writeRuntimeComponentCatalog(runtimeOutputPath, catalog);
  return { catalog, runtimeCatalog };
}

async function main() {
  const { catalog } = await writeAiCatalogArtifacts();
  console.log(`[generate-ai-catalog] Wrote ${catalog.totalComponents} components to ${path.relative(ROOT, OUTPUT_PATH)} and ${path.relative(ROOT, RUNTIME_CATALOG_OUTPUT_PATH)}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
