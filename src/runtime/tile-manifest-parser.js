/**
 * CSMA Tile Protocol — Manifest Parser
 *
 * Validates and normalizes `tiles-manifest.json` files per the Tile Protocol
 * specification. Consumed by generic host shells calling `parseManifest()`,
 * but owned by CSMA as a reusable framework capability.
 *
 * @module tile-manifest-parser
 */

// ─── Error Codes ───────────────────────────────────────────────────────────

export const ErrorCode = Object.freeze({
    MISSING_FIELD: 'MISSING_FIELD',
    INVALID_TYPE: 'INVALID_TYPE',
    DUPLICATE_TILE_ID: 'DUPLICATE_TILE_ID',
    NO_PRIMARY_TILE: 'NO_PRIMARY_TILE',
    MULTIPLE_PRIMARY_TILES: 'MULTIPLE_PRIMARY_TILES',
    INVALID_SPAWN_REF: 'INVALID_SPAWN_REF',
    INVALID_SPAWN_TARGET: 'INVALID_SPAWN_TARGET',
    EMPTY_ARRAY: 'EMPTY_ARRAY',
    UNKNOWN_TILE_TYPE: 'UNKNOWN_TILE_TYPE',
    INVALID_MOUNT_PATH: 'INVALID_MOUNT_PATH',
});

// ─── Known Tile Types ──────────────────────────────────────────────────────

/**
 * Valid Tile Protocol archetype names.
 *
 * These are the canonical type names defined in the Tile Protocol spec.
 * Apps declare tiles with these type names; the host shell maps them to
 * concrete archetype factories.
 *
 * Types without a CSMA archetype yet (header, search, action) are included
 * because the manifest spec is the stable contract — not the framework.
 */
const KNOWN_TILE_TYPES = new Set([
    'grid',
    'viewer',
    'editor',
    'dashboard',
    'config',
    'media',
    'nav',
    'overlay',
    'header',
    'search',
    'action',
]);

// ─── Mount Path Validation ─────────────────────────────────────────────────

/**
 * Reject mount paths that could load code from outside the app directory.
 *
 * Allowed:
 *   ./tiles/foo.js
 *   ./foo.js
 *
 * Rejected:
 *   http://...  https://...  //cdn...        (remote)
 *   /absolute/path                             (absolute)
 *   ../traversal  ../../etc                    (directory escape)
 *   javascript:  data:                         (pseudo-protocols)
 *
 * @param {string} mount
 * @returns {boolean}
 */
function isValidMountPath(mount) {
    if (!mount.startsWith('./')) return false;
    if (mount.includes('..')) return false;
    // Must end with .js
    if (!mount.endsWith('.js')) return false;
    // No protocol-like prefixes after leading ./
    const inner = mount.slice(2);
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(inner)) return false;
    return true;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** @param {*} v @returns {boolean} */
const isString = (v) => typeof v === 'string';

/** @param {*} v @returns {boolean} */
const isNonEmptyString = (v) => isString(v) && v.trim().length > 0;

/** @param {*} v @returns {boolean} */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** @param {*} v @returns {boolean} */
const isArray = (v) => Array.isArray(v);

/**
 * @param {string} code
 * @param {string} path
 * @param {string} message
 * @returns {{ code: string, path: string, message: string }}
 */
function error(code, path, message) {
    return { code, path, message };
}

// ─── Field Validators ───────────────────────────────────────────────────────

/**
 * @param {object} obj
 * @param {string} key
 * @param {string} path
 * @returns {Array<{code:string, path:string, message:string}>}
 */
function requiredString(obj, key, path) {
    const val = obj[key];
    if (val === undefined || val === null) {
        return [error(ErrorCode.MISSING_FIELD, `${path}.${key}`, `"${key}" is required`)];
    }
    if (!isString(val)) {
        return [error(ErrorCode.INVALID_TYPE, `${path}.${key}`, `"${key}" must be a string, got ${typeof val}`)];
    }
    if (val.trim().length === 0) {
        return [error(ErrorCode.MISSING_FIELD, `${path}.${key}`, `"${key}" must not be empty`)];
    }
    return [];
}

// ─── Main Parser ────────────────────────────────────────────────────────────

/**
 * Parse and validate a tiles-manifest.json object.
 *
 * @param {*} raw — the JSON-parsed manifest (unknown shape)
 * @returns {{ ok: true, manifest: object } | { ok: false, errors: Array<{code:string, path:string, message:string}> }}
 *
 * @example
 *   const result = parseManifest(json);
 *   if (!result.ok) {
 *     for (const e of result.errors) console.error(`${e.code} at ${e.path}: ${e.message}`);
 *     return;
 *   }
 *   const { app, version, tiles, primaryTileId, events } = result.manifest;
 */
export function parseManifest(raw) {
    const errors = [];

    // ── Top-level shape ──
    if (!isObject(raw)) {
        errors.push(error(ErrorCode.INVALID_TYPE, '', 'Manifest must be a JSON object'));
        return { ok: false, errors };
    }

    // ── app ──
    errors.push(...requiredString(raw, 'app', ''));

    // ── version ──
    errors.push(...requiredString(raw, 'version', ''));

    // ── tiles ──
    const tiles = raw.tiles;
    if (tiles === undefined || tiles === null) {
        errors.push(error(ErrorCode.MISSING_FIELD, 'tiles', '"tiles" array is required'));
    } else if (!isArray(tiles)) {
        errors.push(error(ErrorCode.INVALID_TYPE, 'tiles', `"tiles" must be an array, got ${typeof tiles}`));
    } else if (tiles.length === 0) {
        errors.push(error(ErrorCode.EMPTY_ARRAY, 'tiles', '"tiles" must contain at least one tile'));
    }

    // Bail early if tiles is missing/invalid — can't validate children
    if (!isArray(tiles) || tiles.length === 0) {
        return { ok: false, errors };
    }

    // ── Validate each tile ──
    /** @type {Map<string, object>} */
    const tileMap = new Map();
    /** @type {Set<string>} */
    const seenIds = new Set();
    let primaryCount = 0;
    /** @type {object|null} */
    let primaryTile = null;

    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const tilePath = `tiles[${i}]`;

        if (!isObject(tile)) {
            errors.push(error(ErrorCode.INVALID_TYPE, tilePath, `Tile entry must be an object, got ${typeof tile}`));
            continue;
        }

        // id
        errors.push(...requiredString(tile, 'id', tilePath));
        const id = tile.id;
        if (id !== undefined && isNonEmptyString(id)) {
            if (seenIds.has(id)) {
                errors.push(error(ErrorCode.DUPLICATE_TILE_ID, `${tilePath}.id`, `Duplicate tile id "${id}"`));
            }
            seenIds.add(id);
        }

        // type — validate against known Tile Protocol types
        errors.push(...requiredString(tile, 'type', tilePath));
        if (isNonEmptyString(tile.type) && !KNOWN_TILE_TYPES.has(tile.type)) {
            errors.push(error(
                ErrorCode.UNKNOWN_TILE_TYPE,
                `${tilePath}.type`,
                `Unknown tile type "${tile.type}". Known types: ${[...KNOWN_TILE_TYPES].sort().join(', ')}`
            ));
        }

        // label
        errors.push(...requiredString(tile, 'label', tilePath));

        // mount — validate path safety
        errors.push(...requiredString(tile, 'mount', tilePath));
        if (isNonEmptyString(tile.mount) && !isValidMountPath(tile.mount)) {
            errors.push(error(
                ErrorCode.INVALID_MOUNT_PATH,
                `${tilePath}.mount`,
                `Invalid mount path "${tile.mount}". Must be a relative ./ path ending in .js (no remote URLs, absolute paths, or ../ escapes)`
            ));
        }

        // primary
        if (tile.primary === true) {
            primaryCount++;
            primaryTile = tile;
        } else if (tile.primary !== undefined && tile.primary !== false) {
            errors.push(error(ErrorCode.INVALID_TYPE, `${tilePath}.primary`, `"primary" must be a boolean, got ${typeof tile.primary}`));
        }

        // spawnable
        if (tile.spawnable !== undefined && typeof tile.spawnable !== 'boolean') {
            errors.push(error(ErrorCode.INVALID_TYPE, `${tilePath}.spawnable`, `"spawnable" must be a boolean, got ${typeof tile.spawnable}`));
        }

        // Index for spawns validation (must come after all tiles are seen)
        if (isNonEmptyString(id)) {
            tileMap.set(id, tile);
        }
    }

    // ── Cross-tile validation: spawns references ──
    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        const tilePath = `tiles[${i}]`;
        const spawns = tile.spawns;

        if (spawns === undefined || spawns === null) continue;

        if (!isArray(spawns)) {
            errors.push(error(ErrorCode.INVALID_TYPE, `${tilePath}.spawns`, `"spawns" must be an array, got ${typeof spawns}`));
            continue;
        }

        for (let j = 0; j < spawns.length; j++) {
            const ref = spawns[j];
            if (!isString(ref)) {
                errors.push(error(ErrorCode.INVALID_TYPE, `${tilePath}.spawns[${j}]`, `spawns entry must be a string, got ${typeof ref}`));
                continue;
            }
            const target = tileMap.get(ref);
            if (!target) {
                errors.push(error(ErrorCode.INVALID_SPAWN_REF, `${tilePath}.spawns[${j}]`, `Spawns references unknown tile id "${ref}"`));
            } else if (target.spawnable !== true) {
                errors.push(error(ErrorCode.INVALID_SPAWN_TARGET, `${tilePath}.spawns[${j}]`, `Spawns references tile "${ref}" which is not marked "spawnable": true`));
            }
        }
    }

    // ── Primary tile count ──
    if (primaryCount === 0) {
        errors.push(error(ErrorCode.NO_PRIMARY_TILE, 'tiles', 'Exactly one tile must be marked "primary": true'));
    } else if (primaryCount > 1) {
        errors.push(error(ErrorCode.MULTIPLE_PRIMARY_TILES, 'tiles', `Expected exactly one primary tile, found ${primaryCount}`));
    }

    // ── events (optional) ──
    /** @type {{ listens: string[], emits: string[] }} */
    const events = { listens: [], emits: [] };

    if (raw.events !== undefined) {
        if (!isObject(raw.events)) {
            errors.push(error(ErrorCode.INVALID_TYPE, 'events', `"events" must be an object, got ${typeof raw.events}`));
        } else {
            for (const key of ['listens', 'emits']) {
                const arr = raw.events[key];
                if (arr === undefined) continue;
                if (!isArray(arr)) {
                    errors.push(error(ErrorCode.INVALID_TYPE, `events.${key}`, `"events.${key}" must be an array, got ${typeof arr}`));
                    continue;
                }
                for (let j = 0; j < arr.length; j++) {
                    if (!isNonEmptyString(arr[j])) {
                        errors.push(error(ErrorCode.INVALID_TYPE, `events.${key}[${j}]`, `Event name must be a non-empty string, got ${typeof arr[j]}`));
                    }
                }
                events[key] = arr.filter(isNonEmptyString);
            }
        }
    }

    // ── Return ──
    if (errors.length > 0) {
        return { ok: false, errors };
    }

    // Build normalized manifest
    const normalizedTiles = Object.fromEntries(
        tiles.map((t, i) => [
            t.id,
            {
                id: t.id,
                type: t.type,
                label: t.label,
                mount: t.mount,
                primary: t.primary === true,
                spawnable: t.spawnable === true,
                spawns: Array.isArray(t.spawns) ? t.spawns.filter(isString) : [],
                _index: i,
            },
        ])
    );

    return {
        ok: true,
        manifest: {
            app: raw.app,
            version: raw.version,
            tiles: normalizedTiles,
            primaryTileId: primaryTile ? primaryTile.id : null,
            events,
        },
    };
}
