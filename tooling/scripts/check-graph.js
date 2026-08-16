#!/usr/bin/env node
/**
 * check-graph.js — dead-code import-graph gate.
 *
 * Walks every entry surface (demo/showcase/public HTML inline module scripts
 * and JS files, tests, tooling scripts, and every module index.js + contracts
 * file — the ModuleManager dynamic-import surface), follows relative imports
 * (static + dynamic string-literal), and fails on any src/ file that is not
 * reachable. Prevents re-accumulation of dead code (the audit that found 14
 * dead files, now enforced).
 *
 * Usage: npm run check:graph
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');

const walk = (dir, out = []) => {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
};

const resolveImport = (fromFile, specifier) => {
    let base;
    if (specifier.startsWith('/src/')) {
        base = path.join(ROOT, specifier.slice(1));
    } else if (specifier.startsWith('.')) {
        base = path.resolve(path.dirname(fromFile), specifier);
    } else {
        return null; // bare specifier (npm) — out of scope
    }
    for (const candidate of [base, `${base}.js`, `${base}.mjs`, path.join(base, 'index.js')]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
};

// ── Entries ──────────────────────────────────────────────────────────────
const entries = new Set();

// 1. HTML pages: demo/, showcase/, public/, and component preview pages
//    (*.demo.html under src/ui/components/) — copyable teaching surfaces.
for (const scope of [...['demo', 'showcase', 'public'].map((d) => path.join(ROOT, d)), path.join(ROOT, 'src', 'ui', 'components')]) {
    for (const file of walk(scope)) {
        if (!file.endsWith('.html')) continue;
        const html = fs.readFileSync(file, 'utf8');
        for (const m of html.matchAll(/(?:import|from)\s+['"](\.[^'"]+)['"]/g)) {
            const r = resolveImport(file, m[1]);
            if (r) entries.add(r);
        }
        for (const m of html.matchAll(/<script[^>]+src=["'](\.[^"']+)["']/g)) {
            const r = resolveImport(file, m[1]);
            if (r) entries.add(r);
        }
    }
}

// 2. JS files in demo/, showcase/, public/, tests/, tooling/
for (const scope of ['demo', 'showcase', 'public', 'tests', 'tooling'].map((d) => path.join(ROOT, d))) {
    for (const file of walk(scope)) {
        if (!file.endsWith('.js')) continue;
        const content = fs.readFileSync(file, 'utf8');
        for (const m of content.matchAll(/(?:import|from)\s+['"]((?:\.{1,2}\/|\/src\/)[^'"]+)['"]/g)) {
            const r = resolveImport(file, m[1]);
            if (r) entries.add(r);
        }
    }
}

// 3. ModuleManager dynamic-import surface: every module index.js + contracts file
for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file);
    if (/^modules[/\\][^/\\]+[/\\]index\.js$/.test(rel)) entries.add(file);
    if (/[/\\]contracts[/\\][^/\\]+\.js$/.test(rel)) entries.add(file);
}

// ── Reachability ─────────────────────────────────────────────────────────
// Static imports + dynamic string imports + Worker/URL asset references
// (new URL('...', import.meta.url) — how Workers and asset URLs are loaded).
const IMPORT_RE = /(?:import|from)\s+['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)|new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g;
const reachable = new Set();
const queue = [...entries].filter((f) => f.startsWith(SRC));
while (queue.length) {
    const file = queue.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    let content = '';
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
    for (const m of content.matchAll(IMPORT_RE)) {
        const spec = m[1] || m[2] || m[3];
        const r = resolveImport(file, spec);
        if (r && r.startsWith(SRC) && !reachable.has(r)) queue.push(r);
    }
}

// ── Verdict ──────────────────────────────────────────────────────────────
const srcFiles = walk(SRC).filter((f) => f.endsWith('.js') || f.endsWith('.mjs'));
const dead = srcFiles.filter((f) => !reachable.has(f)).map((f) => path.relative(ROOT, f)).sort();

if (dead.length) {
    console.error('✗ Import-graph check failed:');
    console.error(`  ${dead.length} unreachable src/ file(s):`);
    for (const f of dead) console.error(`  - ${f}`);
    console.error('  Delete them, or wire them (then document why in the file header).');
    process.exit(1);
}
console.log(`✓ Import-graph check passed: all ${srcFiles.length} src/ files reachable from entry surfaces.`);
