import { componentCatalog as generatedCatalog } from '../catalog/componentCatalog.js';

const MAX_TEXT_LENGTH = 1000;
const MAX_CHILDREN_PER_SLOT = 50;
const MAX_COMPOSITION_DEPTH = 8;
const SAFE_TAGS = new Set([
  'article',
  'button',
  'div',
  'footer',
  'header',
  'h2',
  'input',
  'label',
  'p',
  'section',
  'span'
]);
const SAFE_ATTRIBUTES = new Set([
  'aria-label',
  'autocomplete',
  'class',
  'data-disabled',
  'data-shape',
  'data-size',
  'data-state',
  'data-theme-active',
  'data-theme-toggle',
  'data-tone',
  'data-variant',
  'for',
  'href',
  'id',
  'name',
  'placeholder',
  'src',
  'type',
  'value'
]);
const URL_ATTRIBUTES = new Set(['href', 'src']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneDefinition(definition) {
  return JSON.parse(JSON.stringify(definition));
}

function normalizeCatalogEntry(definition, owner = 'core') {
  if (!isPlainObject(definition)) {
    throw new Error('AI UI component definition must be an object');
  }

  const id = definition.id || definition.alias;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error('AI UI component definition requires an id');
  }
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(id)) {
    throw new Error(`AI UI component id "${id}" must be globally safe and namespaced when module-owned`);
  }
  if (!isPlainObject(definition.render)) {
    throw new Error(`AI UI component "${id}" requires render metadata`);
  }

  return {
    ...cloneDefinition(definition),
    id,
    owner,
    alias: definition.alias || id,
    propsSchema: definition.propsSchema || {},
    slots: definition.slots || {},
    allowedChildren: definition.allowedChildren || [],
    dependencies: definition.dependencies || { runtime: [], components: [] }
  };
}

function ownerFromPayload(payload) {
  return payload?.id || payload?.manifest?.id || 'unknown-module';
}

export class AIUIComposerService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.catalog = new Map();
    this.ownerIndex = new Map();
    this.cleanups = [];

    Object.values(generatedCatalog).forEach((definition) => {
      this.registerComponent(definition, { owner: 'core' });
    });

    if (eventBus) {
      this.cleanups.push(eventBus.subscribe('MODULE_LOADED', (payload) => {
        this.registerModuleComponents(payload?.manifest, ownerFromPayload(payload));
      }));
      this.cleanups.push(eventBus.subscribe('MODULE_UNLOADED', (payload) => {
        this.unregisterOwner(ownerFromPayload(payload));
      }));
    }
  }

  getCatalog() {
    return Object.fromEntries([...this.catalog.entries()].map(([id, definition]) => [id, cloneDefinition(definition)]));
  }

  getComponent(id) {
    const definition = this.catalog.get(id);
    return definition ? cloneDefinition(definition) : null;
  }

  listComponents() {
    return [...this.catalog.keys()].sort((a, b) => a.localeCompare(b));
  }

  listTypeIIComponents() {
    return this.listComponents().filter((id) => this.catalog.get(id)?.type === 'II');
  }

  componentsRequiring(dependency) {
    return this.listComponents().filter((id) => {
      const runtimeDependencies = this.catalog.get(id)?.dependencies?.runtime || [];
      return runtimeDependencies.includes(dependency);
    });
  }

  registerComponent(definition, { owner = 'runtime' } = {}) {
    const normalized = normalizeCatalogEntry(definition, owner);
    const existing = this.catalog.get(normalized.id);
    if (existing && existing.owner !== owner) {
      throw new Error(`AI UI component id "${normalized.id}" is already registered by "${existing.owner}"`);
    }

    this.catalog.set(normalized.id, normalized);
    if (!this.ownerIndex.has(owner)) {
      this.ownerIndex.set(owner, new Set());
    }
    this.ownerIndex.get(owner).add(normalized.id);
    return cloneDefinition(normalized);
  }

  registerModuleComponents(manifest, owner = manifest?.id) {
    const components = manifest?.aiUi?.components || [];
    if (!Array.isArray(components)) {
      throw new Error(`[AIUIComposerService] manifest.aiUi.components for "${owner}" must be an array`);
    }

    components.forEach((component) => this.registerComponent(component, { owner }));
  }

  unregisterOwner(owner) {
    const ids = this.ownerIndex.get(owner);
    if (!ids) {
      return;
    }

    ids.forEach((id) => this.catalog.delete(id));
    this.ownerIndex.delete(owner);
  }

  validateComposition(spec) {
    this.normalizeSpec(spec);
    return { ok: true };
  }

  compose(spec, { documentRef = globalThis.document } = {}) {
    if (!documentRef?.createElement || !documentRef?.createDocumentFragment) {
      throw new Error('AI UI composition requires a DOM document');
    }

    const normalized = this.normalizeSpec(spec);
    if (Array.isArray(normalized)) {
      const fragment = documentRef.createDocumentFragment();
      normalized.forEach((childSpec) => fragment.append(this.renderNode(childSpec, { documentRef, depth: 0, parent: null })));
      return fragment;
    }

    return this.renderNode(normalized, { documentRef, depth: 0, parent: null });
  }

  normalizeSpec(spec, { depth = 0, parent = null, slotName = null } = {}) {
    if (depth > MAX_COMPOSITION_DEPTH) {
      throw new Error('AI UI composition is too deeply nested');
    }

    if (Array.isArray(spec)) {
      if (spec.length > MAX_CHILDREN_PER_SLOT) {
        throw new Error(`AI UI slot "${slotName || 'root'}" has too many children`);
      }
      return spec.map((child) => this.normalizeSpec(child, { depth, parent, slotName }));
    }

    if (!isPlainObject(spec)) {
      throw new Error('AI UI composition node must be an object');
    }

    const id = spec.component;
    const definition = this.catalog.get(id);
    if (!definition) {
      throw new Error(`Unknown AI UI component "${id}"`);
    }
    if (!this.isRenderable(definition)) {
      throw new Error(`AI UI component "${id}" is not a DOM composition node`);
    }
    if (parent) {
      this.ensureAllowedChild(parent, id, slotName);
    }

    const props = this.normalizeProps(definition, spec.props || {});
    const slots = this.normalizeSlots(definition, spec.slots || {}, { depth, parent: id });

    return { component: id, props, slots };
  }

  normalizeProps(definition, props) {
    if (!isPlainObject(props)) {
      throw new Error(`props for "${definition.id}" must be an object`);
    }

    const allowedProps = new Set(Object.keys(definition.propsSchema || {}));
    const unknownProps = Object.keys(props).filter((key) => !allowedProps.has(key));
    if (unknownProps.length > 0) {
      throw new Error(`Unknown prop(s) for "${definition.id}": ${unknownProps.join(', ')}`);
    }

    return Object.fromEntries(Object.entries(props).map(([key, value]) => {
      if (value === null || value === undefined) {
        return [key, value];
      }
      if (typeof value !== 'string') {
        throw new Error(`Prop "${key}" for "${definition.id}" must be a string`);
      }
      if (value.length > MAX_TEXT_LENGTH) {
        throw new Error(`Prop "${key}" for "${definition.id}" exceeds ${MAX_TEXT_LENGTH} characters`);
      }
      if (/(url|href|src)$/i.test(key) && !this.isSafeUrl(value)) {
        throw new Error(`Unsafe URL rejected for prop "${key}"`);
      }
      return [key, value];
    }));
  }

  normalizeSlots(definition, slots, { depth, parent }) {
    if (!isPlainObject(slots)) {
      throw new Error(`slots for "${definition.id}" must be an object`);
    }

    const slotDefinitions = definition.slots || {};
    const unknownSlots = Object.keys(slots).filter((slotName) => !slotDefinitions[slotName]);
    if (unknownSlots.length > 0) {
      throw new Error(`Unknown slot(s) for "${definition.id}": ${unknownSlots.join(', ')}`);
    }

    return Object.fromEntries(Object.entries(slots).map(([slotName, children]) => {
      if (!Array.isArray(children)) {
        throw new Error(`Slot "${slotName}" for "${definition.id}" must be an array`);
      }
      if (children.length > MAX_CHILDREN_PER_SLOT) {
        throw new Error(`Slot "${slotName}" for "${definition.id}" has too many children`);
      }
      return [
        slotName,
        children.map((child) => this.normalizeSpec(child, { depth: depth + 1, parent, slotName }))
      ];
    }));
  }

  ensureAllowedChild(parentId, childId, slotName) {
    const parent = this.catalog.get(parentId);
    const slot = parent?.slots?.[slotName || parent.defaultSlot];
    const allowed = slot?.allowedChildren || parent?.allowedChildren || [];

    if (!allowed.includes(childId)) {
      throw new Error(`Component "${childId}" is not allowed in "${parentId}"${slotName ? ` slot "${slotName}"` : ''}`);
    }
  }

  isRenderable(definition) {
    return ['element', 'button'].includes(definition.render?.kind);
  }

  renderNode(spec, { documentRef, depth, parent }) {
    const definition = this.catalog.get(spec.component);
    const root = this.createElementFromRender(definition.render, spec.props, { documentRef });
    const slotTargets = new Map();

    this.renderChildren(definition.render.children || [], root, spec.props, spec.slots, {
      documentRef,
      depth,
      parent: spec.component,
      slotTargets
    });

    const defaultSlot = definition.defaultSlot;
    if (defaultSlot && spec.slots[defaultSlot] && !slotTargets.has(defaultSlot)) {
      this.appendSlotChildren(root, spec.slots[defaultSlot], { documentRef, depth, parent: spec.component });
    }

    return root;
  }

  renderChildren(children, target, props, slots, context) {
    children.forEach((childRender) => {
      const child = this.createElementFromRender(childRender, props, context);
      target.append(child);
      if (childRender.slot) {
        context.slotTargets.set(childRender.slot, child);
        this.appendSlotChildren(child, slots[childRender.slot] || [], {
          documentRef: context.documentRef,
          depth: context.depth,
          parent: context.parent
        });
      }
      if (Array.isArray(childRender.children)) {
        this.renderChildren(childRender.children, child, props, slots, context);
      }
    });
  }

  appendSlotChildren(target, children, context) {
    children.forEach((childSpec) => {
      target.append(this.renderNode(childSpec, {
        documentRef: context.documentRef,
        depth: context.depth + 1,
        parent: context.parent
      }));
    });
  }

  createElementFromRender(render, props, { documentRef }) {
    const tag = render.tag || (render.kind === 'button' ? 'button' : 'div');
    if (!SAFE_TAGS.has(tag)) {
      throw new Error(`Unsafe render tag "${tag}"`);
    }

    const element = documentRef.createElement(tag);
    if (render.className) {
      element.className = render.className;
    }
    this.applyAttributes(element, render.attributes || {}, props);

    if (render.textProp && props[render.textProp]) {
      element.textContent = props[render.textProp];
    }

    return element;
  }

  applyAttributes(element, attributes, props) {
    Object.entries(attributes).forEach(([name, config]) => {
      if (!SAFE_ATTRIBUTES.has(name) || /^on/i.test(name)) {
        throw new Error(`Unsafe render attribute "${name}"`);
      }

      let value = config;
      if (isPlainObject(config)) {
        value = props[config.prop] ?? config.fallback;
        if (value && Array.isArray(config.allowedValues) && !config.allowedValues.includes(value)) {
          throw new Error(`Invalid value "${value}" for attribute "${name}"`);
        }
      }

      if (value === undefined || value === null || value === false) {
        return;
      }
      if (typeof value !== 'string') {
        throw new Error(`Attribute "${name}" must resolve to a string`);
      }
      if (value.length > MAX_TEXT_LENGTH) {
        throw new Error(`Attribute "${name}" exceeds ${MAX_TEXT_LENGTH} characters`);
      }
      if (URL_ATTRIBUTES.has(name) && !this.isSafeUrl(value)) {
        throw new Error(`Unsafe URL rejected for attribute "${name}"`);
      }

      element.setAttribute(name, value);
    });
  }

  isSafeUrl(value) {
    try {
      const url = new URL(value, globalThis.location?.origin || 'http://localhost');
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  cleanup() {
    this.cleanups.splice(0).reverse().forEach((cleanup) => cleanup?.());
    this.unregisterOwner('runtime');
  }
}
