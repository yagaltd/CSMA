#!/usr/bin/env node
/**
 * check-seo-head.js — build-time SEO head gate for static-mpa mode.
 *
 * For every frontend HTML page (the static public routes), verifies the
 * head essentials that search engines and link previewers read first:
 *   - <title> present and 10–65 chars (seoAudit thresholds)
 *   - meta[name=description] present and non-empty
 *   - link[rel=canonical] present with an href
 *   - exactly one <h1>
 *
 * Skips gracefully (exit 0) when no frontend/ directory exists — the template
 * ships without one; projects in static-mpa mode create it.
 *
 * Usage: npm run check:seo-head
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const FRONTEND_DIR = path.join(ROOT, 'frontend');

const TITLE_MIN = 10;
const TITLE_MAX = 65;

const walk = (dir, out = []) => {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p, out);
        else if (entry.name.endsWith('.html')) out.push(p);
    }
    return out;
};

function headContent(html) {
    const match = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    return match ? match[1] : '';
}

function auditFile(file, html) {
    const problems = [];
    const head = headContent(html);

    const title = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
    if (!title) problems.push('missing <title>');
    else if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
        problems.push(`title length ${title.length} outside ${TITLE_MIN}-${TITLE_MAX}`);
    }

    const description = head.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0]
        ?.match(/content=["']([^"']*)["']/i)?.[1]?.trim() ?? '';
    if (!description) problems.push('missing meta[name=description]');

    const canonical = head.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0];
    if (!canonical || !/href=["'][^"']+["']/i.test(canonical)) {
        problems.push('missing link[rel=canonical] with href');
    }

    const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
    if (h1Count !== 1) problems.push(`h1 count ${h1Count} (expected 1)`);

    return problems;
}

if (!fs.existsSync(FRONTEND_DIR)) {
    console.log('✓ SEO head check skipped: no frontend/ directory (not in static-mpa mode).');
    process.exit(0);
}

const files = walk(FRONTEND_DIR);
if (!files.length) {
    console.log('✓ SEO head check skipped: frontend/ exists but contains no HTML pages.');
    process.exit(0);
}

let failures = 0;
for (const file of files) {
    const problems = auditFile(file, fs.readFileSync(file, 'utf8'));
    if (problems.length) {
        failures += 1;
        console.error(`✗ ${path.relative(ROOT, file)}:`);
        for (const p of problems) console.error(`    - ${p}`);
    }
}

if (failures) {
    console.error(`✗ SEO head check failed: ${failures}/${files.length} page(s) with head issues.`);
    process.exit(1);
}
console.log(`✓ SEO head check passed (${files.length} page(s)).`);
