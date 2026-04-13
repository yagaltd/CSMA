import { componentCatalog } from '../catalog/componentCatalog.js';
import { contentArchetypes, layoutArchetypes } from '../archetypes/registry.js';
import { compileContentArchetypeRenderContract } from './compileArchetype.js';

export class AIUIComposerService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.catalog = componentCatalog;
    this.layoutArchetypes = layoutArchetypes;
    this.contentArchetypes = contentArchetypes;
  }

  resolveArchetypes(contentArchetypeId) {
    const contentArchetype = this.contentArchetypes.get(contentArchetypeId);
    if (!contentArchetype) {
      throw new Error(`Unknown content archetype "${contentArchetypeId}"`);
    }

    const layoutArchetype = this.layoutArchetypes.get(contentArchetype.layout);
    if (!layoutArchetype) {
      throw new Error(`Unknown layout archetype "${contentArchetype.layout}"`);
    }

    return { contentArchetype, layoutArchetype };
  }

  renderContentContract(contentArchetypeId, payload = {}, context = {}) {
    const { contentArchetype, layoutArchetype } = this.resolveArchetypes(contentArchetypeId);

    return compileContentArchetypeRenderContract({
      contentArchetype,
      layoutArchetype,
      catalog: this.catalog,
      viewId: payload.viewId || `ai-ui.${contentArchetypeId}`,
      props: payload.props || {},
      state: payload.state || {},
      source: context.source,
      routePath: payload.routePath,
      pageId: payload.pageId,
      canonicalUrl: payload.canonicalUrl,
      lang: payload.lang
    });
  }

  renderLoginFormView(payload = {}, context = {}) {
    return this.renderContentContract('login-form', payload, context);
  }

  renderContactFormView(payload = {}, context = {}) {
    return this.renderContentContract('contact-form', payload, context);
  }

  cleanup() {}
}
