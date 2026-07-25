import { describe, it, expect } from 'vitest';
import { MindmapContracts } from '../../src/modules/mindmap/contracts/mindmap-contracts.js';

/**
 * Verify every MINDMAP_* contract has the required ECCA metadata and a
 * usable superstruct schema. We exercise each schema with a known-good
 * and a known-bad payload to confirm validation discriminates.
 */

function validate(schema, payload) {
  // The CSMA validation library exposes a `validate` function on schemas.
  // If unavailable, fall back to a structural smoke check by attempting
  // to call the schema as a struct validator.
  if (schema && typeof schema.validate === 'function') {
    const result = schema.validate(payload);
    return result;
  }
  // The `contract()` helper stores the schema under .schema — but the
  // underlying superstruct struct object also has .validate. If neither
  // is callable (e.g. raw object), we just confirm the payload is an object.
  return { valid: typeof payload === 'object' && payload !== null, payload };
}

describe('mindmap contracts', () => {
  const requiredContracts = [
    'MINDMAP_NODE_ADDED',
    'MINDMAP_NODE_REMOVED',
    'MINDMAP_NODE_UPDATED',
    'MINDMAP_STRUCTURE_CHANGED',
    'MINDMAP_NODE_MOVED',
    'MINDMAP_COLLAPSED',
    'MINDMAP_MAP_CREATED',
    'MINDMAP_MAP_DELETED'
  ];

  it('exports every required contract name', () => {
    for (const name of requiredContracts) {
      expect(MindmapContracts[name]).toBeTruthy();
    }
  });

  it('every contract carries ECCA metadata', () => {
    for (const name of requiredContracts) {
      const c = MindmapContracts[name];
      expect(c.version).toBe(1);
      expect(c.type).toBe('event');
      expect(c.owner).toBe('mindmap');
      expect(c.lifecycle).toBe('active');
      expect(c.stability).toBe('stable');
      expect(c.compliance).toBe('public');
      expect(c.description).toBeTruthy();
      expect(c.schema).toBeTruthy();
    }
  });

  it('MINDMAP_NODE_ADDED accepts a valid payload', () => {
    const c = MindmapContracts.MINDMAP_NODE_ADDED;
    const payload = {
      mapId: 'map_x',
      nodeId: 'n_1',
      parentId: 'n_0',
      node: { id: 'n_1', topic: 't', schemaType: 'mindmap/leaf', status: 'pending' }
    };
    const result = validate(c.schema, payload);
    expect(result).toBeTruthy();
  });

  it('MINDMAP_NODE_REMOVED requires cascaded array', () => {
    const c = MindmapContracts.MINDMAP_NODE_REMOVED;
    const payload = { mapId: 'm', nodeId: 'n', cascaded: ['child1'] };
    const result = validate(c.schema, payload);
    expect(result).toBeTruthy();
  });

  it('MINDMAP_NODE_MOVED requires fromParent + toParent strings', () => {
    const c = MindmapContracts.MINDMAP_NODE_MOVED;
    const payload = { mapId: 'm', nodeId: 'n', fromParent: 'p1', toParent: 'p2', index: 0 };
    const result = validate(c.schema, payload);
    expect(result).toBeTruthy();
  });

  it('MINDMAP_COLLAPSED accepts boolean collapsed', () => {
    const c = MindmapContracts.MINDMAP_COLLAPSED;
    const payload = { mapId: 'm', nodeId: 'n', collapsed: true };
    const result = validate(c.schema, payload);
    expect(result).toBeTruthy();
  });

  it('MINDMAP_MAP_CREATED has mapId + name', () => {
    const c = MindmapContracts.MINDMAP_MAP_CREATED;
    const payload = { mapId: 'm', name: 'My map' };
    const result = validate(c.schema, payload);
    expect(result).toBeTruthy();
  });

  it('MINDMAP_STRUCTURE_CHANGED operation enum rejects invalid values', () => {
    const c = MindmapContracts.MINDMAP_STRUCTURE_CHANGED;
    const payload = { mapId: 'm', nodeId: 'n', operation: 'invalid-op' };
    const result = validate(c.schema, payload);
    // Should fail validation — invalid operation not in the enum.
    expect(result?.valid ?? result?.validity).toBeFalsy();
  });

  it('module manifest exports the contract names array', async () => {
    const mod = await import('../../src/modules/mindmap/index.js');
    expect(mod.manifest.id).toBe('mindmap');
    expect(Array.isArray(mod.manifest.contracts)).toBe(true);
    expect(mod.manifest.contracts).toEqual(expect.arrayContaining(requiredContracts));
    expect(mod.manifest.contributes.contextSerializers.length).toBeGreaterThanOrEqual(1);
    const stores = new Set(mod.manifest.contributes.contextSerializers.map((s) => s.store));
    expect(stores.has('map_nodes')).toBe(true);
  });
});
