import './helpers/storage-polyfill.js';
import { describe, it, expect, beforeEach } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { FileSystemService } from '../src/modules/file-system/services/FileSystem.js';

const makeBlob = (text, type = 'text/plain') => new Blob([text], { type });

describe('FileSystemService (fallback)', () => {
    let service;

    beforeEach(async () => {
        const eventBus = new EventBus();
        eventBus.contracts = { ...Contracts };
        service = new FileSystemService(eventBus, {
            forceFallback: true,
            metadataStoreName: `test-file-index-${Math.random()}`
        });
        await service.init();
    });

    it('stores, searches, retrieves, and deletes files', async () => {
        const record = await service.store(makeBlob('hello world'), {
            title: 'greeting.txt',
            tags: ['work', 'notes'],
            category: 'documents'
        });

        expect(record.title).toBe('greeting.txt');
        expect(record.size).toBeGreaterThan(0);

        const searchResults = await service.search({ tags: 'work' });
        expect(searchResults.length).toBe(1);
        expect(searchResults[0].id).toBe(record.id);

        const blob = await service.retrieve(record.id);
        const text = await new Response(blob).text();
        expect(text).toBe('hello world');

        await service.delete(record.id);
        const afterDelete = await service.search({ tags: 'work' });
        expect(afterDelete.length).toBe(0);
    });
});
