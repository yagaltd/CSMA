import { componentCatalog } from '../catalog/componentCatalog.js';
import { contentArchetypes, layoutArchetypes } from '../archetypes/registry.js';
import { compileContentArchetypeView } from './compileArchetype.js';

export class AIUIComposerService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.catalog = componentCatalog;
    this.layoutArchetypes = layoutArchetypes;
    this.contentArchetypes = contentArchetypes;
  }

  renderContentView(contentArchetypeId, payload = {}) {
    const contentArchetype = this.contentArchetypes.get(contentArchetypeId);
    const layoutArchetype = this.layoutArchetypes.get(contentArchetype.layout);

    return compileContentArchetypeView({
      contentArchetype,
      layoutArchetype,
      catalog: this.catalog,
      target: payload.target || '#auth-panel',
      viewId: payload.viewId || `ai-ui.${contentArchetypeId}`,
      mode: payload.mode || 'replace',
      props: payload.props || {},
      state: payload.state || {}
    });
  }

  renderLoginFormView(payload = {}) {
    return this.renderContentView('login-form', payload);
  }

  renderContactFormView(payload = {}) {
    return this.renderContentView('contact-form', payload);
  }

  cleanup() {}
}
