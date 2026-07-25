import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/runtime/EventBus.js';
import { SerializerRegistry } from '../../src/runtime/SerializerRegistry.js';

describe('SerializerRegistry', () => {
    let eventBus;
    let registry;

    beforeEach(() => {
        eventBus = new EventBus();
        registry = new SerializerRegistry({ eventBus });
    });

    describe('register / normalize', () => {
        it('rejects entries missing required fields', () => {
            expect(() => registry.register('mindmap', { format: 'markdown', fn: () => '' }))
                .toThrow(/store/);
            expect(() => registry.register('mindmap', { store: 'maps', fn: () => '' }))
                .toThrow(/format/);
            expect(() => registry.register('mindmap', { store: 'maps', format: 'markdown' }))
                .toThrow(/fn/);
        });

        it('rejects entries with invalid format', () => {
            expect(() => registry.register('mindmap', {
                store: 'maps', format: 'weird', fn: () => ''
            })).toThrow(/format/);
        });

        it('accepts custom formats prefixed with x-', () => {
            const entry = registry.register('mindmap', {
                store: 'maps', format: 'x-morph', fn: () => 'custom'
            });
            expect(entry.format).toBe('x-morph');
        });

        it('accepts fn as a string export name', () => {
            const entry = registry.register('mindmap', {
                store: 'maps', format: 'markdown', fn: 'serializeMapToMarkdown'
            });
            expect(entry.fn).toBe('serializeMapToMarkdown');
        });

        it('accepts fn as a function', () => {
            const fn = () => 'text';
            const entry = registry.register('mindmap', {
                store: 'maps', format: 'markdown', fn
            });
            expect(entry.fn).toBe(fn);
        });

        it('lowercases the format', () => {
            const entry = registry.register('mindmap', {
                store: 'maps', format: 'MARKDOWN', fn: () => ''
            });
            expect(entry.format).toBe('markdown');
        });

        it('synthesises id from moduleId + store + format', () => {
            const entry = registry.register('mindmap', {
                store: 'maps', format: 'markdown', fn: () => ''
            });
            expect(entry.id).toBe('mindmap:maps:markdown');
        });

        it('rejects duplicate {store, format} for the same moduleId', () => {
            registry.register('mindmap', {
                store: 'maps', format: 'markdown', fn: () => ''
            });
            expect(() => registry.register('mindmap', {
                store: 'maps', format: 'markdown', fn: () => ''
            })).toThrow(/already owned/);
        });

        it('allows different modules to register same store+format (moduleId-namespaced ids)', () => {
            // Per design: entry id is `${moduleId}:${store}:${format}`.
            // Two modules can register serializers for the same store+format;
            // dispatch via `find()` returns the first registered.
            registry.register('mindmap', {
                store: 'maps', format: 'markdown', fn: () => ''
            });
            expect(() => registry.register('catalog', {
                store: 'maps', format: 'markdown', fn: () => ''
            })).not.toThrow();
            // Different format also works.
            expect(() => registry.register('catalog', {
                store: 'maps', format: 'ascii', fn: () => ''
            })).not.toThrow();
            // find() returns the first match (mindmap, registered first).
            expect(registry.find('maps', 'markdown')?.moduleId).toBe('mindmap');
        });
    });

    describe('find / listByStore / stores', () => {
        beforeEach(() => {
            registry.register('mindmap', { store: 'maps', format: 'markdown', fn: () => '' });
            registry.register('mindmap', { store: 'maps', format: 'ascii', fn: () => '' });
            registry.register('cart', { store: 'cart', format: 'json', fn: () => '' });
        });

        it('find returns the matching entry or null', () => {
            expect(registry.find('maps', 'markdown')?.moduleId).toBe('mindmap');
            expect(registry.find('maps', 'MARKDOWN')?.moduleId).toBe('mindmap');
            expect(registry.find('maps', 'json')).toBeNull();
            expect(registry.find('unknown', 'markdown')).toBeNull();
        });

        it('listByStore returns all entries for a store', () => {
            expect(registry.listByStore('maps').map((e) => e.format).sort())
                .toEqual(['ascii', 'markdown']);
            expect(registry.listByStore('nonexistent')).toEqual([]);
        });

        it('stores returns sorted distinct store names', () => {
            expect(registry.stores()).toEqual(['cart', 'maps']);
        });
    });

    describe('unregister', () => {
        it('unregisterAll removes all entries for a module', () => {
            registry.register('mindmap', { store: 'maps', format: 'markdown', fn: () => '' });
            registry.register('mindmap', { store: 'maps', format: 'ascii', fn: () => '' });
            const removed = registry.unregisterAll('mindmap');
            expect(removed).toBe(2);
            expect(registry.stores()).toEqual([]);
        });

        it('does not affect other modules', () => {
            registry.register('mindmap', { store: 'maps', format: 'markdown', fn: () => '' });
            registry.register('cart', { store: 'cart', format: 'json', fn: () => '' });
            registry.unregisterAll('mindmap');
            expect(registry.stores()).toEqual(['cart']);
        });
    });
});
