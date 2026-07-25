import { describe, it, expect } from 'vitest';
import { MarkdownCodec, STATUS_EMOJI_MAP } from '../../src/modules/mindmap/services/MarkdownCodec.js';

function sampleTree() {
  return {
    id: 'root', topic: 'root', schemaType: 'mindmap/branch', status: 'pending',
    children: [
      {
        id: 'b1', topic: 'e2e-test', schemaType: 'mindmap/branch', status: 'in_progress', tag: 'phase',
        expanded: true, direction: 0,
        metadata: { leafCount: 3, doneCount: 1 },
        children: [
          { id: 'l1', topic: 'init plan', schemaType: 'mindmap/leaf', status: 'done', children: [], metadata: { bottleneck: 'standard' } },
          { id: 'l2', topic: 'scout recon', schemaType: 'mindmap/leaf', status: 'in_progress', children: [], metadata: { bottleneck: 'standard' } },
          { id: 'l3', topic: 'write tests', schemaType: 'mindmap/leaf', status: 'blocked', children: [], metadata: { bottleneck: 'blocking' } }
        ]
      },
      {
        id: 'b2', topic: 'docs', schemaType: 'mindmap/branch', status: 'pending', tag: 'module',
        expanded: true, direction: 0,
        metadata: { leafCount: 1, doneCount: 0 },
        children: [
          { id: 'l4', topic: 'readme', schemaType: 'mindmap/leaf', status: 'pending', children: [], metadata: { bottleneck: 'standard' } }
        ]
      }
    ]
  };
}

describe('MarkdownCodec', () => {
  const codec = new MarkdownCodec();

  describe('serializeMarkdown', () => {
    it('omits the synthetic root', () => {
      const out = codec.serializeMarkdown(sampleTree());
      expect(out).not.toMatch(/^## root/m);
      expect(out).toMatch(/^## .*e2e-test/);
    });

    it('renders top-level branches as H2', () => {
      const out = codec.serializeMarkdown(sampleTree());
      expect(out).toMatch(/^## /);
    });

    it('renders leaves as - list items with status emoji', () => {
      const out = codec.serializeMarkdown(sampleTree());
      expect(out).toContain(`- ${STATUS_EMOJI_MAP.done} init plan`);
      expect(out).toContain(`- ${STATUS_EMOJI_MAP.blocked} write tests`);
    });

    it('annotates branches with (done/total) counts', () => {
      const out = codec.serializeMarkdown(sampleTree());
      expect(out).toMatch(/\(1\/3\)/);
    });

    it('includes [tag] on branches', () => {
      const out = codec.serializeMarkdown(sampleTree());
      expect(out).toMatch(/\[phase\]/);
      expect(out).toMatch(/\[module\]/);
    });

    it('ids option appends node id', () => {
      const out = codec.serializeMarkdown(sampleTree(), { ids: true });
      expect(out).toContain('<b1>');
      expect(out).toContain('<l1>');
    });

    it('emoji:false omits status glyphs', () => {
      const out = codec.serializeMarkdown(sampleTree(), { emoji: false });
      expect(out).not.toContain(STATUS_EMOJI_MAP.done);
    });
  });

  describe('serializeAscii', () => {
    it('renders a tree with ├─ and └─ markers', () => {
      const out = codec.serializeAscii(sampleTree());
      expect(out).toMatch(/[├└]/);
      // leaves should have a trailing marker
      expect(out.split('\n').filter((l) => l.includes('init plan')).length).toBe(1);
    });

    it('marks branches with trailing slash', () => {
      const out = codec.serializeAscii(sampleTree());
      expect(out).toMatch(/e2e-test\//);
    });
  });

  describe('serializeJson', () => {
    it('produces minimal {t, s} objects', () => {
      const out = codec.serializeJson(sampleTree());
      expect(Array.isArray(out)).toBe(true);
      expect(out[0].t).toBe('e2e-test');
      expect(out[0].s).toBe('in_progress');
    });

    it('nested children survive', () => {
      const out = codec.serializeJson(sampleTree());
      expect(out[0].children.length).toBe(3);
    });
  });

  describe('filter', () => {
    it('status filter prunes non-matching branches and leaves', () => {
      const out = codec.serializeMarkdown(sampleTree(), { filter: { status: ['blocked'] } });
      // only the blocked leaf + its containing branch chain survive
      expect(out).toContain('write tests');
      expect(out).not.toContain('init plan');
      expect(out).not.toContain('readme');
    });

    it('tag filter scopes to matching branches', () => {
      const out = codec.serializeMarkdown(sampleTree(), { filter: { tag: ['phase'] } });
      expect(out).toContain('e2e-test');
      expect(out).not.toContain('docs');
    });
  });

  describe('parse (round-trip)', () => {
    it('parse → serialize → equivalent shape (no ids, lossy on counts)', () => {
      const original = sampleTree();
      const md = codec.serializeMarkdown(original);
      const parsed = codec.parse(md);
      expect(parsed).toBeTruthy();
      expect(parsed.children.length).toBe(2);
      expect(parsed.children[0].topic).toBe('e2e-test');
      expect(parsed.children[0].status).toBe('in_progress');
      expect(parsed.children[0].tag).toBe('phase');
      // leaves under first branch
      expect(parsed.children[0].children.length).toBe(3);
      expect(parsed.children[0].children[0].topic).toBe('init plan');
      expect(parsed.children[0].children[0].status).toBe('done');
    });

    it('parse handles indentation for nested items (leaf promoted to branch)', () => {
      const md = [
        '## branch',
        '- ⬜ top item',
        '  - ✅ nested item'
      ].join('\n');
      const parsed = codec.parse(md);
      // branch has one top-level child (top item).
      expect(parsed.children[0].children.length).toBe(1);
      // The first child becomes a branch because it has a child.
      expect(parsed.children[0].children[0].schemaType).toBe('mindmap/branch');
      expect(parsed.children[0].children[0].topic).toBe('top item');
      expect(parsed.children[0].children[0].children.length).toBe(1);
      expect(parsed.children[0].children[0].children[0].topic).toBe('nested item');
      expect(parsed.children[0].children[0].children[0].status).toBe('done');
    });
  });
});
