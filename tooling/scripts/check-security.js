/**
 * CSMA production security checker.
 *
 * Run: npm run security-check
 */

import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join, relative } from 'path';

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

function checkDomSinks() {
    const allowed = new Set([
        'src/utils/sanitize.js',
        'src/ui/components/toast/toast.js'
    ]);
    const offenders = walk(join(projectRoot, 'src'))
        .map((file) => [relative(projectRoot, file), fs.readFileSync(file, 'utf8')])
        .filter(([file, content]) => !allowed.has(file) && /\.(innerHTML|outerHTML)|insertAdjacentHTML\s*\(/.test(content))
        .map(([file]) => file);
    return {
        name: 'unsafe DOM sinks',
        pass: offenders.length === 0,
        message: offenders.length ? offenders.join(', ') : 'no unapproved HTML sinks in src'
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

async function loadContractCollections() {
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
            const record = Object.values(mod).find((value) => value && typeof value === 'object' && !Array.isArray(value));
            if (!record) continue;
            collections.push({ source: relative, contracts: record });
        }
    }

    return collections;
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
    checkTokenStorage,
    checkContracts,
    checkCachePolicy,
    checkSensitiveStorage
];

console.log('\nCSMA Production Security Check\n');

let allPassed = true;
for (const check of checks) {
    const result = await check();
    allPassed &&= result.pass;
    console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name}`);
    console.log(`  ${result.message}`);
}

if (!allPassed) {
    console.log('\nSecurity check failed. Fix these issues before production deployment.\n');
    process.exit(1);
}

console.log('\nAll production security checks passed.\n');
