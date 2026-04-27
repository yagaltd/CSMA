import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { collectAIUIComponentCatalog } from '../tooling/scripts/generate-ai-ui-catalog.js';

let tempRoot;

async function writeManifest(componentName, manifest) {
  const componentDir = path.join(tempRoot, componentName);
  await mkdir(componentDir, { recursive: true });
  await writeFile(path.join(componentDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
}

function manifestFor(name, overrides = {}) {
  return {
    component: {
      name,
      type: 'I'
    },
    contracts: {
      published: [],
      subscribed: []
    },
    dependencies: {
      runtime: [],
      components: ['button']
    },
    metadata: {
      description: `${name} description`
    },
    aiUi: {
      enabled: true,
      alias: name,
      title: name,
      category: 'Test',
      preferred: false,
      summary: `${name} summary`,
      propsSchema: {
        label: 'string'
      },
      defaultSlot: 'default',
      slots: {
        default: {
          selector: ':root',
          allowedChildren: []
        }
      },
      allowedChildren: [],
      behavior: {},
      style: {},
      textTargets: {},
      template: '<span></span>',
      render: {
        kind: 'element',
        tag: 'span',
        className: name,
        textProp: 'label',
        template: '<span></span>'
      },
      ...overrides
    }
  };
}

describe('AI UI catalog generation', () => {
  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = undefined;
    }
  });

  it('reads enabled component manifests and preserves composition metadata', async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'csma-ai-ui-catalog-'));
    await writeManifest('alpha', manifestFor('alpha'));
    await writeManifest('disabled', manifestFor('disabled', { enabled: false }));

    const catalog = await collectAIUIComponentCatalog({ componentsDir: tempRoot });

    expect(Object.keys(catalog)).toEqual(['alpha']);
    expect(catalog.alpha).toMatchObject({
      id: 'alpha',
      owner: 'core',
      propsSchema: { label: 'string' },
      defaultSlot: 'default',
      dependencies: { runtime: [], components: ['button'] },
      render: {
        kind: 'element',
        tag: 'span',
        className: 'alpha',
        textProp: 'label'
      }
    });
  });
});
