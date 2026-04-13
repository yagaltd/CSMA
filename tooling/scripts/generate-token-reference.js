#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appDesignTokensPath, toolingGeneratedPath } from './generated-paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_APP = 'template';
const OUTPUT_PATH = toolingGeneratedPath('token-reference.json');

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isToken(value) {
  return isObject(value) && '$value' in value;
}

function toKebab(value) {
  return value.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function formatTokenValue(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (!isObject(value)) return String(value);
  if (value.colorSpace && Array.isArray(value.components)) {
    return `${value.colorSpace}(${value.components.join(', ')})`;
  }
  if ('value' in value && 'unit' in value) {
    return `${value.value}${value.unit}`;
  }
  return JSON.stringify(value);
}

function cssVarForPath(pathParts) {
  const [root, ...rest] = pathParts;
  if (root === 'primitives') {
    const [group, subGroup, name] = rest;
    if (group === 'spacing') return `--space-${subGroup}`;
    if (group === 'radius') return `--radius-${subGroup}`;
    if (group === 'shadow') return `--shadow-${subGroup}`;
    if (group === 'breakpoint') return `--breakpoint-${subGroup}`;
    if (group === 'zIndex') return `--z-${subGroup}`;
    if (group === 'opacity') return `--opacity-${subGroup}`;
    if (group === 'letterSpacing') return `--tracking-${subGroup}`;
    if (group === 'borderWidth') return `--border-width-${subGroup}`;
    if (group === 'focusRing') return `--ring-${toKebab(subGroup)}`;
    if (group === 'layout') return `--layout-${toKebab(subGroup)}`;
    if (group === 'typography') {
      if (subGroup === 'fontFamily') return `--font-family-${toKebab(name)}`;
      if (subGroup === 'fontSize') return `--font-size-${name}`;
      if (subGroup === 'fontWeight') return `--font-weight-${toKebab(name)}`;
      if (subGroup === 'lineHeight') return `--line-height-${toKebab(name)}`;
    }
    if (group === 'motion') {
      if (subGroup === 'duration') return `--motion-duration-${name}`;
      if (subGroup === 'easing') return `--ease-${toKebab(name)}`;
    }
  }

  if (root === 'semantic') {
    const [group, name] = rest;
    return `--${toKebab(group)}-${toKebab(name)}`;
  }

  if (root === 'components') {
    const [component, tokenName] = rest;
    return `--${toKebab(component)}-${toKebab(tokenName)}`;
  }

  if (root === 'themes') {
    const [, group, tokenName] = rest;
    return `--${toKebab(tokenName)}`;
  }

  return null;
}

function flattenTokens(node, pathParts = [], into = []) {
  if (!isObject(node)) {
    return into;
  }

  if (isToken(node)) {
    const tokenPath = pathParts.join('.');
    into.push({
      path: tokenPath,
      category: pathParts[0] || 'unknown',
      token: pathParts[pathParts.length - 1],
      cssVar: cssVarForPath(pathParts),
      type: node.$type || null,
      description: node.$description || null,
      rawValue: node.$value,
      value: formatTokenValue(node.$value),
      extensions: node.$extensions || {}
    });
    return into;
  }

  Object.entries(node).forEach(([key, value]) => {
    if (key.startsWith('$')) return;
    flattenTokens(value, [...pathParts, key], into);
  });

  return into;
}

export async function collectTokenReference({
  appName = DEFAULT_APP,
  generatedAt = new Date().toISOString()
} = {}) {
  const tokensPath = appDesignTokensPath(appName);
  const source = await readFile(tokensPath, 'utf8');
  const tokens = JSON.parse(source);
  const entries = flattenTokens(tokens).sort((a, b) => a.path.localeCompare(b.path));

  const byCategory = entries.reduce((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + 1;
    return acc;
  }, {});

  return {
    version: '1.0.0',
    generatedAt,
    source: `${appName}/design-tokens.json`,
    appName,
    totalTokens: entries.length,
    categories: byCategory,
    tokens: entries
  };
}

export async function writeTokenReference(outputPath = OUTPUT_PATH, options = {}) {
  const reference = await collectTokenReference(options);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(reference, null, 2) + '\n', 'utf8');
  return reference;
}

async function main() {
  const appIndex = process.argv.indexOf('--app');
  const appName = appIndex >= 0 && process.argv[appIndex + 1]
    ? process.argv[appIndex + 1]
    : DEFAULT_APP;
  const reference = await writeTokenReference(OUTPUT_PATH, { appName });
  console.log(`[generate-token-reference] Wrote ${reference.totalTokens} tokens to ${path.relative(ROOT, OUTPUT_PATH)}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
