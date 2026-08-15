import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import EventBus from '../../src/runtime/EventBus.js';
import { AIUIComposerService } from '../../src/modules/ai-ui/services/AIUIComposerService.js';
import { componentCatalog } from '../../src/modules/ai-ui/catalog/componentCatalog.js';
import { collectAIUIComponentCatalog } from '../../tooling/scripts/generate-ai-ui-catalog.js';
import { CommentsService } from '../../src/modules/comments/services/CommentsService.js';
import { ChartsService } from '../../src/modules/charts/services/ChartsService.js';

const MODULE_SURFACES = ['comments-thread', 'video-player', 'chart-display'];

function fakeServiceManager(map) {
  return { get: (id) => (Object.prototype.hasOwnProperty.call(map, id) ? map[id] : null) };
}

function makeSurfaceManifest(id, moduleId) {
  return {
    component: { name: id, type: 'II', moduleId },
    contracts: { published: [], subscribed: [] },
    dependencies: { runtime: [], components: [] },
    metadata: { description: `${id} surface` },
    aiUi: {
      enabled: true,
      alias: id,
      title: id,
      category: 'Module Surface',
      propsSchema: { label: 'string' },
      defaultSlot: 'default',
      slots: { default: { selector: ':root', allowedChildren: [] } },
      allowedChildren: [],
      behavior: {},
      style: {},
      textTargets: {},
      render: { kind: 'module', tag: 'div', className: `aiui-${id}` }
    }
  };
}

describe('aiui module surfaces — catalog', () => {
  it('generated catalog contains all 3 module surfaces with module metadata', () => {
    for (const id of MODULE_SURFACES) {
      expect(componentCatalog[id], `missing surface ${id}`).toBeDefined();
      const entry = componentCatalog[id];
      expect(entry.render.kind).toBe('module');
      expect(entry.moduleId).toBeTruthy();
      expect(entry.surfaceId).toBe(id);
    }

    expect(componentCatalog['comments-thread'].moduleId).toBe('comments');
    expect(componentCatalog['chart-display'].moduleId).toBe('charts');
    expect(componentCatalog['video-player'].moduleId).toBe('video');
  });

  it('module surfaces are registered on the composer catalog', () => {
    const composer = new AIUIComposerService(new EventBus());
    const ids = composer.listComponents();
    for (const id of MODULE_SURFACES) {
      expect(ids).toContain(id);
    }
  });

  it('module surface ids must be globally unique across both scan roots', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'csma-aiui-mod-'));
    const componentsDir = path.join(root, 'components');
    const modulesDir = path.join(root, 'modules');
    await mkdir(path.join(componentsDir, 'dup'), { recursive: true });
    await writeFile(
      path.join(componentsDir, 'dup', 'manifest.json'),
      JSON.stringify(makeSurfaceManifest('dup-surface', null), null, 2)
    );
    // Module surface with the SAME id → collision.
    await mkdir(path.join(modulesDir, 'mymod', 'aiui'), { recursive: true });
    await writeFile(
      path.join(modulesDir, 'mymod', 'aiui', 'manifest.json'),
      JSON.stringify(makeSurfaceManifest('dup-surface', 'mymod'), null, 2)
    );

    await expect(
      collectAIUIComponentCatalog({ componentsDir, modulesDir })
    ).rejects.toThrow(/Duplicate AI UI component ids: dup-surface/);

    await rm(root, { recursive: true, force: true });
  });

  it('generator merges primitive + module surfaces from both scan roots', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'csma-aiui-merge-'));
    const componentsDir = path.join(root, 'components');
    const modulesDir = path.join(root, 'modules');
    await mkdir(path.join(componentsDir, 'alpha'), { recursive: true });
    await writeFile(
      path.join(componentsDir, 'alpha', 'manifest.json'),
      JSON.stringify(makeSurfaceManifest('alpha', null), null, 2)
    );
    await mkdir(path.join(modulesDir, 'mymod', 'aiui'), { recursive: true });
    await writeFile(
      path.join(modulesDir, 'mymod', 'aiui', 'manifest.json'),
      JSON.stringify(makeSurfaceManifest('mymod-thing', 'mymod'), null, 2)
    );

    const catalog = await collectAIUIComponentCatalog({ componentsDir, modulesDir });
    expect(Object.keys(catalog).sort()).toEqual(['alpha', 'mymod-thing']);
    expect(catalog['mymod-thing'].moduleId).toBe('mymod');

    await rm(root, { recursive: true, force: true });
  });
});

describe('aiui module surfaces — composer resolution', () => {
  it('canvas, svg, and path are accepted render tags now', () => {
    const composer = new AIUIComposerService(new EventBus());
    composer.registerComponent({
      id: 'test-canvas',
      alias: 'test-canvas',
      render: { kind: 'element', tag: 'canvas', className: 'c' },
      propsSchema: {},
      slots: { default: { selector: ':root', allowedChildren: [] } },
      defaultSlot: 'default',
      allowedChildren: []
    });
    const el = composer.compose({ component: 'test-canvas' }, { documentRef: document });
    expect(el.tagName).toBe('CANVAS');

    composer.registerComponent({
      id: 'test-svg',
      alias: 'test-svg',
      render: {
        kind: 'element',
        tag: 'svg',
        className: 's',
        children: [{ kind: 'element', tag: 'path', className: 'p' }]
      },
      propsSchema: {},
      slots: { default: { selector: ':root', allowedChildren: [] } },
      defaultSlot: 'default',
      allowedChildren: []
    });
    const svg = composer.compose({ component: 'test-svg' }, { documentRef: document });
    expect(svg.tagName).toBe('SVG');
    expect(svg.querySelector('path')).not.toBeNull();
    expect(() => composer.compose({ component: 'test-svg' }, { documentRef: document })).not.toThrow();
  });

  it('script tag is still rejected', () => {
    const composer = new AIUIComposerService(new EventBus());
    composer.registerComponent({
      id: 'test-script',
      alias: 'test-script',
      render: { kind: 'element', tag: 'script', className: 'x' },
      propsSchema: {},
      slots: { default: { selector: ':root', allowedChildren: [] } },
      defaultSlot: 'default',
      allowedChildren: []
    });
    expect(() => composer.compose({ component: 'test-script' }, { documentRef: document })).toThrow(/Unsafe render tag/);
  });

  it('resolves a comments-thread surface and calls CommentsService.mountSurface', () => {
    const bus = new EventBus();
    const comments = new CommentsService(bus);
    comments.init({
      comments: [
        { id: 'c1', threadId: 't1', body: 'First post' },
        { id: 'c2', threadId: 't1', body: 'Second post' }
      ]
    });

    const composer = new AIUIComposerService(bus, fakeServiceManager({ comments }));

    const host = document.createElement('div');
    host.id = 'comments-host';
    document.body.append(host);

    composer.applyOp({
      type: 'mount',
      id: 'thread-1',
      spec: { component: 'comments-thread', props: { threadId: 't1' } },
      target: '#comments-host'
    });

    const items = host.querySelectorAll('.comments-thread__item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toBe('First post');

    // Unmount invokes the surface cleanup → container emptied.
    composer.applyOp({ type: 'unmount', id: 'thread-1' });
    expect(host.querySelector('.comments-thread__item')).toBeNull();
    expect(composer.getLiveNode('thread-1')).toBeNull();

    host.remove();
  });

  it('throws a clear error when the owning module is not loaded', () => {
    const bus = new EventBus();
    // serviceManager with no 'video' service registered.
    const composer = new AIUIComposerService(bus, fakeServiceManager({}));

    expect(() =>
      composer.compose({ component: 'video-player', props: { src: 'https://example.com/v.mp4' } }, { documentRef: document })
    ).toThrow(/video.*not loaded/);
  });

  it('throws when the owning service does not implement mountSurface', () => {
    const bus = new EventBus();
    // 'video' resolves to an object lacking mountSurface.
    const composer = new AIUIComposerService(bus, fakeServiceManager({ video: { notAsurface: true } }));

    expect(() =>
      composer.compose({ component: 'video-player' }, { documentRef: document })
    ).toThrow(/does not expose mountSurface/);
  });

  it('accepts structured (object) props for module surfaces', () => {
    const bus = new EventBus();
    const charts = new ChartsService(bus);
    charts.init({
      adapters: [{ id: 'stub', label: 'Stub', render: (target) => target }]
    });
    const composer = new AIUIComposerService(bus, fakeServiceManager({ charts }));

    const el = composer.compose(
      {
        component: 'chart-display',
        props: {
          adapterId: 'stub',
          data: { id: 'd1', type: 'series', points: [{ x: 1, y: 2 }] },
          options: { animated: false }
        }
      },
      { documentRef: document }
    );
    expect(el.getAttribute('data-aiui-surface')).toBe('chart-display');
    expect(el.querySelector('canvas')).not.toBeNull();
  });
});
