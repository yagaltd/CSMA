/**
 * meta-manager JSON-LD schema builders — coverage for the starter pack.
 * Each builder must: emit valid @context/@type, accept documented input
 * fields, prune empty input to null (never emit hollow nodes), and survive
 * integration through MetaManagerModuleService.setSchema / applySeoPage.
 */

import { describe, it, expect } from 'vitest';
import { starterSchemas } from '../src/modules/meta-manager/schema/starter.js';
import {
    WebSiteSchema,
    WebPageSchema,
    OrganizationSchema,
    PersonSchema,
    ArticleSchema,
    BreadcrumbListSchema,
    FAQPageSchema,
    HowToSchema,
    SoftwareApplicationSchema,
    ProductSchema,
    LocalBusinessSchema,
    EventSchema
} from '../src/modules/meta-manager/index.js';

const CONTEXT = 'https://schema.org';

function builderCases() {
    return [
        ['WebSiteSchema', WebSiteSchema, { name: 'Morph', url: 'https://morph.dev' }],
        ['WebPageSchema', WebPageSchema, { name: 'Pricing', description: 'Plans' }],
        ['OrganizationSchema', OrganizationSchema, { name: 'Morph Inc', url: 'https://morph.dev' }],
        ['PersonSchema', PersonSchema, { name: 'Ada Lovelace' }],
        ['ArticleSchema', ArticleSchema, {
            headline: 'Vanilla wins',
            author: { '@type': 'Person', name: 'Ada' },
            datePublished: '2026-01-01'
        }],
        ['BreadcrumbListSchema', BreadcrumbListSchema, {
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://x.dev/' },
                { '@type': 'ListItem', position: 2, name: 'Pricing' }
            ]
        }],
        ['FAQPageSchema', FAQPageSchema, {
            mainEntity: [
                { '@type': 'Question', name: 'Is it vanilla?', acceptedAnswer: { '@type': 'Answer', text: 'Yes.' } }
            ]
        }],
        ['HowToSchema', HowToSchema, {
            name: 'Deploy a static site',
            step: [
                { '@type': 'HowToStep', name: 'Build', text: 'Run the build' },
                { '@type': 'HowToStep', name: 'Upload', text: 'Copy dist/' }
            ]
        }],
        ['SoftwareApplicationSchema', SoftwareApplicationSchema, {
            name: 'CSMA', applicationCategory: 'DeveloperApplication', operatingSystem: 'Web'
        }],
        ['ProductSchema', ProductSchema, {
            name: 'Morph Pro', offers: { '@type': 'Offer', price: '12.00', priceCurrency: 'USD' }
        }],
        ['LocalBusinessSchema', LocalBusinessSchema, { name: 'Cafe Morph', address: '1 Web St' }],
        ['EventSchema', EventSchema, { name: 'Vanilla Meetup', startDate: '2026-06-01' }]
    ];
}

describe('meta-manager JSON-LD builders', () => {
    it('starter pack registers the documented builder set', () => {
        const types = starterSchemas.map((b) => b.schemaType);
        for (const expected of ['WebSite', 'WebPage', 'Organization', 'Person', 'Article',
            'BreadcrumbList', 'FAQPage', 'HowTo', 'SoftwareApplication', 'Product']) {
            expect(types).toContain(expected);
        }
        for (const builder of starterSchemas) {
            expect(typeof builder).toBe('function');
            expect(typeof builder.schemaType).toBe('string');
        }
    });

    for (const [label, builder, input] of builderCases()) {
        it(`${label}: emits valid @type with documented fields`, () => {
            const node = builder(input);
            expect(node).toBeTruthy();
            expect(node['@context']).toBe(CONTEXT);
            expect(node['@type']).toBe(builder.schemaType);
            for (const [key, value] of Object.entries(input)) {
                expect(node[key]).toEqual(value);
            }
        });

        it(`${label}: prunes empty/blank input to null`, () => {
            expect(builder({})).toBeNull();
            expect(builder({ name: '   ' })).toBeNull();
        });

        it(`${label}: strips prototype-pollution keys`, () => {
            const node = builder({ ...input, __proto__: undefined, constructor: 'x', prototype: 1 });
            expect(node).toBeTruthy();
            const ownKeys = Object.keys(node);
            expect(ownKeys).not.toContain('constructor');
            expect(ownKeys).not.toContain('prototype');
            expect(ownKeys).not.toContain('__proto__');
            expect(node['@type']).toBe(builder.schemaType);
        });
    }
});

describe('schema graph integration through MetaManagerModuleService', () => {
    it('buildSchemaGraph resolves starter types and single-node collapses', async () => {
        const { MetaManagerModuleService } = await import('../src/modules/meta-manager/services/MetaManagerModuleService.js');
        const service = new MetaManagerModuleService({ publish () {}, subscribe () { return () => {}; } });
        const metaManagerStub = {
            push: (entry, opts) => ({ entry, opts, dispose () {} })
        };
        service.init({ metaManager: metaManagerStub });

        const graph = service.buildSchemaGraph([{ type: 'FAQPage', input: { mainEntity: [{ '@type': 'Question', name: 'Q?' }] } }]);
        expect(Array.isArray(graph)).toBe(false);
        expect(graph['@type']).toBe('FAQPage');

        const multi = service.buildSchemaGraph([
            { type: 'WebPage', input: { name: 'A' } },
            { type: 'BreadcrumbList', input: { itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home' }] } }
        ]);
        expect(Array.isArray(multi)).toBe(true);
        expect(multi).toHaveLength(2);

        const set = service.setSchema([{ type: 'Product', input: { name: 'X' } }]);
        expect(set.entry.script[0].type).toBe('application/ld+json');
        expect(set.entry.script[0].json['@type']).toBe('Product');
        service.destroy();
    });

    it('applySeoPage emits the JSON-LD script alongside head tags', async () => {
        const { MetaManagerModuleService } = await import('../src/modules/meta-manager/services/MetaManagerModuleService.js');
        const pushed = [];
        const service = new MetaManagerModuleService({ publish () {}, subscribe () { return () => {}; } });
        service.init({ metaManager: { push: (entry, opts) => { pushed.push({ entry, opts }); return { dispose () {} }; } } });

        service.applySeoPage({
            title: 'Pricing — Morph',
            description: 'Plans',
            canonical: 'https://morph.dev/pricing',
            schema: [{ type: 'BreadcrumbList', input: { itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://morph.dev/' },
                { '@type': 'ListItem', position: 2, name: 'Pricing' }
            ] } }]
        });

        expect(pushed).toHaveLength(1);
        const { entry } = pushed[0];
        expect(entry.title).toBe('Pricing — Morph');
        expect(entry.link).toEqual([expect.objectContaining({ rel: 'canonical' })]);
        expect(entry.script).toHaveLength(1);
        expect(entry.script[0].type).toBe('application/ld+json');
        expect(entry.script[0].json['@type']).toBe('BreadcrumbList');
        service.destroy();
    });
});
