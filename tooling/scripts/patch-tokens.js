#!/usr/bin/env node
/**
 * CSMA Design Token Patcher
 *
 * Reads a shallow override file with dot-notation paths and deep-merges
 * into src/style/design-tokens.json. Then regenerates CSS.
 *
 * Override file values use dot-notation paths into the DTCG token tree:
 *   {
 *     "primitives.typography.fontFamily.base.$value": "\"Manrope\", system-ui, sans-serif",
 *     "themes.light.colors.primary.$value": { "colorSpace": "srgb", "components": [0.357, 0.204, 0.463] },
 *     "themes.light.colors.primary.$description": "Industrial Violet #5B3476"
 *   }
 *
 * Usage:
 *   node tooling/scripts/patch-tokens.js [overrides-file]
 *   node tooling/scripts/patch-tokens.js src/style/brand-overrides.json
 *
 * If no file is given, defaults to src/style/token-overrides.json.
 * After patching, automatically runs token generation.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const TOKENS_PATH = join(ROOT, 'src', 'style', 'design-tokens.json');
const DEFAULT_OVERRIDES = join(ROOT, 'src', 'style', 'token-overrides.json');

function setDeep(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let index = 0; index < keys.length - 1; index += 1) {
        const key = keys[index];
        if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
            current[key] = {};
        }
        current = current[key];
    }

    current[keys[keys.length - 1]] = value;
}

function getDeep(obj, path) {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
        if (current == null || typeof current !== 'object') {
            return undefined;
        }
        current = current[key];
    }

    return current;
}

function formatPath(path) {
    return path
        .replace(/\.\$value$/, '')
        .replace(/\.\$description$/, '')
        .replace(/\.\$type$/, '')
        .replace(/\./g, ' -> ');
}

const overridesPath = process.argv[2] || DEFAULT_OVERRIDES;

console.log('CSMA Design Token Patcher');
console.log('-'.repeat(40));

if (!existsSync(overridesPath)) {
    console.error(`Override file not found: ${overridesPath}`);
    console.error('Create one with dot-notation paths, e.g.:');
    console.error(JSON.stringify({
        'primitives.typography.fontFamily.base.$value': '"Manrope", system-ui, sans-serif',
        'themes.light.colors.primary.$value': { colorSpace: 'srgb', components: [0.357, 0.204, 0.463] },
        'themes.light.colors.primary.$description': 'Industrial Violet #5B3476'
    }, null, 2));
    process.exit(1);
}

if (!existsSync(TOKENS_PATH)) {
    console.error(`Token file not found: ${TOKENS_PATH}`);
    process.exit(1);
}

const tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf-8'));
const overrides = JSON.parse(readFileSync(overridesPath, 'utf-8'));
const entries = Object.entries(overrides);

if (entries.length === 0) {
    console.log('No overrides found. Nothing to patch.');
    process.exit(0);
}

let patched = 0;
let created = 0;

for (const [path, value] of entries) {
    const existing = getDeep(tokens, path);
    if (existing === undefined) {
        created += 1;
    } else {
        patched += 1;
    }

    setDeep(tokens, path, value);

    const action = existing === undefined ? '+ create' : '~ patch ';
    console.log(`  ${action}  ${formatPath(path)}`);
}

writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2) + '\n');

console.log('-'.repeat(40));
console.log(`Applied ${patched} patches, ${created} new paths`);

console.log('\nRegenerating CSS tokens...');
try {
    execSync(`node "${join(__dirname, 'generate-tokens.js')}"`, {
        cwd: ROOT,
        stdio: 'inherit'
    });
} catch (error) {
    console.error('Token generation failed. Run `npm run tokens` manually.');
    process.exit(1);
}

console.log('\nDone. Token patch + regeneration complete.');
