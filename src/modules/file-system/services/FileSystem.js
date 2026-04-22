import { MetadataStore } from './MetadataStore.js';
import { StreamProcessor } from './StreamProcessor.js';
import { FileHandleCache } from '../utils/FileHandleCache.js';
import { FallbackStorage } from '../utils/FallbackStorage.js';
import { detectMimeType } from '../utils/MimeMapper.js';

const DEFAULT_OPTIONS = {
    metadataStoreName: 'csma-file-index',
    storageRoot: '/user-files',
    chunkSize: 64 * 1024,
    forceFallback: false
};

export class FileSystemService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.metadataStore = new MetadataStore(eventBus, {
            dbName: this.options.metadataStoreName
        });
        this.streamProcessor = new StreamProcessor();
        this.fileHandleCache = new FileHandleCache();
        this.backend = null;
        this.initialized = false;
        this.ready = null;
    }

    configure(options = {}) {
        this.options = { ...this.options, ...options };
    }

    async init() {
        if (this.initialized) {
            return;
        }

        await this.metadataStore.init({ enableBlobStore: this.options.forceFallback || !FileSystemService.hasOPFSSupport() });

        if (!this.options.forceFallback && FileSystemService.hasOPFSSupport()) {
            this.backend = new OPFSBackend(this.options.storageRoot, this.fileHandleCache, this.streamProcessor);
            await this.backend.init();
        } else {
            this.backend = new FallbackStorage(this.metadataStore);
            await this.backend.init();
        }

        this.initialized = true;
    }

    static hasOPFSSupport() {
        return typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function';
    }

    async store(fileInput, metadata = {}) {
        await this.#ensureReady();

        try {
            const blob = await this.streamProcessor.toBlob(fileInput, metadata.mimeType);
            const id = metadata.id || this.#generateId();
            const now = Date.now();
            const fileName = metadata.title || fileInput?.name || `file-${id}`;
            const mimeType = metadata.mimeType || blob.type || detectMimeType(fileName);
            const tags = this.#normalizeTags(metadata.tags);

            await this.backend.write(id, blob);

            const record = {
                id,
                title: fileName,
                description: metadata.description || '',
                tags,
                category: metadata.category || 'general',
                size: blob.size,
                mimeType,
                handle: this.backend.reference(id),
                storage: this.backend.type,
                createdAt: now,
                updatedAt: now,
                extra: metadata.extra || {}
            };

            await this.metadataStore.put(record);

            this.#publish('FILE_STORED', {
                id: record.id,
                metadata: {
                    title: record.title,
                    category: record.category,
                    tags: record.tags,
                    mimeType: record.mimeType
                },
                size: record.size,
                mimeType: record.mimeType,
                storedAt: record.updatedAt
            });

            return record;
        } catch (error) {
            this.#handleError('store', error);
            throw error;
        }
    }

    async retrieve(id, { withMetadata = false } = {}) {
        await this.#ensureReady();
        try {
            const record = await this.metadataStore.get(id);
            if (!record) {
                throw new Error('File metadata not found');
            }

            const file = await this.backend.read(id);

            this.#publish('FILE_RETRIEVED', {
                id: record.id,
                accessTime: Date.now()
            });

            if (withMetadata) {
                return { file, metadata: record };
            }

            return file;
        } catch (error) {
            this.#handleError('retrieve', error);
            throw error;
        }
    }

    async delete(id) {
        await this.#ensureReady();

        try {
            await this.backend.delete(id);
            await this.metadataStore.delete(id);

            this.#publish('FILE_DELETED', {
                id,
                deletedAt: Date.now()
            });
        } catch (error) {
            this.#handleError('delete', error);
            throw error;
        }
    }

    async search(filters = {}) {
        await this.#ensureReady();
        try {
            return this.metadataStore.search(filters);
        } catch (error) {
            this.#handleError('search', error);
            throw error;
        }
    }

    async list(limit = 100) {
        await this.#ensureReady();
        return this.metadataStore.list(limit);
    }

    async createReadStream(id) {
        await this.#ensureReady();
        const stream = await this.backend.createReadStream(id);
        if (stream) return stream;
        const blob = await this.backend.read(id);
        return this.streamProcessor.ensureReadable(blob);
    }

    async updateMetadata(id, updates = {}) {
        await this.#ensureReady();
        const record = await this.metadataStore.get(id);
        if (!record) {
            throw new Error('File metadata not found');
        }

        const next = {
            ...record,
            ...updates,
            tags: this.#normalizeTags(updates.tags ?? record.tags),
            updatedAt: Date.now()
        };

        await this.metadataStore.put(next);
        return next;
    }

    #normalizeTags(tags) {
        if (!tags) return [];
        if (Array.isArray(tags)) {
            return tags.map((tag) => String(tag).trim()).filter(Boolean);
        }
        if (typeof tags === 'string') {
            return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
        }
        return [];
    }

    #generateId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    async #ensureReady() {
        if (!this.initialized) {
            if (!this.ready) {
                this.ready = this.init();
            }
            await this.ready;
        }
    }

    #publish(eventName, payload) {
        if (this.eventBus?.publish) {
            this.eventBus.publish(eventName, payload);
        }
    }

    #handleError(operation, error) {
        console.error(`[FileSystem] ${operation} failed`, error);
        this.#publish('FILE_SYSTEM_ERROR', {
            error: error.message,
            operation
        });
    }
}

class OPFSBackend {
    constructor(rootPath, cache, streamProcessor) {
        this.rootPath = rootPath || '/user-files';
        this.cache = cache;
        this.streamProcessor = streamProcessor;
        this.type = 'opfs';
        this.directoryHandle = null;
    }

    async init() {
        const root = await navigator.storage.getDirectory();
        this.directoryHandle = await this.#ensureDirectory(root, this.rootPath);
    }

    async write(id, blob) {
        const handle = await this.directoryHandle.getFileHandle(id, { create: true });
        const writable = await handle.createWritable();
        const stream = this.streamProcessor.ensureReadable(blob);
        await stream.pipeTo(writable);
        this.cache.set(id, handle);
        return { path: `${this.rootPath}/${id}` };
    }

    async read(id) {
        const handle = await this.#getHandle(id);
        const file = await handle.getFile();
        return file;
    }

    async delete(id) {
        await this.directoryHandle.removeEntry(id);
        this.cache.delete(id);
    }

    async createReadStream(id) {
        const file = await this.read(id);
        return file.stream();
    }

    reference(id) {
        return `${this.rootPath}/${id}`;
    }

    async #ensureDirectory(rootHandle, path) {
        const segments = path.split('/').filter(Boolean);
        let current = rootHandle;
        for (const segment of segments) {
            current = await current.getDirectoryHandle(segment, { create: true });
        }
        return current;
    }

    async #getHandle(id) {
        const cached = this.cache.get(id);
        if (cached) return cached;
        const handle = await this.directoryHandle.getFileHandle(id, { create: false });
        this.cache.set(id, handle);
        return handle;
    }
}
