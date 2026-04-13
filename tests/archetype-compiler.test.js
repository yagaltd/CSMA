import { describe, expect, it } from 'vitest';
import { componentCatalog } from '../library/ui/ai-composer/catalog/componentCatalog.js';
import { contentArchetypes, layoutArchetypes } from '../library/ui/ai-composer/archetypes/registry.js';
import { compileContentArchetypeView } from '../library/ui/ai-composer/services/compileArchetype.js';

describe('compileContentArchetypeView', () => {
  it('compiles the login-form content archetype into the auth-shell composition shape', () => {
    const compiled = compileContentArchetypeView({
      contentArchetype: contentArchetypes.get('login-form'),
      layoutArchetype: layoutArchetypes.get('auth-shell'),
      catalog: componentCatalog,
      target: '#auth-panel',
      viewId: 'ai-ui.login-form',
      props: {
        title: 'Welcome back',
        submitLabel: 'Continue'
      }
    });

    expect(compiled.view).toEqual({
      component: 'card',
      props: {
        title: 'Welcome back',
        description: 'Use your work email and password to access your workspace.',
        tone: 'subtle'
      },
      slots: {
        body: [
          {
            component: 'field',
            props: {
              label: 'Work email',
              helper: 'Use the email tied to your organization.',
              for: 'login-email',
              required: 'true'
            },
            slots: {
              control: [
                {
                  component: 'input',
                  props: {
                    id: 'login-email',
                    type: 'email',
                    name: 'email',
                    autocomplete: 'email',
                    placeholder: 'name@company.com'
                  }
                }
              ]
            }
          },
          {
            component: 'field',
            props: {
              label: 'Password',
              helper: 'Passwords are case sensitive.',
              for: 'login-password',
              required: 'true'
            },
            slots: {
              control: [
                {
                  component: 'input',
                  props: {
                    id: 'login-password',
                    type: 'password',
                    name: 'password',
                    autocomplete: 'current-password',
                    placeholder: 'Enter your password'
                  }
                }
              ]
            }
          }
        ],
        footer: [
          {
            component: 'button',
            props: {
              variant: 'primary',
              text: 'Continue'
            }
          }
        ]
      }
    });
    expect(compiled.shell.intro).toEqual({
      eyebrow: 'Secure access',
      headline: 'Welcome back',
      supportingText: 'Sign in to continue into your workspace.'
    });
    expect(compiled.shell.regions.main).toHaveLength(1);
    expect(compiled.shell.regions.aside).toEqual([]);
    expect(compiled.componentsUsed).toEqual(['button', 'card', 'field', 'input']);
    expect(compiled.layoutId).toBe('auth-shell');
    expect(compiled.archetypeId).toBe('login-form');
  });

  it('compiles a second content archetype into the same auth-shell', () => {
    const compiled = compileContentArchetypeView({
      contentArchetype: contentArchetypes.get('contact-form'),
      layoutArchetype: layoutArchetypes.get('auth-shell'),
      catalog: componentCatalog,
      target: '#auth-panel',
      viewId: 'ai-ui.contact-form'
    });

    expect(compiled.archetypeId).toBe('contact-form');
    expect(compiled.shell.regions.main[0].component).toBe('card');
    expect(compiled.shell.regions.main[0].slots.body).toHaveLength(3);
    expect(compiled.shell.regions.main[0].slots.footer[0].props.text).toBe('Request contact');
  });

  it('fails when the content archetype points at the wrong layout archetype', () => {
    expect(() => compileContentArchetypeView({
      contentArchetype: contentArchetypes.get('login-form'),
      layoutArchetype: { ...layoutArchetypes.get('auth-shell'), id: 'dashboard-shell' },
      catalog: componentCatalog,
      target: '#auth-panel',
      viewId: 'ai-ui.login-form'
    })).toThrow(/must target layout "dashboard-shell"/);
  });
});
