/**
 * CSMA Genericity Guardrail Tests
 *
 * Prevent regressions that reintroduce demo-specific behavior into
 * the generic framework runtime.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { createRuntimeState, CORE_SERVICE_NAMES } from '../src/runtime/bootstrap.js';
import { Contracts } from '../src/runtime/Contracts.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(repoRoot, 'src');
const sourceExtensions = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.json', '.md']);

const coreServiceNames = [
    'leader',
    'platform',
    'channels',
    'metaManager',
    'pageResolver',
    'clientNavigation',
    'commandRegistry',
    'navigationRegistry',
    'panelRegistry',
    'adapterRegistry',
    'viewRegistry'
];

const defaultDemoContracts = [
    'ITEM_SAVED',
    'ITEM_STATUS_CHANGED',
    'INTENT_CREATE_ITEM',
    'EXAMPLE_MODULE_EVENT',
    'EXAMPLE_MODULE_VIEW_RENDERED'
];

const bannedProductionTerms = [
    { name: 'ExampleService', pattern: /\bExampleService\b/i },
    { name: 'example-module', pattern: /\bexample-module\b/i },
    { name: 'local-fallback', pattern: /\blocal-fallback\b/i },
    { name: 'ITEM_SAVED', pattern: /\bITEM_SAVED\b/ },
    { name: 'ITEM_STATUS_CHANGED', pattern: /\bITEM_STATUS_CHANGED\b/ },
    { name: 'INTENT_CREATE_ITEM', pattern: /\bINTENT_CREATE_ITEM\b/ },
    { name: 'morphshell', pattern: /\bmorphshell\b/i }
];

const safeProductionCommentAllowlist = [];

function productionSourceFiles(dir = srcRoot) {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return productionSourceFiles(fullPath);
        }
        if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name))) {
            return [];
        }
        return [fullPath];
    });
}

function isSafeAllowedComment(relativePath, term, line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')) {
        return false;
    }
    return safeProductionCommentAllowlist.some((allowed) =>
        allowed.relativePath === relativePath &&
        allowed.term === term &&
        line.includes(allowed.text)
    );
}

function findBannedProductionMentions() {
    return productionSourceFiles().flatMap((filePath) => {
        const relativePath = path.relative(repoRoot, filePath);
        return readFileSync(filePath, 'utf8')
            .split(/\r?\n/)
            .flatMap((line, index) => {
                const hits = bannedProductionTerms.filter(({ name, pattern }) =>
                    pattern.test(line) && !isSafeAllowedComment(relativePath, name, line)
                );
                return hits.map(({ name }) => `${relativePath}:${index + 1} contains ${name}`);
            });
    });
}

// ─── Bootstrap Guards ───────────────────────────────────────────────────

describe('Bootstrap guardrails', () => {
    it('does not keep a production ExampleService file', () => {
        expect(existsSync(path.join(srcRoot, 'services', 'ExampleService.js'))).toBe(false);
    });

    it('registers the generic core service set without an example service', () => {
        expect([...CORE_SERVICE_NAMES].sort()).toEqual([...coreServiceNames].sort());

        const state = createRuntimeState();
        expect(state.serviceManager.get('example')).toBeNull();
        expect(state.serviceManager.get('viewRegistry')).toBe(state.registries.views);
    });

    it('does not import or register ExampleService in runtime bootstrap', () => {
        const bootstrapSource = readFileSync(path.join(srcRoot, 'runtime', 'bootstrap.js'), 'utf8');

        expect(bootstrapSource).not.toMatch(/\bExampleService\b/);
        expect(bootstrapSource).not.toMatch(/register\(\s*['"]example['"]/);
    });
});

// ─── Contract Guards ────────────────────────────────────────────────────

describe('Contract guardrails', () => {
    it('keeps demo item and example-module events out of default Contracts', () => {
        for (const name of defaultDemoContracts) {
            expect(Contracts).not.toHaveProperty(name);
        }
        expect(Object.keys(Contracts).filter((name) => name.startsWith('EXAMPLE_'))).toEqual([]);
    });

    it('still exposes generic runtime contracts after demo cleanup', () => {
        expect(Contracts).toHaveProperty('THEME_CHANGED');
        expect(Contracts).toHaveProperty('INTENT_VIEW_RENDER');
        expect(Contracts.INTENT_VIEW_RENDER.owner).not.toBe('example-module');
    });
});

// ─── Demo Contract Guards ───────────────────────────────────────────────

describe('Demo example-module contracts', () => {
    it('validates explicit demo example event payloads', async () => {
        const { ExampleModuleContracts } = await import('../demo/modules/example-module/contracts/example-contracts.js');
        const payload = {
            id: 'example-module',
            message: 'Demo module handled an action',
            timestamp: 1700000000000
        };

        const [error, validated] = ExampleModuleContracts.EXAMPLE_MODULE_EVENT.schema.validate(payload);
        const [missingMessageError] = ExampleModuleContracts.EXAMPLE_MODULE_EVENT.schema.validate({
            id: 'example-module',
            timestamp: payload.timestamp
        });

        expect(error).toBeUndefined();
        expect(validated).toEqual(payload);
        expect(missingMessageError).toBeDefined();
    });

    it('validates explicit demo example view-rendered payloads', async () => {
        const { ExampleModuleContracts } = await import('../demo/modules/example-module/contracts/example-contracts.js');
        const payload = {
            id: 'example-module',
            viewId: 'example-module.status-card',
            target: '#example-module-panel',
            title: 'Demo status',
            message: 'Rendered from the demo extension module',
            tone: 'info',
            timestamp: 1700000000001
        };

        const [error, validated] = ExampleModuleContracts.EXAMPLE_MODULE_VIEW_RENDERED.schema.validate(payload);
        const [missingTargetError] = ExampleModuleContracts.EXAMPLE_MODULE_VIEW_RENDERED.schema.validate({
            ...payload,
            target: undefined
        });

        expect(error).toBeUndefined();
        expect(validated).toEqual(payload);
        expect(missingTargetError).toBeDefined();
    });
});

// ─── Source Scan Guard ───────────────────────────────────────────────────

describe('Source scan guardrails', () => {
    it('keeps demo cleanup banned terms out of production src except narrow safe comments', () => {
        expect(findBannedProductionMentions()).toEqual([]);
    });

    it('does not scan an empty or missing production source tree', () => {
        expect(statSync(srcRoot).isDirectory()).toBe(true);
        expect(productionSourceFiles().length).toBeGreaterThan(0);
    });
});
