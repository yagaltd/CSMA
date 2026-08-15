/**
 * CSMA production security checker.
 *
 * Run: npm run security-check
 *
 * Also hosts the Phase 0 publish-vs-registry contract drift check:
 *   - advisory by default (warns, exits 0)
 *   - CSMA_ENFORCE_CONTRACTS=1 turns drift into a hard failure
 *   - --write-baseline pins the current drift list to
 *     tooling/generated/contract-drift-baseline.json (generated artifact,
 *     never hand-edit; regenerate with the flag)
 */

import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, relative, resolve } from 'path';

/**
 * Pass/fail switch for the contract drift check (plan item 0.1).
 * Advisory by default: drift is reported as a WARN and the script exits 0.
 * Set CSMA_ENFORCE_CONTRACTS=1 in the environment (Phase 1 flips the
 * default) to turn drift into a FAIL with exit code 1.
 */
const ENFORCE_CONTRACTS_DEFAULT = true;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

function read(relativePath) {
    return fs.readFileSync(join(projectRoot, relativePath), 'utf8');
}

function walk(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', 'dist', 'build', '.git'].includes(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, files);
        } else if (/\.(js|html|css)$/.test(entry.name)) {
            files.push(full);
        }
    }
    return files;
}

const PUBLISH_CALL_RE = /(?<![\w$])_?publish(Sync)?\s*\(\s*['"]([^'"]+)['"]/g;

/**
 * Extract the event names of literal publish('NAME') / publishSync('NAME')
 * calls from one JS source file.
 *
 * Deliberate limitations (kept per plan item 0.1):
 * - Dynamic publishes (publish(name) with a variable) are NOT scanned — a
 *   regex cannot resolve them. They are skipped, not errors.
 * - Backtick/template names and computed names are skipped the same way.
 * - `_publish('NAME')` is included: the found occurrences are private
 *   wrappers that forward to EventBus.publish, so they are publish sites.
 *
 * @param {string} content
 * @returns {Array<{ name: string, method: string }>}
 */
export function scanPublishCalls(content) {
    const sites = [];
    for (const match of content.matchAll(PUBLISH_CALL_RE)) {
        sites.push({ name: match[2].trim(), method: match[1] ? `publish${match[1]}` : 'publish' });
    }
    return sites;
}

/**
 * Aggregate publish-site name counts across file contents.
 * @param {string[]} fileContents
 * @returns {Map<string, number>} event name -> occurrence count
 */
export function collectPublishedNames(fileContents) {
    const counts = new Map();
    for (const content of fileContents) {
        for (const { name } of scanPublishCalls(content)) {
            counts.set(name, (counts.get(name) || 0) + 1);
        }
    }
    return counts;
}

/**
 * Diff published names against the registered set.
 * @param {Map<string, number>} publishedCounts
 * @param {Set<string>} registeredNames
 * @returns {{ unregistered: Record<string, number>, distinctUnregistered: number, totalOccurrences: number }}
 */
export function findContractDrift(publishedCounts, registeredNames) {
    const unregistered = {};
    let distinctUnregistered = 0;
    let totalOccurrences = 0;
    for (const [name, count] of publishedCounts) {
        if (registeredNames.has(name)) continue;
        unregistered[name] = count;
        distinctUnregistered += 1;
        totalOccurrences += count;
    }
    return { unregistered, distinctUnregistered, totalOccurrences };
}

function hasAnyStruct(struct, seen = new Set()) {
    if (!struct || typeof struct !== 'object' || seen.has(struct)) return false;
    seen.add(struct);
    if (struct.type === 'any') return true;
    if (struct.schema && typeof struct.schema === 'object') {
        return Object.values(struct.schema).some((child) => hasAnyStruct(child, seen));
    }
    return hasAnyStruct(struct.schema, seen);
}

function checkCsp() {
    const html = read('demo/index.html');
    const match = html.match(/Content-Security-Policy[^>]*content="([^"]*)"/);
    const csp = match?.[1] || '';
    const required = ["default-src 'self'", "script-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "connect-src 'self'"];
    const missing = required.filter((directive) => !csp.includes(directive));
    return {
        name: 'strict CSP template',
        pass: Boolean(match) && missing.length === 0 && !/script-src[^;]*'unsafe-inline'/.test(csp),
        message: missing.length ? `missing ${missing.join(', ')}` : 'strict CSP present'
    };
}

const DOM_SINK_RE = /\.(innerHTML|outerHTML)|insertAdjacentHTML\s*\(/;

/**
 * True when a file contains a real DOM sink outside comments and typeof
 * capability probes.
 *
 * False positives this filters (both occur in
 * src/modules/slides/engine/thumbnails.js):
 *   - pure comment lines (a docstring mention of outerHTML)
 *   - typeof guards (`typeof slideEl.outerHTML !== 'string'`) — reading a
 *     property inside typeof is a capability probe, not a write
 *
 * Known limitation (documented per plan convention): a sink name inside a
 * string literal, or in a trailing comment on a code line, still counts as a
 * sink. The allowlist in checkDomSinks covers the two approved writers.
 */
function contentHasRealDomSink(content) {
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
        // Strip typeof probes (identifier/member expression, optionally
        // compared against a literal) before matching sinks.
        const code = line.replace(/typeof\s+[\w$][\w$.[\]()'"`-]*\s*(?:!==?|===?)\s*['"][^'"]*['"]/g, '');
        if (DOM_SINK_RE.test(code)) return true;
    }
    return false;
}

function checkDomSinks() {
    const allowed = new Set([
        'src/utils/sanitize.js',
        'src/ui/components/toast/toast.js'
    ]);
    const offenders = walk(join(projectRoot, 'src'))
        .map((file) => [relative(projectRoot, file), fs.readFileSync(file, 'utf8')])
        .filter(([file, content]) => !allowed.has(file) && contentHasRealDomSink(content))
        .map(([file]) => file);
    return {
        name: 'unsafe DOM sinks',
        pass: offenders.length === 0,
        message: offenders.length ? offenders.join(', ') : 'no unapproved HTML sinks in src'
    };
}

/**
 * Plan item 3.2 — console.log is banned in src/ (allowlist is empty by
 * design; demos are teaching material and are not scanned). U2 owns the
 * sweep of remaining call sites.
 */
function checkConsoleLogs() {
    const allowed = new Set([]);
    const offenders = walk(join(projectRoot, 'src'))
        .map((file) => [relative(projectRoot, file), fs.readFileSync(file, 'utf8')])
        .filter(([file, content]) => !allowed.has(file) && /console\.log\s*\(/.test(content))
        .map(([file]) => file);
    return {
        name: 'console.log ban',
        pass: offenders.length === 0,
        message: offenders.length ? offenders.join(', ') : 'no console.log calls in src'
    };
}

function checkTokenStorage() {
    const offenders = walk(projectRoot)
        .map((file) => [relative(projectRoot, file), fs.readFileSync(file, 'utf8')])
        .filter(([file]) => !file.startsWith('tests/'))
        .filter(([, content]) => /accessToken\s*:\s*['"](localStorage|sessionStorage)['"]/.test(content) && !/securityProfile\s*:\s*['"]development['"]/.test(content))
        .map(([file]) => file);
    return {
        name: 'production token storage',
        pass: offenders.length === 0,
        message: offenders.length ? offenders.join(', ') : 'persistent access-token storage requires development profile'
    };
}

export async function loadContractCollections() {
    const collections = [];
    const { Contracts } = await import(pathToFileURL(join(projectRoot, 'src/runtime/Contracts.js')).href);
    collections.push({ source: 'src/runtime/Contracts.js', contracts: Contracts });

    const modulesRoot = join(projectRoot, 'src/modules');
    for (const entry of fs.readdirSync(modulesRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const contractsDir = join(modulesRoot, entry.name, 'contracts');
        if (!fs.existsSync(contractsDir)) continue;

        for (const file of fs.readdirSync(contractsDir)) {
            if (!file.endsWith('-contracts.js')) continue;
            const relative = relativeFromRoot(join(contractsDir, file));
            const mod = await import(pathToFileURL(join(contractsDir, file)).href);
            const merged = mergeContractExports(mod);
            if (Object.keys(merged).length === 0) continue;
            collections.push({ source: relative, contracts: merged });
        }
    }

    // Phase 6.3 — runtime contract groups moved from Contracts.js into
    // src/runtime/contracts/*.js (Contracts.js is now the merge facade).
    // Walk the same shape the module walk above uses so the drift check
    // still sees every runtime-owned event name.
    const runtimeContractsDir = join(projectRoot, 'src/runtime/contracts');
    if (fs.existsSync(runtimeContractsDir)) {
        for (const file of fs.readdirSync(runtimeContractsDir)) {
            if (!file.endsWith('-contracts.js')) continue;
            const relative = relativeFromRoot(join(runtimeContractsDir, file));
            const mod = await import(pathToFileURL(join(runtimeContractsDir, file)).href);
            const merged = mergeContractExports(mod);
            if (Object.keys(merged).length === 0) continue;
            collections.push({ source: relative, contracts: merged });
        }
    }

    return collections;
}

/**
 * A contracts file may export more than one plain object
 * (share-contracts.js exports ShareContracts + SHARE_LIMITS).
 * Merge every contract-shaped export (any entry whose value has
 * type 'event' | 'intent') so registered names in helper exports
 * are not missed; fall back to the first plain object export if
 * nothing looks contract-shaped.
 */
function mergeContractExports(mod) {
    const records = Object.values(mod).filter((value) => value && typeof value === 'object' && !Array.isArray(value));
    const contractShaped = records.filter((record) => Object.values(record).some((entry) => entry?.type === 'event' || entry?.type === 'intent'));
    return Object.assign({}, ...(contractShaped.length ? contractShaped : records.slice(0, 1)));
}

function relativeFromRoot(fullPath) {
    return relative(projectRoot, fullPath);
}

function normalizeRateLimitsForCheck(rateLimits) {
    if (!rateLimits) {
        return { requests: 60, windowMs: 60000, scope: 'session' };
    }
    if (Number.isFinite(rateLimits.requests)) {
        return {
            requests: rateLimits.requests,
            windowMs: rateLimits.windowMs ?? rateLimits.window,
            scope: rateLimits.scope || 'session'
        };
    }
    return Object.fromEntries(Object.entries(rateLimits).map(([name, limits]) => [
        name,
        {
            requests: limits.requests,
            windowMs: limits.windowMs ?? limits.window,
            scope: limits.scope || name.replace(/^per/, '').toLowerCase() || 'session'
        }
    ]));
}

function isCanonicalRateLimits(limits) {
    const entries = Number.isFinite(limits?.requests) ? [limits] : Object.values(limits || {});
    if (entries.length === 0) return false;
    return entries.every((limit) => (
        Number.isFinite(limit?.requests)
        && Number.isFinite(limit?.windowMs)
        && Boolean(limit?.scope)
    ));
}

async function checkContracts() {
    const collections = await loadContractCollections();
    const missingRateLimits = [];
    const broadPublicSchemas = [];

    for (const { source, contracts } of collections) {
        for (const [name, contract] of Object.entries(contracts)) {
            if (!contract || contract.type !== 'intent') continue;

            const label = `${name}@${source}`;
            const normalized = normalizeRateLimitsForCheck(contract.security?.rateLimits);
            if (!isCanonicalRateLimits(normalized)) {
                missingRateLimits.push(label);
            }

            if (contract.compliance === 'public' && hasAnyStruct(contract.schema) && !contract.unsafeInternal) {
                broadPublicSchemas.push(label);
            }
        }
    }

    return {
        name: 'contracts',
        pass: missingRateLimits.length === 0 && broadPublicSchemas.length === 0,
        message: [
            missingRateLimits.length ? `missing/corrupt rate limits: ${missingRateLimits.join(', ')}` : 'all intents have canonical rate limits',
            broadPublicSchemas.length ? `broad public schemas: ${broadPublicSchemas.join(', ')}` : 'no unmarked broad public intent schemas'
        ].join('; ')
    };
}

function checkCachePolicy() {
    const sw = read('public/sw.js');
    const required = ['/api/', '/auth/', '/forms/', '/media/', '/logs/', '/optimistic/', '/query/', '/admin/', '/internal/'];
    const missing = required.filter((prefix) => !sw.includes(`'${prefix}'`));
    return {
        name: 'offline cache denylist',
        pass: missing.length === 0,
        message: missing.length ? `missing ${missing.join(', ')}` : 'sensitive route prefixes are denied'
    };
}

function checkSensitiveStorage() {
    const pattern = /(localStorage|sessionStorage)\.setItem\([^)]*(token|secret|password|credential|authorization)/i;
    const offenders = walk(join(projectRoot, 'src'))
        .map((file) => [relative(projectRoot, file), fs.readFileSync(file, 'utf8')])
        .filter(([file, content]) => file !== 'modules/auth/services/AuthService.js' && pattern.test(content))
        .map(([file]) => file);
    return {
        name: 'sensitive storage patterns',
        pass: offenders.length === 0,
        message: offenders.length ? offenders.join(', ') : 'no forbidden sensitive storage writes'
    };
}

const checks = [
    checkCsp,
    checkDomSinks,
    checkConsoleLogs,
    checkTokenStorage,
    checkContracts,
    checkCachePolicy,
    checkSensitiveStorage
];

/**
 * Phase 0.1 — publish-vs-registry contract drift.
 *
 * Walks src/ (NOT demo/ — demos are teaching material, per plan decision D2)
 * for literal publish('NAME') / publishSync('NAME') call sites, collects the
 * registered names via loadContractCollections(), and reports names that are
 * published but never registered (EventBus silently drops those).
 */
export async function checkContractDrift() {
    const collections = await loadContractCollections();
    const registered = new Set();
    for (const { contracts } of collections) {
        for (const name of Object.keys(contracts)) registered.add(name);
    }

    const fileContents = walk(join(projectRoot, 'src'))
        .filter((file) => file.endsWith('.js'))
        .map((file) => fs.readFileSync(file, 'utf8'));
    const published = collectPublishedNames(fileContents);
    const drift = findContractDrift(published, registered);

    return {
        name: 'contract drift (publish vs registry)',
        ...drift,
        registeredCount: registered.size,
        publishedCount: published.size
    };
}

/**
 * Phase 0.2 — pin the current drift list to
 * tooling/generated/contract-drift-baseline.json. Generated artifact:
 * never hand-edit; regenerate with --write-baseline. Phase 1 deletes it.
 */
export function writeContractDriftBaseline(drift) {
    const sortedNames = Object.entries(drift.unregistered)
        .sort(([aName, aCount], [bName, bCount]) => bCount - aCount || aName.localeCompare(bName));
    const baseline = {
        description: [
            'Generated contract-drift baseline (plan item 0.2).',
            'Produced by: node tooling/scripts/check-security.js --write-baseline.',
            'Do not hand-edit; regenerate with the same flag. Phase 1 deletes this file.'
        ].join(' '),
        generatedAt: new Date().toISOString(),
        distinctUnregisteredNames: drift.distinctUnregistered,
        totalOccurrences: drift.totalOccurrences,
        unregistered: Object.fromEntries(sortedNames)
    };
    const targetDir = join(projectRoot, 'tooling', 'generated');
    fs.mkdirSync(targetDir, { recursive: true });
    const target = join(targetDir, 'contract-drift-baseline.json');
    fs.writeFileSync(target, `${JSON.stringify(baseline, null, 2)}\n`);
    return target;
}

async function main() {
    if (process.argv.includes('--write-baseline')) {
        const drift = await checkContractDrift();
        const target = writeContractDriftBaseline(drift);
        console.log(`Wrote ${relativeFromRoot(target)}: ${drift.distinctUnregistered} distinct unregistered names, ${drift.totalOccurrences} publish sites.`);
        return; // snapshot mode is advisory and never fails
    }

    console.log('\nCSMA Production Security Check\n');

    let allPassed = true;
    for (const check of checks) {
        const result = await check();
        allPassed &&= result.pass;
        console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}`);
        console.log(`  ${result.message}`);
    }

    const drift = await checkContractDrift();
    const enforce = process.env.CSMA_ENFORCE_CONTRACTS === '1' || ENFORCE_CONTRACTS_DEFAULT;
    if (drift.distinctUnregistered === 0) {
        console.log(`PASS ${drift.name}`);
        console.log(`  all ${drift.publishedCount} published event names are registered`);
    } else if (enforce) {
        allPassed = false;
        console.log(`FAIL ${drift.name}`);
        console.log(`  ${drift.distinctUnregistered} unregistered event names / ${drift.totalOccurrences} publish sites:`);
        for (const [name, count] of Object.entries(drift.unregistered).sort(([aName, aCount], [bName, bCount]) => bCount - aCount || aName.localeCompare(bName))) {
            console.log(`    ${name} (x${count})`);
        }
    } else {
        console.log(`WARN ${drift.name} — advisory; set CSMA_ENFORCE_CONTRACTS=1 to fail on drift`);
        console.log(`  ${drift.distinctUnregistered} unregistered event names / ${drift.totalOccurrences} publish sites:`);
        for (const [name, count] of Object.entries(drift.unregistered).sort(([aName, aCount], [bName, bCount]) => bCount - aCount || aName.localeCompare(bName))) {
            console.log(`    ${name} (x${count})`);
        }
        console.log('  (dynamic publishes — publish(variable) — are skipped by design; see scanPublishCalls comment)');
    }

    if (!allPassed) {
        console.log('\nSecurity check failed. Fix these issues before production deployment.\n');
        process.exit(1);
    }

    console.log('\nAll production security checks passed.\n');
}

const isDirectInvocation = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isDirectInvocation) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
