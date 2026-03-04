export class FileHandleCache {
    constructor(limit = 100) {
        this.limit = limit;
        this.map = new Map();
    }

    set(key, handle) {
        if (!key) return;
        if (this.map.has(key)) {
            this.map.delete(key);
        }
        this.map.set(key, handle);
        if (this.map.size > this.limit) {
            const oldestKey = this.map.keys().next().value;
            this.map.delete(oldestKey);
        }
    }

    get(key) {
        if (!this.map.has(key)) return null;
        const handle = this.map.get(key);
        // LRU: refresh order
        this.map.delete(key);
        this.map.set(key, handle);
        return handle;
    }

    delete(key) {
        this.map.delete(key);
    }

    clear() {
        this.map.clear();
    }
}
