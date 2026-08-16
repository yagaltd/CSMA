#!/usr/bin/env node
/**
 * check-artifacts.js — SEO/AEO artifact freshness gate.
 *
 * When project-manifest.json declares web.indexable and the public/ artifacts
 * (robots.txt, sitemap.xml, llms.txt) exist, their route/URL inventory must
 * match the manifest routes — preventing silent drift after route edits.
 *
 * Behavior:
 *   - artifacts absent  → WARN, exit 0 (generation is per-project opt-in;
 *                          run `npm run generate-project-artifacts` to create)
 *   - artifacts present but stale → FAIL, exit 1, listing drift
 *   - web.indexable false → expect robots.txt only if it exists; skip others
 *
 * The comparison reuses the exact generators from
 * tooling/scripts/generate-project-artifacts.js (imported, not duplicated), so
 * "fresh" always means byte-identical to a regeneration.
 *
 * Usage: npm run check:artifacts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRobotsTxt, buildSitemapXml, buildLlmsTxt } from './generate-project-artifacts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'project-manifest.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const artifacts = [
    { file: 'robots.txt', build: buildRobotsTxt, when: () => manifest.web?.enabled },
    { file: 'sitemap.xml', build: buildSitemapXml, when: () => manifest.web?.enabled && manifest.web?.indexable },
    { file: 'llms.txt', build: buildLlmsTxt, when: () => manifest.web?.enabled && manifest.web?.indexable }
];

const stale = [];
let missing = 0;
let checked = 0;

for (const artifact of artifacts) {
    if (!artifact.when()) continue;
    const target = path.join(PUBLIC_DIR, artifact.file);
    if (!fs.existsSync(target)) {
        missing += 1;
        console.warn(`[check:artifacts] WARN: public/${artifact.file} not generated yet (run \`npm run generate-project-artifacts\`)`);
        continue;
    }
    checked += 1;
    const expected = artifact.build(manifest);
    const actual = fs.readFileSync(target, 'utf8');
    if (actual !== expected) {
        stale.push(artifact.file);
        console.error(`[check:artifacts] FAIL: public/${artifact.file} is stale vs project-manifest.json`);
        console.error('  expected (regenerated) first divergence:');
        const eLines = expected.split('\n');
        const aLines = actual.split('\n');
        for (let i = 0; i < Math.max(eLines.length, aLines.length); i += 1) {
            if (eLines[i] !== aLines[i]) {
                console.error(`    line ${i + 1}: expected ${JSON.stringify(eLines[i] ?? '<eof>')} got ${JSON.stringify(aLines[i] ?? '<eof>')}`);
                break;
            }
        }
    }
}

if (stale.length) {
    console.error(`✗ Artifact freshness check failed: ${stale.join(', ')} drifted from project-manifest.json.`);
    console.error('  Fix: npm run generate-project-artifacts -- --force (refreshes public/ artifacts only; never hand-edit them).');
    process.exit(1);
}

console.log(`✓ Artifact freshness check passed (${checked} checked${missing ? `, ${missing} not yet generated` : ''}).`);
