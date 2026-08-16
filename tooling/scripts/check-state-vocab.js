#!/usr/bin/env node
/**
 * check-state-vocab.js — data-* state vocabulary drift check (advisory-first).
 *
 * The closest vanilla equivalent of a type check on the state channel:
 * extracts every data-* value JS WRITES (spec-tree dataset objects,
 * setAttribute('data-…', 'literal'), dataset.x = 'literal') and every value
 * CSS CONSUMES ([data-x="value"] selectors), then reports:
 *   - orphan writes  : JS writes a value no CSS selector consumes
 *   - orphan selectors: CSS styles a value nothing writes (typos)
 *
 * Mode (mirrors the contract-drift check):
 *   default                        — advisory: report + exit 0
 *   CSMA_ENFORCE_STATE_VOCAB=1     — fail (exit 1) on findings beyond baseline
 *   --write-baseline               — pin current findings to
 *                                    tooling/generated/state-vocab-baseline.json
 *
 * Attribute-only coverage: JS writing dataset keys with non-literal values
 * records the attribute (any value); a bare CSS [data-x] selector marks the
 * attribute consumed for all values. Static analysis only — no runtime cost.
 *
 * Usage: npm run check:state-vocab [-- --write-baseline]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(ROOT, 'tooling', 'generated', 'state-vocab-baseline.json');
const ENFORCE = process.env.CSMA_ENFORCE_STATE_VOCAB === '1';

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

const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

// ── JS writers ───────────────────────────────────────────────────────────

/** @returns {Map<'attr', Set<'value'|'*'>>} */
function scanJsWriters() {
    const writes = new Map(); // attr -> Set(values, '*' for any)
    const add = (attr, value) => {
        if (!/^[a-z][a-z0-9-]*$/.test(attr)) return;
        if (!writes.has(attr)) writes.set(attr, new Set());
        if (value !== null) writes.get(attr).add(value);
        else writes.get(attr).add('*');
    };
    for (const file of walk(path.join(ROOT, 'src'))) {
        if (!file.endsWith('.js')) continue;
        const src = fs.readFileSync(file, 'utf8');
        // 1. Spec-tree dataset objects: dataset: { state: 'loading', hasX: y }
        for (const m of src.matchAll(/dataset\s*:\s*\{([^}]*)\}/g)) {
            for (const p of m[1].matchAll(/([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(?:'([^']*)'|"([^"]*)"|[^,}]+)/g)) {
                const lit = p[2] ?? p[3] ?? null;
                add(kebab(p[1]), lit !== null && /^[a-z0-9-]+$/.test(lit) ? lit : null);
            }
        }
        // 2. setAttribute('data-x', 'lit') — literal or dynamic
        for (const m of src.matchAll(/setAttribute\(\s*['"]data-([a-z0-9-]+)['"]\s*,\s*('([^']*)'|"([^"]*)")?\s*\)/g)) {
            const lit = m[3] ?? m[4] ?? null;
            add(m[1], lit !== null && /^[a-z0-9-]+$/.test(lit) ? lit : null);
        }
        // 3. dataset.x = 'lit'
        for (const m of src.matchAll(/dataset\.([a-zA-Z][a-zA-Z0-9]*)\s*=\s*(?:'([^']*)'|"([^"]*)")/g)) {
            const lit = m[2] ?? m[3] ?? '';
            add(kebab(m[1]), /^[a-z0-9-]+$/.test(lit) ? lit : null);
        }
    }
    return writes;
}

// ── CSS consumers ────────────────────────────────────────────────────────

/** @returns {{ valued: Map<'attr=value', number>, bare: Set<'attr'> }} */
function scanCssConsumers() {
    const valued = new Map();
    const bare = new Set();
    for (const scope of ['src', 'showcase', 'demo'].map((d) => path.join(ROOT, d))) {
        for (const file of walk(scope)) {
            if (!file.endsWith('.css')) continue;
            const css = fs.readFileSync(file, 'utf8');
            for (const m of css.matchAll(/\[data-([a-z0-9-]+)(?:([\^\$\*\|~]?=)["']([a-z0-9-]+)["'])?\]/g)) {
                if (m[2]) {
                    const key = `${m[1]}=${m[3]}`;
                    valued.set(key, (valued.get(key) || 0) + 1);
                } else {
                    bare.add(m[1]);
                }
            }
        }
    }
    return { valued, bare };
}

// ── Diff ─────────────────────────────────────────────────────────────────

function diff(writes, { valued, bare }) {
    const orphanWrites = [];
    for (const [attr, values] of writes) {
        if (bare.has(attr)) continue; // bare selector consumes any value
        for (const value of values) {
            if (value === '*') continue; // dynamic value — cannot pin
            if (!valued.has(`${attr}=${value}`)) {
                orphanWrites.push(`${attr}="${value}"`);
            }
        }
    }
    const orphanSelectors = [];
    for (const key of valued.keys()) {
        const [attr, value] = key.split('=');
        const values = writes.get(attr);
        if (!values || (!values.has(value) && !values.has('*'))) {
            orphanSelectors.push(key);
        }
    }
    return { orphanWrites: orphanWrites.sort(), orphanSelectors: orphanSelectors.sort() };
}

const writes = scanJsWriters();
const consumers = scanCssConsumers();
const findings = diff(writes, consumers);

if (process.argv.includes('--write-baseline')) {
    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(findings, null, 2) + '\n', 'utf8');
    console.log(`[check:state-vocab] baseline written: ${findings.orphanWrites.length} orphan write(s), ${findings.orphanSelectors.length} orphan selector(s) → ${path.relative(ROOT, BASELINE_PATH)}`);
    process.exit(0);
}

const report = (label, list) => {
    console.log(`${label}: ${list.length}`);
    for (const item of list.slice(0, 20)) console.log(`  - ${item}`);
    if (list.length > 20) console.log(`  … +${list.length - 20} more`);
};
console.log('CSMA state-vocabulary check (advisory)');
report('JS writes with no CSS consumer', findings.orphanWrites);
report('CSS selectors with no JS writer', findings.orphanSelectors);

if (ENFORCE) {
    let baseline = { orphanWrites: [], orphanSelectors: [] };
    if (fs.existsSync(BASELINE_PATH)) {
        baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    }
    const newWrites = findings.orphanWrites.filter((x) => !baseline.orphanWrites.includes(x));
    const newSelectors = findings.orphanSelectors.filter((x) => !baseline.orphanSelectors.includes(x));
    if (newWrites.length || newSelectors.length) {
        console.error('✗ State-vocabulary drift beyond baseline:');
        for (const x of newWrites) console.error(`  - write: ${x}`);
        for (const x of newSelectors) console.error(`  - selector: ${x}`);
        process.exit(1);
    }
    console.log('✓ State-vocabulary drift within baseline.');
} else {
    console.log('(advisory — set CSMA_ENFORCE_STATE_VOCAB=1 to enforce against the baseline)');
}
