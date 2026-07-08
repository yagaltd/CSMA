/**
 * CSMA Tile Manifest Parser Tests
 */
import { describe, it, expect } from 'vitest';
import { parseManifest, ErrorCode } from '../src/runtime/tile-manifest-parser.js';

// ── Valid fixture: agent-mailbox from Tile Protocol SKILL.md ──
const validMailbox = {
    app: 'agent-mailbox',
    version: '1.0.0',
    tiles: [
        {
            id: 'inbox',
            type: 'grid',
            label: 'Inbox',
            primary: true,
            mount: './tiles/inbox.js',
            spawns: ['reader', 'compose'],
        },
        {
            id: 'reader',
            type: 'viewer',
            label: 'Reader',
            mount: './tiles/reader.js',
            spawnable: true,
        },
        {
            id: 'compose',
            type: 'editor',
            label: 'Compose',
            mount: './tiles/compose.js',
            spawnable: true,
        },
    ],
    events: {
        listens: ['tile:focus', 'tile:close'],
        emits: ['tile:spawn', 'tile:data'],
    },
};

// ── Minimal valid fixture ──
const validMinimal = {
    app: 'minimal-app',
    version: '0.1.0',
    tiles: [
        {
            id: 'main',
            type: 'viewer',
            label: 'Main',
            primary: true,
            mount: './main.js',
        },
    ],
};

describe('ManifestParser — valid manifests', () => {
    it('should parse a complete valid manifest', () => {
        const result = parseManifest(validMailbox);
        expect(result.ok).toBe(true);
        const m = result.manifest;
        expect(m.app).toBe('agent-mailbox');
        expect(m.version).toBe('1.0.0');
        expect(m.primaryTileId).toBe('inbox');
        expect(Object.keys(m.tiles)).toHaveLength(3);
        expect(m.tiles.inbox.primary).toBe(true);
        expect(m.tiles.inbox.spawns).toEqual(['reader', 'compose']);
        expect(m.tiles.reader.spawnable).toBe(true);
        expect(m.events.listens).toEqual(['tile:focus', 'tile:close']);
        expect(m.events.emits).toEqual(['tile:spawn', 'tile:data']);
    });

    it('should parse a minimal manifest', () => {
        const result = parseManifest(validMinimal);
        expect(result.ok).toBe(true);
        expect(result.manifest.app).toBe('minimal-app');
        expect(result.manifest.primaryTileId).toBe('main');
        expect(Object.keys(result.manifest.tiles)).toHaveLength(1);
    });

    it('should accept a manifest without events', () => {
        const result = parseManifest({
            app: 'no-events',
            version: '1.0.0',
            tiles: [{ id: 'x', type: 'grid', label: 'X', primary: true, mount: './x.js' }],
        });
        expect(result.ok).toBe(true);
        expect(result.manifest.events.listens).toEqual([]);
        expect(result.manifest.events.emits).toEqual([]);
    });

    it('should set spawnable/spawns to defaults when not present', () => {
        const result = parseManifest(validMinimal);
        expect(result.ok).toBe(true);
        expect(result.manifest.tiles.main.spawnable).toBe(false);
        expect(result.manifest.tiles.main.spawns).toEqual([]);
    });

    it('should accept all known tile types', () => {
        for (const type of ['grid', 'viewer', 'editor', 'dashboard', 'config', 'media', 'nav', 'overlay', 'header', 'search', 'action']) {
            const result = parseManifest({
                app: 'test', version: '1.0',
                tiles: [{ id: 'x', type, label: 'X', primary: true, mount: './x.js' }],
            });
            expect(result.ok).toBe(true);
        }
    });
});

describe('ManifestParser — missing / invalid fields', () => {
    it('should reject non-object input', () => {
        const result = parseManifest('not-an-object');
        expect(result.ok).toBe(false);
        expect(result.errors[0].code).toBe(ErrorCode.INVALID_TYPE);
    });

    it('should reject null input', () => {
        const result = parseManifest(null);
        expect(result.ok).toBe(false);
    });

    it('should reject missing app', () => {
        const result = parseManifest({ version: '1.0', tiles: [] });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.MISSING_FIELD && e.path.endsWith('app'))).toBe(true);
    });

    it('should reject missing version', () => {
        const result = parseManifest({ app: 'test', tiles: [] });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.MISSING_FIELD && e.path.endsWith('version'))).toBe(true);
    });

    it('should reject empty string app', () => {
        const result = parseManifest({ app: '  ', version: '1.0', tiles: validMinimal.tiles });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.path === '.app')).toBe(true);
    });

    it('should reject missing tiles array', () => {
        const result = parseManifest({ app: 'test', version: '1.0' });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.MISSING_FIELD && e.path === 'tiles')).toBe(true);
    });

    it('should reject tiles that is not an array', () => {
        const result = parseManifest({ app: 'test', version: '1.0', tiles: 'nope' });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.INVALID_TYPE && e.path === 'tiles')).toBe(true);
    });

    it('should reject empty tiles array', () => {
        const result = parseManifest({ app: 'test', version: '1.0', tiles: [] });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.EMPTY_ARRAY)).toBe(true);
    });

    it('should reject tile with missing id', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ type: 'grid', label: 'X', primary: true, mount: './x.js' }],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.MISSING_FIELD && e.path.includes('id'))).toBe(true);
    });

    it('should reject tile with missing type', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', label: 'X', primary: true, mount: './x.js' }],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.path.includes('type'))).toBe(true);
    });

    it('should reject tile with missing label', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', type: 'grid', primary: true, mount: './x.js' }],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.path.includes('label'))).toBe(true);
    });

    it('should reject tile with missing mount', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', type: 'grid', label: 'X', primary: true }],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.path.includes('mount'))).toBe(true);
    });
});

describe('ManifestParser — tile type validation', () => {
    it('should reject unknown tile type', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', type: 'not-real', label: 'X', primary: true, mount: './x.js' }],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.UNKNOWN_TILE_TYPE)).toBe(true);
        expect(result.errors.some((e) => e.path.includes('type') && e.message.includes('not-real'))).toBe(true);
    });

    it('should reject empty string type', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', type: '  ', label: 'X', primary: true, mount: './x.js' }],
        });
        expect(result.ok).toBe(false);
    });
});

describe('ManifestParser — mount path validation', () => {
    it('should reject remote URLs', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', type: 'grid', label: 'X', primary: true, mount: 'https://evil.example/x.js' }],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.INVALID_MOUNT_PATH)).toBe(true);
    });

    it('should reject absolute paths', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', type: 'grid', label: 'X', primary: true, mount: '/absolute/path/x.js' }],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.INVALID_MOUNT_PATH)).toBe(true);
    });

    it('should reject traversal paths', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', type: 'grid', label: 'X', primary: true, mount: '../escape/x.js' }],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.INVALID_MOUNT_PATH)).toBe(true);
    });

    it('should reject javascript: pseudo-protocol', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', type: 'grid', label: 'X', primary: true, mount: 'javascript:alert(1)' }],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.INVALID_MOUNT_PATH)).toBe(true);
    });

    it('should reject paths without .js extension', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', type: 'grid', label: 'X', primary: true, mount: './tiles/x.ts' }],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.INVALID_MOUNT_PATH)).toBe(true);
    });

    it('should accept nested relative paths with .js', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', type: 'grid', label: 'X', primary: true, mount: './customization/tiles/inbox.js' }],
        });
        expect(result.ok).toBe(true);
    });
});

describe('ManifestParser — duplicate tile IDs', () => {
    it('should reject duplicate tile ids', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [
                { id: 'dup', type: 'grid', label: 'A', primary: true, mount: './a.js' },
                { id: 'dup', type: 'viewer', label: 'B', mount: './b.js' },
            ],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.DUPLICATE_TILE_ID)).toBe(true);
    });
});

describe('ManifestParser — primary tile', () => {
    it('should reject zero primary tiles', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [
                { id: 'a', type: 'grid', label: 'A', mount: './a.js' },
                { id: 'b', type: 'viewer', label: 'B', mount: './b.js' },
            ],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.NO_PRIMARY_TILE)).toBe(true);
    });

    it('should reject multiple primary tiles', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [
                { id: 'a', type: 'grid', label: 'A', primary: true, mount: './a.js' },
                { id: 'b', type: 'viewer', label: 'B', primary: true, mount: './b.js' },
            ],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.MULTIPLE_PRIMARY_TILES)).toBe(true);
    });
});

describe('ManifestParser — spawns references', () => {
    it('should reject spawns referencing unknown tile id', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [
                { id: 'main', type: 'grid', label: 'Main', primary: true, mount: './main.js', spawns: ['ghost'] },
            ],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.INVALID_SPAWN_REF)).toBe(true);
    });

    it('should reject spawns referencing non-spawnable tile', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [
                {
                    id: 'main', type: 'grid', label: 'Main', primary: true,
                    mount: './main.js', spawns: ['child'],
                },
                {
                    id: 'child', type: 'viewer', label: 'Child',
                    mount: './child.js', spawnable: false,
                },
            ],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.code === ErrorCode.INVALID_SPAWN_TARGET)).toBe(true);
    });

    it('should reject spawns that is not an array', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [
                { id: 'main', type: 'grid', label: 'Main', primary: true, mount: './main.js', spawns: 'not-array' },
            ],
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.path.includes('spawns') && e.code === ErrorCode.INVALID_TYPE)).toBe(true);
    });

    it('should accept valid spawns referencing spawnable tiles', () => {
        const result = parseManifest(validMailbox);
        expect(result.ok).toBe(true);
    });
});

describe('ManifestParser — events', () => {
    it('should reject events.listens that is not an array', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', type: 'grid', label: 'X', primary: true, mount: './x.js' }],
            events: { listens: 'not-array' },
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.path === 'events.listens')).toBe(true);
    });

    it('should reject events.emits that is not an array', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', type: 'grid', label: 'X', primary: true, mount: './x.js' }],
            events: { emits: 123 },
        });
        expect(result.ok).toBe(false);
        expect(result.errors.some((e) => e.path === 'events.emits')).toBe(true);
    });

    it('should filter out non-string event names', () => {
        const result = parseManifest({
            app: 'test', version: '1.0',
            tiles: [{ id: 'x', type: 'grid', label: 'X', primary: true, mount: './x.js' }],
            events: { listens: [123, 'tile:focus', null, 'tile:close'] },
        });
        // Non-strings cause type errors so validation fails
        expect(result.ok).toBe(false);
    });
});

describe('ManifestParser — error code stability', () => {
    it('should define all error codes', () => {
        expect(ErrorCode.MISSING_FIELD).toBe('MISSING_FIELD');
        expect(ErrorCode.INVALID_TYPE).toBe('INVALID_TYPE');
        expect(ErrorCode.DUPLICATE_TILE_ID).toBe('DUPLICATE_TILE_ID');
        expect(ErrorCode.NO_PRIMARY_TILE).toBe('NO_PRIMARY_TILE');
        expect(ErrorCode.MULTIPLE_PRIMARY_TILES).toBe('MULTIPLE_PRIMARY_TILES');
        expect(ErrorCode.INVALID_SPAWN_REF).toBe('INVALID_SPAWN_REF');
        expect(ErrorCode.INVALID_SPAWN_TARGET).toBe('INVALID_SPAWN_TARGET');
        expect(ErrorCode.EMPTY_ARRAY).toBe('EMPTY_ARRAY');
        expect(ErrorCode.UNKNOWN_TILE_TYPE).toBe('UNKNOWN_TILE_TYPE');
        expect(ErrorCode.INVALID_MOUNT_PATH).toBe('INVALID_MOUNT_PATH');
    });

    it('should include path and message in every error', () => {
        const result = parseManifest(null);
        expect(result.ok).toBe(false);
        expect(result.errors[0]).toHaveProperty('code');
        expect(result.errors[0]).toHaveProperty('path');
        expect(result.errors[0]).toHaveProperty('message');
    });
});
