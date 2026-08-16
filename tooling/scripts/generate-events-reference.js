#!/usr/bin/env node
/**
 * generate-events-reference.js — agent-facing events reference generator.
 *
 * Produces tooling/generated/events-reference.json (+ .md) mapping every
 * registered event name to its schema summary, rate limits, publishers, and
 * subscribers. Sources: the contracts registry (runtime facade + split
 * contracts + module contracts) and static publish/subscribe site scanning
 * (same regex family as the drift check in check-security.js).
 *
 * Deterministic: no timestamps, sorted keys — regeneration is idempotent.
 * Generated artifact: never hand-edit; rerun `npm run generate:events`.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'tooling', 'generated');
const OUT_JSON = path.join(OUT_DIR, 'events-reference.json');
const OUT_MD = path.join(OUT_DIR, 'events-reference.md');

const walk = (dir, out = []) => {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p, out);
        else if (entry.name.endsWith('.js')) out.push(p);
    }
    return out;
};

// ── 1. Collect the contracts registry ────────────────────────────────────

async function loadRegistry() {
    const registry = new Map(); // name -> { schema, security, source }

    const record = (name, def, source) => {
        if (typeof name !== 'string' || !/^[A-Z][A-Z0-9_:]*$/.test(name)) return;
        if (!registry.has(name)) {
            registry.set(name, {
                schema: def?.schema ?? null,
                security: def?.security ?? null,
                source
            });
        }
    };

    // Runtime facade (merged view) first.
    const facade = await import(pathToFileURL(path.join(ROOT, 'src/runtime/Contracts.js')).href);
    const Contracts = facade.Contracts || facade.default || facade;
    if (Contracts && typeof Contracts === 'object') {
        for (const [name, def] of Object.entries(Contracts)) record(name, def, 'runtime');
    }

    // Module contracts (ModuleManager merges these on load).
    const modulesRoot = path.join(ROOT, 'src', 'modules');
    for (const moduleDir of fs.readdirSync(modulesRoot, { withFileTypes: true })) {
        if (!moduleDir.isDirectory()) continue;
        const contractsDir = path.join(modulesRoot, moduleDir.name, 'contracts');
        if (!fs.existsSync(contractsDir)) continue;
        for (const f of fs.readdirSync(contractsDir)) {
            if (!f.endsWith('.js')) continue;
            const mod = await import(pathToFileURL(path.join(contractsDir, f)).href);
            const collection = Object.values(mod).find(
                (v) => v && typeof v === 'object' && !Array.isArray(v)
            );
            if (collection) {
                for (const [name, def] of Object.entries(collection)) {
                    record(name, def, `module:${moduleDir.name}`);
                }
            }
        }
    }
    return registry;
}

// ── 2. Scan publish + subscribe sites ────────────────────────────────────

function scanSites() {
    const publishers = new Map(); // name -> Set(relFile)
    const subscribers = new Map();
    const add = (map, name, file) => {
        if (!map.has(name)) map.set(name, new Set());
        map.get(name).add(path.relative(ROOT, file));
    };
    const scopes = [path.join(ROOT, 'src'), path.join(ROOT, 'demo')];
    for (const scope of scopes) {
        for (const file of walk(scope)) {
            const content = fs.readFileSync(file, 'utf8');
            for (const m of content.matchAll(/publish(?:Sync)?\?\.\(\s*['"]([A-Z][A-Z0-9_:]+)['"]/g)) {
                add(publishers, m[1], file);
            }
            for (const m of content.matchAll(/publish(?:Sync)?\(\s*['"]([A-Z][A-Z0-9_:]+)['"]/g)) {
                add(publishers, m[1], file);
            }
            for (const m of content.matchAll(/subscribe\??\.?\(\s*['"]([A-Z][A-Z0-9_:]+)['"]/g)) {
                add(subscribers, m[1], file);
            }
        }
    }
    return { publishers, subscribers };
}

// ── 3. Assemble + write ──────────────────────────────────────────────────

function schemaSummary(schema) {
    if (!schema || typeof schema !== 'object') return null;
    // Struct-style schemas: list field names + types without deep values.
    if (schema.type === 'object' && schema.properties) {
        const fields = {};
        for (const [k, v] of Object.entries(schema.properties)) {
            fields[k] = typeof v?.type === 'string' ? v.type : 'any';
        }
        return { fields, required: schema.required ?? [] };
    }
    if (schema.fields) {
        return { fields: Object.keys(schema.fields), required: schema.required ?? [] };
    }
    // Fallback: shallow type descriptors only (no values).
    return { shape: 'custom' };
}

function buildReference(registry, { publishers, subscribers }) {
    const events = {};
    const names = [...new Set([...registry.keys(), ...publishers.keys()])].sort();
    for (const name of names) {
        const def = registry.get(name) || {};
        events[name] = {
            registered: registry.has(name),
            source: def.source ?? null,
            schema: schemaSummary(def.schema),
            rateLimits: def.security?.rateLimits ?? null,
            publishers: [...(publishers.get(name) || [])].sort(),
            subscribers: [...(subscribers.get(name) || [])].sort()
        };
    }
    return {
        schemaVersion: 1,
        counts: {
            total: names.length,
            registered: registry.size,
            withPublishers: publishers.size
        },
        events
    };
}

function renderMarkdown(ref) {
    const lines = [
        '# CSMA Events Reference (generated)',
        '',
        'Regenerate: `npm run generate:events`. Never hand-edit.',
        '',
        `Total event names: **${ref.counts.total}** (registered: ${ref.counts.registered}).`,
        '',
        '| Event | Registered | Source | Rate limits | Publishers | Subscribers |',
        '|---|---|---|---|---|---|'
    ];
    for (const [name, e] of Object.entries(ref.events)) {
        const rl = e.rateLimits
            ? (e.rateLimits.requests ?? '?') + '/' + (e.rateLimits.windowMs ?? '?') + 'ms'
            : '-';
        const pub = e.publishers.length ? e.publishers.length + ' file(s)' : '-';
        const sub = e.subscribers.length ? e.subscribers.length + ' file(s)' : '-';
        lines.push(`| \`${name}\` | ${e.registered ? 'yes' : '**NO**'} | ${e.source ?? '-'} | ${rl} | ${pub} | ${sub} |`);
    }
    lines.push('');
    return lines.join('\n');
}

const registry = await loadRegistry();
const sites = scanSites();
const reference = buildReference(registry, sites);

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_JSON, JSON.stringify(reference, null, 2) + '\n', 'utf8');
await writeFile(OUT_MD, renderMarkdown(reference), 'utf8');

console.log(`[generate:events] ${reference.counts.total} events (${reference.counts.registered} registered) → ${path.relative(ROOT, OUT_JSON)} + .md`);
