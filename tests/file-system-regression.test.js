// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { EventBus } from '../src/runtime/EventBus.js';
import { createFileSystem } from '../src/modules/file-system/index.js';

describe('FileSystemService managed storage (forceFallback)', () => {
    let eventBus;
    let service;

    beforeEach(async () => {
        eventBus = new EventBus();
        service = createFileSystem(eventBus, { forceFallback: true });
        await service.ready;
    });

    afterEach(() => {
        eventBus?.clear?.();
    });

    // 1. createFileSystem returns service with .ready promise
    it('createFileSystem returns service with ready promise', () => {
        const localBus = new EventBus();
        const localService = createFileSystem(localBus, { forceFallback: true });

        expect(localService.ready).toBeInstanceOf(Promise);
        expect(localService.store).toBeInstanceOf(Function);
        expect(localService.retrieve).toBeInstanceOf(Function);
        expect(localService.delete).toBeInstanceOf(Function);
        expect(localService.list).toBeInstanceOf(Function);
        expect(localService.updateMetadata).toBeInstanceOf(Function);
    });

    it('ready resolves and service is initialized', async () => {
        const localBus = new EventBus();
        const localService = createFileSystem(localBus, { forceFallback: true });
        await localService.ready;
        expect(localService.initialized).toBe(true);
    });

    // 2. store(blob, metadata) returns a record with id, title, mimeType, size
    it('store returns a record with id, title, mimeType, and size', async () => {
        const blob = new Blob(['hello file system'], { type: 'text/plain' });
        const record = await service.store(blob, { title: 'hello.txt' });

        expect(record).toBeDefined();
        expect(typeof record.id).toBe('string');
        expect(record.id.length).toBeGreaterThan(0);
        expect(record.title).toBe('hello.txt');
        expect(record.mimeType).toBe('text/plain');
        expect(record.size).toBe(17);
        expect(record.storage).toBe('indexeddb');
        expect(typeof record.createdAt).toBe('number');
        expect(typeof record.updatedAt).toBe('number');
        expect(record.handle).toBe(`indexeddb://${record.id}`);
    });

    it('store uses provided id when metadata.id is set', async () => {
        const blob = new Blob(['content'], { type: 'application/octet-stream' });
        const record = await service.store(blob, { id: 'custom-id-42', title: 'data.bin' });

        expect(record.id).toBe('custom-id-42');
    });

    it('store auto-generates id when none is provided', async () => {
        const blob = new Blob(['content'], { type: 'application/octet-stream' });
        const record = await service.store(blob);

        expect(record.id).toBeDefined();
        expect(record.id.length).toBeGreaterThan(0);
    });

    // 3. retrieve(id) returns the stored blob
    it('retrieve returns the stored blob', async () => {
        const blob = new Blob(['hello file system'], { type: 'text/plain' });
        const record = await service.store(blob, { title: 'hello.txt' });

        const retrieved = await service.retrieve(record.id);

        expect(retrieved).toBeInstanceOf(Blob);
        expect(retrieved.size).toBe(17);
        expect(retrieved.type).toBe('text/plain');
    });

    it('retrieve with withMetadata returns file and metadata', async () => {
        const blob = new Blob(['hello world'], { type: 'text/plain' });
        const record = await service.store(blob, { title: 'greeting.txt', category: 'docs' });

        const result = await service.retrieve(record.id, { withMetadata: true });

        expect(result.file).toBeInstanceOf(Blob);
        expect(result.file.size).toBe(11);
        expect(result.metadata).toBeDefined();
        expect(result.metadata.title).toBe('greeting.txt');
        expect(result.metadata.category).toBe('docs');
    });

    it('retrieve throws for unknown id', async () => {
        await expect(service.retrieve('nonexistent-id')).rejects.toThrow();
    });

    // 4. delete(id) removes the record
    it('delete removes the stored file', async () => {
        const blob = new Blob(['temporary data'], { type: 'text/plain' });
        const record = await service.store(blob, { title: 'tmp.txt' });

        await service.delete(record.id);

        await expect(service.retrieve(record.id)).rejects.toThrow();
    });

    it('delete is idempotent for already-deleted records', async () => {
        const blob = new Blob(['data'], { type: 'text/plain' });
        const record = await service.store(blob, { title: 'tmp.txt' });

        await service.delete(record.id);

        // Second delete should not throw
        await service.delete(record.id);
    });

    // 5. list(limit) returns an array of records
    it('list returns an empty array for empty store', async () => {
        const items = await service.list();
        expect(items).toEqual([]);
    });

    it('list returns records sorted by createdAt descending', async () => {
        const blob1 = new Blob(['a'], { type: 'text/plain' });
        const blob2 = new Blob(['bb'], { type: 'text/plain' });
        const blob3 = new Blob(['ccc'], { type: 'text/plain' });

        const r1 = await service.store(blob1, { title: 'first' });
        const r2 = await service.store(blob2, { title: 'second' });
        const r3 = await service.store(blob3, { title: 'third' });

        const items = await service.list();

        expect(items).toHaveLength(3);
        // All stored items appear in the list
        const ids = items.map((item) => item.id);
        expect(ids).toContain(r1.id);
        expect(ids).toContain(r2.id);
        expect(ids).toContain(r3.id);
        // Sorted by createdAt descending (non-ascending)
        for (let i = 1; i < items.length; i++) {
            expect(items[i - 1].createdAt).toBeGreaterThanOrEqual(items[i].createdAt);
        }
    });

    it('list respects the limit parameter', async () => {
        for (let i = 0; i < 5; i++) {
            await service.store(new Blob([`${i}`], { type: 'text/plain' }), { title: `file-${i}` });
        }

        const items = await service.list(3);
        expect(items).toHaveLength(3);
    });

    // 6. updateMetadata(id, partial) updates and persists
    it('updateMetadata updates the title and persists', async () => {
        const blob = new Blob(['content'], { type: 'text/plain' });
        const record = await service.store(blob, { title: 'original.txt', category: 'drafts' });

        const updated = await service.updateMetadata(record.id, { title: 'renamed.txt' });

        expect(updated.title).toBe('renamed.txt');
        // unchanged fields preserved
        expect(updated.category).toBe('drafts');
        // updatedAt advanced (or stayed, within same tick)
        expect(updated.updatedAt).toBeGreaterThanOrEqual(record.updatedAt);

        // Verify persistence via retrieve with metadata
        const { metadata } = await service.retrieve(record.id, { withMetadata: true });
        expect(metadata.title).toBe('renamed.txt');
    });

    it('updateMetadata throws for unknown id', async () => {
        await expect(service.updateMetadata('nonexistent', { title: 'nope' })).rejects.toThrow(
            'File metadata not found'
        );
    });

    // 7. extra field survives store → retrieve round-trip
    it('extra field survives store → retrieve with metadata', async () => {
        const blob = new Blob(['extra test'], { type: 'text/plain' });
        const complexExtra = { customKey: 'customVal', nested: { a: 1, b: [2, 3] } };

        const record = await service.store(blob, {
            title: 'extra.txt',
            extra: complexExtra
        });

        expect(record.extra).toEqual(complexExtra);

        const { metadata } = await service.retrieve(record.id, { withMetadata: true });
        expect(metadata.extra).toEqual(complexExtra);
    });

    it('extra defaults to empty object when not provided', async () => {
        const blob = new Blob(['no extra'], { type: 'text/plain' });
        const record = await service.store(blob, { title: 'no-extra.txt' });

        expect(record.extra).toEqual({});
    });

    // 8. Fallback path works when forceFallback is true
    it('fallback path uses indexeddb backend type', async () => {
        const blob = new Blob(['fallback path'], { type: 'text/plain' });
        const record = await service.store(blob, { title: 'fallback.txt' });

        expect(record.storage).toBe('indexeddb');
        expect(record.handle).toMatch(/^indexeddb:\/\//);
    });

    it('fallback path init does not throw', async () => {
        const localBus = new EventBus();
        const localService = createFileSystem(localBus, { forceFallback: true });
        await localService.ready;

        // Service is operable — store and retrieve a blob
        const blob = new Blob(['operable'], { type: 'text/plain' });
        const record = await localService.store(blob, { title: 'test.txt' });
        const retrieved = await localService.retrieve(record.id);
        expect(retrieved.size).toBe(blob.size);
    });

    // Edge: tags normalization
    it('normalizes tags from array', async () => {
        const blob = new Blob(['tagged'], { type: 'text/plain' });
        const record = await service.store(blob, { title: 'tagged.txt', tags: ['  FOO  ', 'bar', ''] });

        expect(record.tags).toEqual(['FOO', 'bar']);
    });

    it('normalizes tags from comma-separated string', async () => {
        const blob = new Blob(['tagged'], { type: 'text/plain' });
        const record = await service.store(blob, { title: 'tagged.txt', tags: 'alpha, beta , gamma' });

        expect(record.tags).toEqual(['alpha', 'beta', 'gamma']);
    });

    // Edge: store with a string instead of Blob
    it('store accepts a string input converted to Blob', async () => {
        const record = await service.store('just a string', {
            title: 'string.txt',
            mimeType: 'text/plain'
        });

        expect(record.title).toBe('string.txt');
        const retrieved = await service.retrieve(record.id);
        expect(retrieved).toBeInstanceOf(Blob);
    });

    // Edge: store with ArrayBuffer
    it('store accepts an ArrayBuffer input', async () => {
        const buf = new Uint8Array([72, 73, 33]).buffer; // "HI!"
        const record = await service.store(buf, {
            title: 'buffer.bin',
            mimeType: 'application/octet-stream'
        });

        expect(record.size).toBe(3);
        const retrieved = await service.retrieve(record.id);
        expect(retrieved.size).toBe(3);
    });
});
