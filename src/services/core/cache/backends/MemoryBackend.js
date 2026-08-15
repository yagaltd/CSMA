/**
 * Memory backend (fast, session-only)
 */
export class MemoryBackend {
    constructor() {
        this.store = new Map();
    }

    async get(key) {
        return this.store.get(key);
    }

    async set(key, value) {
        this.store.set(key, value);
    }

    async delete(key) {
        this.store.delete(key);
    }

    async keys() {
        return Array.from(this.store.keys());
    }

    async clear() {
        this.store.clear();
    }
}
