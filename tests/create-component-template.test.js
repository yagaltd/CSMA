import { describe, expect, it } from 'vitest';

import { buildComponentManifestTemplate, COMPONENTS_DIR, UI_INIT } from '../tooling/scripts/create-component.js';

describe('create-component manifest template', () => {
  it('targets src/ui component and init locations', () => {
    expect(COMPONENTS_DIR.replaceAll('\\', '/')).toMatch(/\/src\/ui\/components$/);
    expect(UI_INIT.replaceAll('\\', '/')).toMatch(/\/src\/ui\/init\.js$/);
  });

  it('starts new components with a minimal AI surface', () => {
    const manifest = JSON.parse(buildComponentManifestTemplate({
      name: 'status-pill',
      type: 'I',
      owner: 'ui-service',
      title: 'Status Pill',
      description: 'Compact status indicator',
      category: 'CSS-Only'
    }));

    expect(manifest.aiUi.propsSchema).toEqual({});
    expect(manifest.aiUi.render).toMatchObject({
      kind: 'element',
      tag: 'div',
      className: 'status-pill',
      textProp: 'label'
    });
    expect(manifest.aiUi.textTargets).toEqual({
      label: ['.status-pill']
    });
    expect(manifest.aiUi.slots).toEqual({
      default: {
        selector: ':root',
        allowedChildren: []
      }
    });
  });

  it('documents Type II components as EventBus-managed catalog entries', () => {
    const manifest = JSON.parse(buildComponentManifestTemplate({
      name: 'drawer',
      type: 'II',
      owner: 'ui-service',
      title: 'Drawer',
      description: 'EventBus managed drawer',
      category: 'Interactive'
    }));

    expect(manifest.dependencies.runtime).toEqual(['EventBus']);
    expect(manifest.aiUi.render.kind).toBe('template');
  });
});
