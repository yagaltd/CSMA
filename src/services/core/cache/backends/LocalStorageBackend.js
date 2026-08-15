/**
 * LocalStorage backend (persistent, 5MB limit)
 */
export class LocalStorageBackend {
    constructor(options = {}) {
        this.prefix = options.prefix || 'cache:';
    }

    async get(key) {
        if (typeof localStorage === 'undefined') {
            return undefined;
        }

        const item = localStorage.getItem(this.prefix + key);

        if (item === null) {
            return undefined;
        }

        try {
            return JSON.parse(item);
        } catch (error) {
            localStorage.removeItem(this.prefix + key);
            return undefined;
        }
    }

    async set(key, value) {
        try {
            if (typeof localStorage === 'undefined') {
                return;
            }

            localStorage.setItem(this.prefix + key, JSON.stringify(value));
        } catch (error) {
            // Quota exceeded (or storage unavailable): warn and rethrow so
            // CacheManager can demote the key to memory-only and emit
            // CACHE_PERSIST_FAILED.
            console.warn('LocalStorage quota exceeded:', error);
            throw error;
        }
    }

    async delete(key) {
        if (typeof localStorage === 'undefined') {
            return;
        }

        localStorage.removeItem(this.prefix + key);
    }

    async keys() {
        if (typeof localStorage === 'undefined') {
            return [];
        }

        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(this.prefix)) {
                keys.push(key.slice(this.prefix.length));
            }
        }
        return keys;
    }

    async clear() {
        const keys = await this.keys();
        await Promise.all(keys.map(key => this.delete(key)));
    }
}
