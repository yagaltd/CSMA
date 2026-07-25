/**
 * MindmapStore — IDB-backed persistence for the mindmap module.
 *
 * Two logical stores over the CSMA storage module:
 *   - 'maps'      mapId  → { id, name, rootId, createdAt, updatedAt }
 *   - 'map_nodes' nodeId → NodeObj
 *
 * v1 is single-user local-first. Each map's nodes form a tree rooted at
 * one record; children live as separate records (one per NodeObj) so
 * search/filter can hit a subset. The whole tree is reconstructed at
 * loadMap() time by walking from the root.
 *
 * If the storage module is unavailable (e.g. test env without IDB), the
 * store degrades to an in-memory Map per logical store — so the service
 * is fully functional in tests.
 */

const DEFAULT_MAPS_STORE = 'mindmap_maps';
const DEFAULT_NODES_STORE = 'mindmap_map_nodes';

export class MindmapStore {
  constructor({ storage = null, mapsStore = DEFAULT_MAPS_STORE, nodesStore = DEFAULT_NODES_STORE } = {}) {
    this.storage = storage;
    this.mapsStore = mapsStore;
    this.nodesStore = nodesStore;
    this._memoryMaps = new Map();
    this._memoryNodes = new Map();
    this._ready = null;
  }

  /**
   * Ensure the storage backend is initialised and the required object
   * stores exist. Safe to call multiple times.
   */
  async init() {
    if (this._ready) return this._ready;
    this._ready = (async () => {
      if (!this.storage) return;
      if (typeof this.storage.init === 'function') {
        try {
          await this.storage.init({
            [this.mapsStore]: { keyPath: 'id', autoIncrement: false },
            [this.nodesStore]: { keyPath: 'id', autoIncrement: false }
          });
        } catch (err) {
          // Storage may already be initialised with a different schema;
          // fall through and try operations individually.
          this.storage = null;
        }
      }
    })();
    return this._ready;
  }

  // ─── Maps ────────────────────────────────────────────────────────

  async putMap(map) {
    await this.init();
    if (this.storage && typeof this.storage.update === 'function') {
      try { await this.storage.update(this.mapsStore, map); return; } catch { /* fall through */ }
    }
    this._memoryMaps.set(map.id, map);
  }

  async getMap(mapId) {
    await this.init();
    if (this.storage && typeof this.storage.get === 'function') {
      try { return await this.storage.get(this.mapsStore, mapId); } catch { /* fall through */ }
    }
    return this._memoryMaps.get(mapId) || null;
  }

  async listMaps() {
    await this.init();
    if (this.storage && typeof this.storage.getAll === 'function') {
      try {
        const all = await this.storage.getAll(this.mapsStore);
        if (Array.isArray(all)) return all;
      } catch { /* fall through */ }
    }
    return Array.from(this._memoryMaps.values());
  }

  async deleteMap(mapId) {
    await this.init();
    if (this.storage && typeof this.storage.delete === 'function') {
      try { await this.storage.delete(this.mapsStore, mapId); } catch { /* fall through */ }
    }
    this._memoryMaps.delete(mapId);
  }

  // ─── Nodes ───────────────────────────────────────────────────────

  async putNode(node) {
    await this.init();
    if (this.storage && typeof this.storage.update === 'function') {
      try { await this.storage.update(this.nodesStore, node); return; } catch { /* fall through */ }
    }
    this._memoryNodes.set(node.id, node);
  }

  async getNode(nodeId) {
    await this.init();
    if (this.storage && typeof this.storage.get === 'function') {
      try { return await this.storage.get(this.nodesStore, nodeId); } catch { /* fall through */ }
    }
    return this._memoryNodes.get(nodeId) || null;
  }

  async getAllNodes() {
    await this.init();
    if (this.storage && typeof this.storage.getAll === 'function') {
      try {
        const all = await this.storage.getAll(this.nodesStore);
        if (Array.isArray(all)) return all;
      } catch { /* fall through */ }
    }
    return Array.from(this._memoryNodes.values());
  }

  async deleteNode(nodeId) {
    await this.init();
    if (this.storage && typeof this.storage.delete === 'function') {
      try { await this.storage.delete(this.nodesStore, nodeId); } catch { /* fall through */ }
    }
    this._memoryNodes.delete(nodeId);
  }

  /**
   * Bulk delete (used for cascade removals).
   */
  async deleteNodes(nodeIds) {
    await Promise.all((nodeIds || []).map((id) => this.deleteNode(id)));
  }

  /**
   * Wipe all nodes for a map. Used by deleteMap so we don't leave
   * orphaned records behind.
   */
  async deleteNodesForMap(mapId) {
    const all = await this.getAllNodes();
    const ids = all.filter((n) => n.mapId === mapId).map((n) => n.id);
    await this.deleteNodes(ids);
  }
}
