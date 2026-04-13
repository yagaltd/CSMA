import { describe, expect, it } from 'vitest';

import { componentCatalog } from '../library/modules/ai-ui/catalog/componentCatalog.js';
import { contentArchetypes, layoutArchetypes } from '../library/modules/ai-ui/archetypes/registry.js';
import { adaptRenderContractToLegacyViewModel } from '../library/modules/ai-ui/services/adaptRenderContract.js';
import { compileContentArchetypeRenderContract } from '../library/modules/ai-ui/services/compileArchetype.js';

describe('adaptRenderContractToLegacyViewModel', () => {
  it('reconstructs the legacy shell and view shape from the canonical render contract', () => {
    const contract = compileContentArchetypeRenderContract({
      contentArchetype: contentArchetypes.get('login-form'),
      layoutArchetype: layoutArchetypes.get('auth-shell'),
      catalog: componentCatalog,
      viewId: 'ai-ui.login-form',
      source: 'ai',
      state: {
        tone: 'subtle'
      }
    });
    const adapted = adaptRenderContractToLegacyViewModel(contract);

    expect(adapted).toMatchObject({
      ok: true,
      layoutId: 'auth-shell',
      archetypeId: 'login-form',
      contentArchetypeId: 'login-form',
      viewId: 'ai-ui.login-form',
      target: undefined,
      mode: 'replace',
      state: {
        tone: 'subtle'
      },
      shell: {
        id: 'auth-shell',
        intro: {
          eyebrow: 'Secure access',
          headline: 'Welcome back',
          supportingText: 'Sign in to continue into your workspace.'
        }
      },
      componentsUsed: ['button', 'card', 'field', 'input']
    });
    expect(adapted.view.component).toBe('card');
    expect(adapted.shell.regions.main).toHaveLength(1);
  });
});
