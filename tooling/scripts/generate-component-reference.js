#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const COMPONENTS_DIR = path.join(ROOT, 'library', 'ui', 'components');
const OUTPUT_PATH = path.join(ROOT, 'generated', 'component-reference.json');

function collectMatches(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]).filter(Boolean);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function collectStates(cssSource) {
  const states = [];
  if (cssSource.includes(':hover')) states.push('hover');
  if (cssSource.includes(':focus-visible')) states.push('focus-visible');
  if (cssSource.includes(':active')) states.push('active');
  if (cssSource.includes('[disabled]') || cssSource.includes('[aria-disabled="true"]') || cssSource.includes('[data-disabled="true"]')) {
    states.push('disabled');
  }
  if (cssSource.includes('[data-state="error"]') || cssSource.includes('.field__error')) states.push('error');
  if (cssSource.includes('[data-state="success"]')) states.push('success');
  if (cssSource.includes('[data-loading="true"]') || cssSource.includes('[data-state="loading"]')) states.push('loading');
  return uniqueSorted(states);
}

function collectTokenUsage(cssSource) {
  return uniqueSorted(collectMatches(cssSource, /var\(--([a-z0-9-]+)\)/g));
}

function inferVariants(cssSource) {
  return {
    variants: uniqueSorted(collectMatches(cssSource, /\[data-variant="([^"]+)"\]/g)),
    sizes: uniqueSorted(collectMatches(cssSource, /\[data-size="([^"]+)"\]/g)),
    tones: uniqueSorted(collectMatches(cssSource, /\[data-tone="([^"]+)"\]/g)),
    shapes: uniqueSorted(collectMatches(cssSource, /\[data-shape="([^"]+)"\]/g)),
    states: uniqueSorted(collectMatches(cssSource, /\[data-state="([^"]+)"\]/g))
  };
}

function inferVisualRole(category, behaviorRole) {
  if (behaviorRole === 'field') return 'control';
  if (behaviorRole === 'trigger') return 'control';
  if (behaviorRole === 'container') return 'container';
  if (category === 'Layout') return 'container';
  if (category === 'Forms') return 'control';
  if (category === 'Interactive') return 'control';
  return 'indicator';
}

export async function collectComponentReference({ generatedAt = new Date().toISOString() } = {}) {
  const dirEntries = await readdir(COMPONENTS_DIR, { withFileTypes: true });
  const components = [];

  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;

    const componentRoot = path.join(COMPONENTS_DIR, entry.name);
    const manifestPath = path.join(componentRoot, 'manifest.json');
    const cssPath = path.join(componentRoot, `${entry.name}.css`);
    const demoPath = path.join(componentRoot, `${entry.name}.demo.html`);

    const [manifestSource, cssSource, demoSource] = await Promise.all([
      readFile(manifestPath, 'utf8'),
      readFile(cssPath, 'utf8'),
      readFile(demoPath, 'utf8')
    ]);

    const manifest = JSON.parse(manifestSource);
    const aiUi = manifest.aiUi;
    const inferred = inferVariants(cssSource);

    components.push({
      id: manifest.component.name,
      alias: aiUi.alias,
      title: aiUi.title,
      category: aiUi.category,
      type: manifest.component.type,
      visualRole: inferVisualRole(aiUi.category, aiUi.behavior?.role),
      preferred: aiUi.preferred === true,
      lifecycle: manifest.component.lifecycle,
      stability: manifest.component.stability,
      manifestPath: path.relative(ROOT, manifestPath).replaceAll(path.sep, '/'),
      cssPath: path.relative(ROOT, cssPath).replaceAll(path.sep, '/'),
      demoPath: path.relative(ROOT, demoPath).replaceAll(path.sep, '/'),
      summary: aiUi.summary,
      propsSchema: aiUi.propsSchema,
      defaultSlot: aiUi.defaultSlot,
      slots: aiUi.slots,
      allowedChildren: aiUi.allowedChildren,
      behavior: aiUi.behavior,
      style: aiUi.style,
      textTargets: aiUi.textTargets,
      contracts: manifest.contracts,
      dependencies: manifest.dependencies,
      template: aiUi.template,
      render: aiUi.render,
      states: collectStates(cssSource),
      variants: inferred.variants,
      sizes: inferred.sizes,
      tones: inferred.tones,
      shapes: inferred.shapes,
      dataStates: inferred.states,
      tokensUsed: collectTokenUsage(cssSource),
      demoIncludesComponentName: demoSource.includes(entry.name)
    });
  }

  components.sort((a, b) => a.alias.localeCompare(b.alias));

  return {
    version: '1.0.0',
    generatedAt,
    source: 'library/ui/components/*/{manifest.json,*.css,*.demo.html}',
    totalComponents: components.length,
    components
  };
}

export async function writeComponentReference(outputPath = OUTPUT_PATH) {
  const reference = await collectComponentReference();
  await writeFile(outputPath, JSON.stringify(reference, null, 2) + '\n', 'utf8');
  return reference;
}

async function main() {
  const reference = await writeComponentReference();
  console.log(`[generate-component-reference] Wrote ${reference.totalComponents} components to ${path.relative(ROOT, OUTPUT_PATH)}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
