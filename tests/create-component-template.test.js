import { describe, expect, it } from 'vitest';

import { buildComponentManifestTemplate } from '../tooling/scripts/create-component.js';

describe('create-component manifest template', () => {
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
});
