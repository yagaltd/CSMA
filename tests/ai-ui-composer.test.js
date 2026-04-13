import './helpers/storage-polyfill.js';
import { beforeEach, describe, expect, it } from 'vitest';
import EventBus from '../library/runtime/EventBus.js';
import { Contracts } from '../library/runtime/Contracts.js';
import { ServiceManager } from '../library/runtime/ServiceManager.js';
import { ModuleManager } from '../library/runtime/ModuleManager.js';
import { CommandRegistry } from '../library/runtime/CommandRegistry.js';
import { RouteRegistry } from '../library/runtime/RouteRegistry.js';
import { NavigationRegistry } from '../library/runtime/NavigationRegistry.js';
import { PanelRegistry } from '../library/runtime/PanelRegistry.js';
import { AdapterRegistry } from '../library/runtime/AdapterRegistry.js';
import { ViewRegistry } from '../library/runtime/ViewRegistry.js';
import { componentCatalog } from '../library/ui/ai-composer/catalog/componentCatalog.js';
import { contentArchetypes, layoutArchetypes } from '../library/ui/ai-composer/archetypes/registry.js';
import { compileContentArchetypeView } from '../library/ui/ai-composer/services/compileArchetype.js';

function createRuntime() {
  const eventBus = new EventBus();
  eventBus.contracts = Contracts;
  const serviceManager = new ServiceManager(eventBus);
  const registries = {
    commands: new CommandRegistry({ eventBus, serviceManager }),
    routes: new RouteRegistry({ eventBus }),
    navigation: new NavigationRegistry({ eventBus }),
    panels: new PanelRegistry({ eventBus }),
    adapters: new AdapterRegistry({ eventBus, serviceManager }),
    views: new ViewRegistry({ eventBus, serviceManager })
  };

  return {
    eventBus,
    serviceManager,
    registries,
    moduleManager: new ModuleManager(eventBus, serviceManager, registries)
  };
}

describe('AI UI composer module', () => {
  let runtime;

  beforeEach(() => {
    runtime = createRuntime();
  });

  it('renders the login-form archetype through INTENT_VIEW_RENDER', async () => {
    const rendered = [];
    runtime.eventBus.subscribe('VIEW_RENDERED', (payload) => rendered.push(payload));

    await runtime.moduleManager.loadModule('ai-ui');

    const results = await runtime.eventBus.publish('INTENT_VIEW_RENDER', {
      viewId: 'ai-ui.login-form',
      target: '#ai-output',
      props: {
        title: 'Welcome back',
        submitLabel: 'Continue'
      },
      source: 'ai',
      timestamp: Date.now()
    });
    const result = results[0];

    expect(result.ok).toBe(true);
    expect(result.archetypeId).toBe('login-form');
    expect(result.view.component).toBe('card');
    expect(result.view.props.title).toBe('Welcome back');
    expect(result.shell.id).toBe('auth-shell');
    expect(result.shell.regions.main).toHaveLength(1);
    expect(result.view.slots.body).toHaveLength(2);
    expect(result.view.slots.footer[0]).toMatchObject({
      component: 'button',
      props: { variant: 'primary', text: 'Continue' }
    });
    expect(rendered).toHaveLength(1);
    expect(rendered[0]).toMatchObject({
      viewId: 'ai-ui.login-form',
      target: '#ai-output',
      source: 'ai'
    });
  });

  it('renders the contact-form content archetype through INTENT_VIEW_RENDER', async () => {
    await runtime.moduleManager.loadModule('ai-ui');

    const results = await runtime.eventBus.publish('INTENT_VIEW_RENDER', {
      viewId: 'ai-ui.contact-form',
      target: '#ai-output',
      props: {
        title: 'Talk to sales',
        submitLabel: 'Book intro'
      },
      source: 'ai',
      timestamp: Date.now()
    });
    const result = results[0];

    expect(result.ok).toBe(true);
    expect(result.archetypeId).toBe('contact-form');
    expect(result.shell.id).toBe('auth-shell');
    expect(result.view.component).toBe('card');
    expect(result.view.props.title).toBe('Talk to sales');
    expect(result.view.slots.body).toHaveLength(3);
    expect(result.view.slots.footer[0]).toMatchObject({
      component: 'button',
      props: { variant: 'primary', text: 'Book intro' }
    });
  });
});

describe('compileContentArchetypeView failures', () => {
  const baseLayout = layoutArchetypes.get('auth-shell');
  const baseContent = contentArchetypes.get('login-form');

  it('fails for unknown component ids', () => {
    const content = structuredClone(baseContent);
    content.regions.main[0].component = 'secret-input';

    expect(() => compileContentArchetypeView({
      contentArchetype: content,
      layoutArchetype: baseLayout,
      catalog: componentCatalog,
      target: '#auth-panel',
      viewId: 'ai-ui.login-form'
    })).toThrow(/Unknown component id "secret-input"/);
  });

  it('fails for unsupported props', () => {
    const content = structuredClone(baseContent);
    content.regions.main[0].slots.footer[0].props.kind = 'cta';

    expect(() => compileContentArchetypeView({
      contentArchetype: content,
      layoutArchetype: baseLayout,
      catalog: componentCatalog,
      target: '#auth-panel',
      viewId: 'ai-ui.login-form'
    })).toThrow(/Unsupported prop "kind" on component "button"/);
  });

  it('fails when a required slot is missing', () => {
    const content = structuredClone(baseContent);
    delete content.regions.main[0].slots.body[0].slots.control;

    expect(() => compileContentArchetypeView({
      contentArchetype: content,
      layoutArchetype: baseLayout,
      catalog: componentCatalog,
      target: '#auth-panel',
      viewId: 'ai-ui.login-form'
    })).toThrow(/Missing required slot "control" on component "field"/);
  });

  it('fails when a content archetype targets an unknown layout region', () => {
    const content = structuredClone(baseContent);
    content.regions.hero = content.regions.main;

    expect(() => compileContentArchetypeView({
      contentArchetype: content,
      layoutArchetype: { ...baseLayout, regions: { main: baseLayout.regions.main } },
      catalog: componentCatalog,
      target: '#auth-panel',
      viewId: 'ai-ui.login-form'
    })).toThrow(/targets unknown region "hero"/);
  });
});
