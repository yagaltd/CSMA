import { describe, it, expect } from 'vitest';
import { formatMarkdown } from '../../src/modules/agent-context/services/formatters/MarkdownFormatter.js';
import { formatJson } from '../../src/modules/agent-context/services/formatters/JsonFormatter.js';
import { formatAscii } from '../../src/modules/agent-context/services/formatters/AsciiFormatter.js';

describe('MarkdownFormatter', () => {
    it('renders a heading from store name', () => {
        const out = formatMarkdown({ a: 1 }, { store: 'maps' });
        expect(out.startsWith('## maps')).toBe(true);
    });

    it('renders flat record keys as list items', () => {
        const out = formatMarkdown({ a: 1, b: 'two', c: true }, { store: 'record' });
        expect(out).toContain('- a: 1');
        expect(out).toContain('- b: two');
        expect(out).toContain('- c: true');
    });

    it('sorts keys for stable output', () => {
        const out = formatMarkdown({ z: 1, a: 2, m: 3 }, { store: 's' });
        const aPos = out.indexOf('- a:');
        const mPos = out.indexOf('- m:');
        const zPos = out.indexOf('- z:');
        expect(aPos).toBeLessThan(mPos);
        expect(mPos).toBeLessThan(zPos);
    });

    it('nests objects under a labelled parent', () => {
        const out = formatMarkdown({ outer: { inner: 'v' } }, { store: 's' });
        expect(out).toContain('- outer:');
        expect(out).toContain('- inner: v');
    });

    it('renders arrays as nested list items', () => {
        const out = formatMarkdown({ list: ['a', 'b'] }, { store: 's' });
        expect(out).toContain('- list:');
        expect(out).toContain('- a');
        expect(out).toContain('- b');
    });

    it('handles null gracefully', () => {
        const out = formatMarkdown(null, { store: 's' });
        expect(out).toContain('_(no data)_');
    });

    it('handles empty array', () => {
        const out = formatMarkdown([], { store: 's' });
        expect(out).toContain('_(empty)_');
    });

    it('drops functions and undefined', () => {
        const out = formatMarkdown({ a: 1, fn: () => null, b: undefined, c: 2 }, { store: 's' });
        expect(out).toContain('- a: 1');
        expect(out).toContain('- c: 2');
        expect(out).not.toContain('fn:');
        expect(out).not.toContain('b:');
    });

    it('escapes leading list-marker characters', () => {
        const out = formatMarkdown({ a: '- item' }, { store: 's' });
        // The escaped form should preserve the literal value but not start a new list.
        expect(out).toContain('\\- item');
    });

    it('output stays under 1KB for a representative record', () => {
        const record = {
            id: 'abc',
            topic: 'e2e-test',
            status: 'in_progress',
            children: [{ id: 1, t: 'a' }, { id: 2, t: 'b' }, { id: 3, t: 'c' }],
            meta: { createdAt: 1, updatedAt: 2, tag: 'phase' }
        };
        const out = formatMarkdown(record, { store: 'maps' });
        expect(Buffer.byteLength(out, 'utf8')).toBeLessThan(1024);
        expect(out.length).toBeGreaterThan(0);
    });
});

describe('JsonFormatter', () => {
    it('produces valid JSON with envelope', () => {
        const out = formatJson({ a: 1 }, { store: 'maps' });
        const parsed = JSON.parse(out);
        expect(parsed.store).toBe('maps');
        expect(parsed.data.a).toBe(1);
    });

    it('sorts keys', () => {
        const out = formatJson({ z: 1, a: 2 }, { store: 's' });
        expect(out.indexOf('"a"')).toBeLessThan(out.indexOf('"z"'));
    });

    it('drops functions', () => {
        const out = formatJson({ a: 1, fn: () => null }, { store: 's' });
        const parsed = JSON.parse(out);
        expect(parsed.data).toEqual({ a: 1 });
    });

    it('handles null', () => {
        const out = formatJson(null, { store: 's' });
        const parsed = JSON.parse(out);
        expect(parsed.data).toBeNull();
    });

    it('serializes Date as ISO string', () => {
        const d = new Date('2026-01-01T00:00:00Z');
        const out = formatJson({ when: d }, { store: 's' });
        expect(out).toContain('"2026-01-01T00:00:00.000Z"');
    });
});

describe('AsciiFormatter', () => {
    it('uses store name as root', () => {
        const out = formatAscii({ a: 1 }, { store: 'maps' });
        expect(out.split('\n')[0]).toBe('maps');
    });

    it('uses tree branch characters', () => {
        const out = formatAscii({ a: 1, b: 2 }, { store: 's' });
        expect(out).toMatch(/[├└]─ a: 1/);
        expect(out).toMatch(/[├└]─ b: 2/);
    });

    it('nests children', () => {
        const out = formatAscii({ outer: { inner: 1 } }, { store: 's' });
        expect(out).toContain('└─ outer');
        expect(out).toContain('└─ inner: 1');
    });

    it('handles null', () => {
        const out = formatAscii(null, { store: 's' });
        expect(out).toContain('(no data)');
    });

    it('collapses multi-line strings to single line', () => {
        const out = formatAscii({ note: 'line1\nline2\nline3' }, { store: 's' });
        const lines = out.split('\n');
        // Note value should appear on a single line containing all three words.
        const noteLine = lines.find((l) => l.includes('note:'));
        expect(noteLine).toBeDefined();
        expect(noteLine).toContain('line1');
        expect(noteLine).toContain('line3');
    });

    it('renders arrays as indexed children', () => {
        const out = formatAscii({ items: ['a', 'b'] }, { store: 's' });
        expect(out).toContain('items');
        expect(out).toMatch(/0: a/);
        expect(out).toMatch(/1: b/);
    });
});
