import { componentCatalog, listComponents, listTypeIIComponents, componentsRequiring } from '../catalog/componentCatalog.js';

/**
 * AI UI Composer Service
 *
 * A runtime helper for discovering and querying the component catalog.
 * This service does not compile archetypes or generate pages.
 * It helps agents and modules understand what UI primitives are available.
 */
export class AIUIComposerService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.catalog = componentCatalog;
  }

  getCatalog() {
    return this.catalog;
  }

  getComponent(id) {
    return this.catalog[id] || null;
  }

  listComponents() {
    return listComponents();
  }

  listTypeIIComponents() {
    return listTypeIIComponents();
  }

  componentsRequiring(dependency) {
    return componentsRequiring(dependency);
  }

  cleanup() {}
}
