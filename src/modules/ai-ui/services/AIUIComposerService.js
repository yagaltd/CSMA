import { componentCatalog as generatedCatalog } from '../catalog/componentCatalog.js';

const MAX_TEXT_LENGTH = 1000;
const MAX_CHILDREN_PER_SLOT = 50;
const MAX_COMPOSITION_DEPTH = 8;
// Module surfaces receive structured props (objects/arrays for data/options).
// Cap serialized size to keep payloads bounded.
const MAX_STRUCTURED_PROP_LENGTH = 20000;

// SVG drawing tags live in SAFE_TAGS but must be created in the SVG namespace;
// HTML `createElement('path')` yields an HTMLUnknownElement that does not
// render. SVG_TAGS is the subset of SAFE_TAGS that need createElementNS.
const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set([
  'svg', 'path', 'g', 'line', 'circle', 'rect', 'polyline', 'polygon'
]);

const SAFE_TAGS = new Set([
  // ── Layout ──
  'article',
  'div',
  'footer',
  'header',
  'section',
  'main',
  'aside',
  'nav',
  'details',
  'summary',

  // ── Headings (complete set — viewer archetype needs h1–h6) ──
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',

  // ── Text semantics (viewer renders rich content) ──
  'p', 'span',
  'time', 'mark', 'abbr',
  'code', 'pre', 'kbd', 'samp', 'var',
  'blockquote', 'cite', 'q',

  // ── Lists (viewer uses ul/ol/li) ──
  'ul', 'ol', 'li',
  'dl', 'dt', 'dd',

  // ── Tables (viewer renders tabular data) ──
  'table', 'thead', 'tbody', 'tfoot',
  'tr', 'td', 'th',
  'caption', 'col', 'colgroup',

  // ── Form elements (editor-builder, config-panel, settings) ──
  'input',
  'textarea',
  'select', 'option', 'optgroup',
  'label',
  'fieldset', 'legend',
  'datalist', 'output',
  'progress', 'meter',

  // ── Interactive ──
  'button',
  'dialog',

  // ── Media (media-browser, viewer, overlay-manager) ──
  'img',
  'figure', 'figcaption',
  'picture', 'source',
  'video', 'audio',

  // ── Graphics (chart canvas + mindmap svg connectors + archetype icons) ──
  // NOTE: script/iframe/object/embed are intentionally excluded (security).
  'canvas',
  'svg', 'path', 'g',
  'line', 'circle', 'rect',
  'polyline', 'polygon',
]);
const SAFE_ATTRIBUTES = new Set([
  'aria-label',
  'aria-hidden',
  'autocomplete',
  'checked',
  'class',
  'cols',
  'data-aiui-id',
  'data-disabled',
  'data-group',
  'data-shape',
  'data-size',
  'data-slot',
  'data-state',
  'data-theme-active',
  'data-theme-toggle',
  'data-tone',
  'data-variant',
  'disabled',
  'for',
  'href',
  'id',
  'max',
  'min',
  'name',
  'placeholder',
  'role',
  'rows',
  'src',
  'step',
  'tabindex',
  'title',
  'type',
  'value',
  'alt',

  // ── SVG geometry & presentation (inert — no script execution, no resource
  // loading). Needed so archetype icons and vector decoration compose through
  // the same mountTree pipeline instead of bypassing it. href/src stay
  // URL-validated above; no new URL-capable attributes are added here. ──
  'viewBox', 'preserveAspectRatio',
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity',
  'points', 'd',
  'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'width', 'height', 'transform', 'opacity', 'focusable'
]);
const URL_ATTRIBUTES = new Set(['href', 'src']);
const KNOWN_STATE_ATTRS = new Set([
  'data-state',
  'data-variant',
  'data-tone',
  'data-size',
  'data-shape',
  'data-disabled',
  'data-theme-active',
  'data-group',
]);

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
  constructor(eventBus, serviceManager = null) {
    this.eventBus = eventBus;
    this.serviceManager = serviceManager;
    this.catalog = new Map();
    this.ownerIndex = new Map();
    this.liveNodes = new Map();
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

  /**
   * Inject the shared ServiceManager used to resolve module-owned aiui
   * surfaces (render.kind === 'module'). Modules expose surfaces via
   * `src/modules/<module>/aiui/manifest.json`; each declares
   * `component.moduleId`. The composer resolves the owning module's service
   * through `serviceManager.get(moduleId)` and mounts it by calling the
   * service's `mountSurface(surfaceId, container, props)` method.
   *
   * Runtime contract (modules that expose aiui surfaces MUST implement):
   *   service.mountSurface(surfaceId: string, container: HTMLElement,
   *                        props: object) → cleanupFn: Function
   *
   * The returned cleanup function is invoked when the surface is unmounted
   * (via applyOp 'unmount' or composer cleanup).
   */
  setServiceManager(serviceManager) {
    this.serviceManager = serviceManager;
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

  // ────────────────────────────────────────────────────────────────
  // mountTree — mount a mixed spec tree (raw HTML nodes + catalog
  // component references) into a target. This is the Layer-1 entry point
  // used by Layer-2 slide layouts (and, in Phase 3, archetypes) so that any
  // aiui surface (comments, video, charts, mindmap) can be embedded inside
  // any layout alongside raw HTML structure.
  //
  // Spec node shapes (a tree may mix all of them):
  //   Raw element : { tag, attrs?, text?, children?: SpecNode[] }
  //                 attrs may include `class` and any `data-*` key.
  //   Component   : { component, props?, slot?: { [name]: SpecNode[] } }
  //                 resolved via the same catalog path as applyOp 'mount'.
  //   Text node   : { text }  OR a bare string
  //   DOM passthrough: an actual Node (back-compat for unconverted
  //                 sub-layouts embedded inside a spec tree)
  //   null/false  : skipped
  //
  // Security: tags validated against SAFE_TAGS, attributes against
  // SAFE_ATTRIBUTES ∪ `data-*` (inert), event-handler attributes (`on*`)
  // rejected, URL attributes (href/src) URL-validated, text length capped,
  // depth capped — same primitives as the catalog applyOp path.
  //
  // @returns {{ root: HTMLElement|null, cleanup: () => void }}
  //          `cleanup` unmounts the root and invokes every nested
  //          module-surface cleanup collected during the walk.
  // ────────────────────────────────────────────────────────────────
  mountTree(tree, target = null, { documentRef = globalThis.document } = {}) {
    if (!documentRef?.createElement || !documentRef?.createTextNode) {
      throw new Error('mountTree requires a DOM document');
    }
    const cleanups = [];
    const root = this._mountSpecNode(tree, { documentRef, depth: 0, cleanups });

    if (target && root) {
      target.append(root);
    }

    const cleanup = () => {
      // Run module-surface teardowns first, then detach the root.
      for (const fn of cleanups.splice(0)) {
        try { fn(); } catch { /* surface cleanup is best-effort */ }
      }
      if (root && root.parentNode) {
        root.parentNode.removeChild(root);
      }
    };

    return { root, cleanup };
  }

  _mountSpecNode(node, ctx) {
    if (node === null || node === undefined || node === false) return null;

    if (typeof node === 'string') {
      return ctx.documentRef.createTextNode(node);
    }

    // DOM Node passthrough — lets an unconverted sub-layout (which still
    // returns DOM) be embedded inside a spec tree during the migration.
    if (typeof Node !== 'undefined' && node instanceof Node) {
      return node;
    }

    if (Array.isArray(node)) {
      const fragment = ctx.documentRef.createDocumentFragment();
      for (const child of node) {
        const mounted = this._mountSpecNode(child, { ...ctx, depth: ctx.depth + 1 });
        if (mounted) fragment.append(mounted);
      }
      return fragment;
    }

    if (!isPlainObject(node)) {
      throw new Error('mountTree node must be an object, string, Node, or null');
    }

    if (typeof node.component === 'string') {
      return this._mountComponentNode(node, ctx);
    }

    if (typeof node.tag === 'string') {
      return this._mountElementNode(node, ctx);
    }

    if (typeof node.text === 'string') {
      return ctx.documentRef.createTextNode(node.text);
    }

    throw new Error('mountTree node must have a "tag", "component", or "text" property');
  }

  _mountElementNode(node, ctx) {
    if (ctx.depth > MAX_COMPOSITION_DEPTH) {
      throw new Error('mountTree composition is too deeply nested');
    }
    const { tag } = node;
    if (!SAFE_TAGS.has(tag)) {
      throw new Error(`Unsafe tag "${tag}" in mountTree`);
    }

    const element = SVG_TAGS.has(tag)
      ? ctx.documentRef.createElementNS(SVG_NS, tag)
      : ctx.documentRef.createElement(tag);
    const attrs = isPlainObject(node.attrs) ? node.attrs : {};

    for (const [name, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue;
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        throw new Error(`Attribute "${name}" must resolve to a string`);
      }
      if (/^on/i.test(name)) {
        throw new Error(`Unsafe attribute "${name}" in mountTree`);
      }
      // data-* attributes are inert (never executed) and are required for
      // layout state, so they are permitted alongside the SAFE_ATTRIBUTES
      // whitelist. This matches the existing el() helper's dataset freedom.
      const isDataAttr = name.startsWith('data-');
      const isAriaAttr = name.startsWith('aria-');
      if (!SAFE_ATTRIBUTES.has(name) && !isDataAttr && !isAriaAttr) {
        throw new Error(`Unsafe attribute "${name}" in mountTree`);
      }
      const strVal = String(value);
      if (strVal.length > MAX_TEXT_LENGTH) {
        throw new Error(`Attribute "${name}" exceeds ${MAX_TEXT_LENGTH} characters`);
      }
      if (URL_ATTRIBUTES.has(name) && !this.isSafeUrl(strVal)) {
        throw new Error(`Unsafe URL rejected for attribute "${name}"`);
      }
      element.setAttribute(name, strVal);
    }

    if (typeof node.text === 'string') {
      element.textContent = node.text;
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const childEl = this._mountSpecNode(child, { ...ctx, depth: ctx.depth + 1 });
        if (childEl) element.append(childEl);
      }
    }

    return element;
  }

  _mountComponentNode(node, ctx) {
    if (ctx.depth > MAX_COMPOSITION_DEPTH) {
      throw new Error('mountTree composition is too deeply nested');
    }
    const spec = { component: node.component };
    if (isPlainObject(node.props)) spec.props = node.props;
    // Render the catalog shell via the SAME validated path as applyOp 'mount'
    // (normalizeSpec → renderNode). No slots here; slot children are mounted
    // below so they may be raw HTML spec nodes, not just catalog components.
    const normalized = this.normalizeSpec(spec);
    const rendered = this.renderNode(normalized, {
      documentRef: ctx.documentRef,
      depth: ctx.depth,
      parent: null
    });

    // Collect module-surface teardown so mountTree's cleanup can invoke it.
    if (typeof rendered.__aiuiSurfaceCleanup === 'function') {
      ctx.cleanups.push(rendered.__aiuiSurfaceCleanup);
      delete rendered.__aiuiSurfaceCleanup;
    }

    if (isPlainObject(node.slot)) {
      const definition = this.catalog.get(node.component);
      const slotDefinitions = definition?.slots || {};
      for (const [slotName, children] of Object.entries(node.slot)) {
        if (!Array.isArray(children)) continue;
        const selector = slotDefinitions[slotName]?.selector;
        const slotTarget = selector && selector !== ':root'
          ? rendered.querySelector(selector)
          : rendered;
        if (!slotTarget) continue;
        for (const child of children) {
          const childEl = this._mountSpecNode(child, { ...ctx, depth: ctx.depth + 1 });
          if (childEl) slotTarget.append(childEl);
        }
      }
    }

    return rendered;
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

    return { component: id, props, slots, ...(spec.id ? { id: spec.id } : {}) };
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

    const isModuleSurface = this._isModuleSurface(definition);

    return Object.fromEntries(Object.entries(props).map(([key, value]) => {
      if (value === null || value === undefined) {
        return [key, value];
      }

      // Module surfaces pass structured props (data/options/objects) straight
      // to a service method rather than stamping DOM attributes, so the
      // DOM-oriented string/URL guards do not apply. Bounds + type still do.
      if (isModuleSurface) {
        this._validateStructuredProp(key, value, definition.id);
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

  _isModuleSurface(definition) {
    return definition?.render?.kind === 'module';
  }

  _validateStructuredProp(key, value, componentId) {
    const type = typeof value;
    if (type === 'function' || type === 'symbol') {
      throw new Error(`Prop "${key}" for "${componentId}" has an unsupported type (${type})`);
    }
    let serialized;
    try {
      serialized = JSON.stringify(value);
    } catch {
      throw new Error(`Prop "${key}" for "${componentId}" must be JSON-serializable`);
    }
    if (serialized && serialized.length > MAX_STRUCTURED_PROP_LENGTH) {
      throw new Error(`Prop "${key}" for "${componentId}" exceeds ${MAX_STRUCTURED_PROP_LENGTH} characters`);
    }
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
    return ['element', 'button', 'module'].includes(definition.render?.kind);
  }

  renderNode(spec, { documentRef, depth, parent }) {
    const definition = this.catalog.get(spec.component);
    if (definition.render?.kind === 'module') {
      return this.renderModuleSurface(definition, spec, { documentRef });
    }
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

  /**
   * Render a module-owned aiui surface (render.kind === 'module').
   *
   * Creates a container element and delegates mounting to the owning module's
   * service via `mountSurface(surfaceId, container, props) → cleanupFn`. The
   * cleanup function is stashed on the container so the live-node unmount path
   * can invoke it.
   */
  renderModuleSurface(definition, spec, { documentRef }) {
    const container = documentRef.createElement('div');
    container.setAttribute('data-aiui-surface', definition.id);
    if (definition.render?.className) {
      container.className = definition.render.className;
    }

    const moduleId = definition.moduleId;
    const surfaceId = definition.surfaceId || definition.id;
    const cleanup = this.mountModuleSurface(moduleId, surfaceId, container, spec.props || {});
    if (typeof cleanup === 'function') {
      container.__aiuiSurfaceCleanup = cleanup;
    }
    return container;
  }

  /**
   * Resolve and mount a module surface, returning the service's cleanup fn.
   * Throws clear, agent-handleable errors when the module is absent or does
   * not implement the mountSurface contract.
   */
  mountModuleSurface(moduleId, surfaceId, container, props) {
    if (!this.serviceManager) {
      throw new Error(`AI UI module surface "${surfaceId}" cannot mount: the composer has no serviceManager (call setServiceManager or pass one to the constructor)`);
    }
    if (!moduleId) {
      throw new Error(`AI UI module surface "${surfaceId}" has no moduleId; cannot resolve its owning service`);
    }
    const service = this.serviceManager.get ? this.serviceManager.get(moduleId) : this.serviceManager[moduleId];
    if (!service) {
      throw new Error(`AI UI module surface "${surfaceId}" requires module "${moduleId}", which is not loaded`);
    }
    if (typeof service.mountSurface !== 'function') {
      throw new Error(`Module "${moduleId}" does not expose mountSurface(surfaceId, container, props) — cannot mount surface "${surfaceId}"`);
    }
    return service.mountSurface(surfaceId, container, props);
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

  // ────────────────────────────────────────────────────────────────
  // Live node registry — streaming composition via ops
  // ────────────────────────────────────────────────────────────────

  getLiveNode(id) {
    const node = this.liveNodes.get(id);
    if (!node) return null;
    return {
      id: node.id,
      element: node.element,
      props: { ...node.props },
      parentId: node.parentId,
      slot: node.slot,
      children: node.children
    };
  }

  liveSnapshot() {
    return [...this.liveNodes.entries()].map(([, node]) => ({
      id: node.id,
      component: node.definition.id,
      props: { ...node.props },
      parentId: node.parentId,
      slot: node.slot,
      children: [...node.children.entries()].map(([slot, children]) => ({
        slot,
        children: children.map((c) => c.id)
      }))
    }));
  }

  applyOp(op, { documentRef = globalThis.document } = {}) {
    this._validateOp(op);
    switch (op.type) {
      case 'mount': return this._applyMount(op, { documentRef });
      case 'unmount': return this._applyUnmount(op);
      case 'reorder': return this._applyReorder(op);
      case 'clear': return this._applyClear(op);
      case 'updateProps': return this._applyUpdateProps(op);
      case 'setState': return this._applySetState(op);
      case 'setText': return this._applySetText(op);
      default: throw new Error(`Unknown op type "${op.type}"`);
    }
  }

  applyOps(ops, { documentRef = globalThis.document } = {}) {
    // Pre-flight: validate all ops with awareness of pending mounts
    const pendingIds = new Set();
    const pendingParents = new Map(); // id → { definition }
    for (let i = 0; i < ops.length; i++) {
      try {
        const op = ops[i];
        if (op.type === 'mount') {
          if (typeof op.id !== 'string' || op.id.trim() === '') {
            throw new Error('Mount op requires a non-empty string "id"');
          }
          if (this.liveNodes.has(op.id) || pendingIds.has(op.id)) {
            throw new Error(`duplicate mount id "${op.id}" in batch`);
          }
          if (!isPlainObject(op.spec) || typeof op.spec.component !== 'string') {
            throw new Error('Mount op requires a "spec" with a "component" string');
          }
          if (!this.catalog.has(op.spec.component)) {
            throw new Error(`Unknown component "${op.spec.component}"`);
          }
          pendingIds.add(op.id);
          pendingParents.set(op.id, { definition: this.catalog.get(op.spec.component) });
          if (op.parent !== undefined) {
            if (typeof op.parent !== 'string') throw new Error('"parent" must be a string');
            if (!this.liveNodes.has(op.parent) && !pendingIds.has(op.parent)) {
              throw new Error(`Parent "${op.parent}" not found`);
            }
            if (op.slot !== undefined) {
              if (typeof op.slot !== 'string') throw new Error('"slot" must be a string');
              const parentDef = this.liveNodes.has(op.parent)
                ? this.liveNodes.get(op.parent).definition
                : pendingParents.get(op.parent)?.definition;
              if (parentDef && !parentDef.slots?.[op.slot]) {
                throw new Error(`Unknown slot "${op.slot}" on "${parentDef.id}"`);
              }
            }
          }
        } else if (op.type === 'unmount') {
          if (typeof op.id !== 'string') throw new Error('Requires a string "id"');
          if (!this.liveNodes.has(op.id) && !pendingIds.has(op.id)) {
            throw new Error(`Instance "${op.id}" not found`);
          }
          pendingIds.delete(op.id);
        } else if (op.type === 'setState') {
          if (typeof op.id !== 'string') throw new Error('Requires a string "id"');
          if (!this.liveNodes.has(op.id) && !pendingIds.has(op.id)) {
            throw new Error(`Instance "${op.id}" not found`);
          }
          if (typeof op.attr !== 'string') throw new Error('Requires a string "attr"');
          const attrName = `data-${op.attr}`;
          if (!KNOWN_STATE_ATTRS.has(attrName)) throw new Error(`Unknown state attribute "${attrName}"`);
          if (typeof op.value !== 'string') throw new Error('Value must be a string');
        } else if (op.type === 'updateProps') {
          if (typeof op.id !== 'string') throw new Error('Requires a string "id"');
          if (!this.liveNodes.has(op.id) && !pendingIds.has(op.id)) {
            throw new Error(`Instance "${op.id}" not found`);
          }
        } else if (op.type === 'setText') {
          if (typeof op.id !== 'string') throw new Error('Requires a string "id"');
          if (!this.liveNodes.has(op.id) && !pendingIds.has(op.id)) {
            throw new Error(`Instance "${op.id}" not found`);
          }
        } else if (op.type === 'reorder' || op.type === 'clear') {
          if (typeof op.parent !== 'string') throw new Error('Requires a string "parent"');
          if (!this.liveNodes.has(op.parent) && !pendingIds.has(op.parent)) {
            throw new Error(`Parent "${op.parent}" not found`);
          }
          if (typeof op.slot !== 'string') throw new Error('Requires a string "slot"');
        } else {
          throw new Error(`Unknown op type "${op.type}"`);
        }
      } catch (err) {
        throw new Error(`Op ${i} failed validation: ${err.message}`);
      }
    }

    // All valid — apply in sequence
    const results = [];
    for (const op of ops) {
      const result = this.applyOp(op, { documentRef });
      if (result !== undefined) results.push(result);
    }
    return results;
  }

  _validateOpDry() {
    throw new Error('_validateOpDry is not used — validation is inline in applyOps');
  }

  _validateOp(op) {
    if (!isPlainObject(op) || typeof op.type !== 'string') {
      throw new Error('Op must be an object with a string "type"');
    }
    switch (op.type) {
      case 'mount': this._validateMountOp(op); break;
      case 'unmount': this._validateUnmountOp(op); break;
      case 'reorder': this._validateReorderOp(op); break;
      case 'clear': this._validateClearOp(op); break;
      case 'updateProps': this._validateUpdatePropsOp(op); break;
      case 'setState': this._validateSetStateOp(op); break;
      case 'setText': this._validateSetTextOp(op); break;
      default: throw new Error(`Unknown op type "${op.type}"`);
    }
  }

  _validateMountOp(op) {
    if (typeof op.id !== 'string' || op.id.trim() === '') {
      throw new Error('Mount op requires a non-empty string "id"');
    }
    if (this.liveNodes.has(op.id)) {
      throw new Error(`Instance "${op.id}" already exists`);
    }
    if (!isPlainObject(op.spec) || typeof op.spec.component !== 'string') {
      throw new Error('Mount op requires a "spec" with a "component" string');
    }
    if (!this.catalog.has(op.spec.component)) {
      throw new Error(`Unknown component "${op.spec.component}"`);
    }
    if (op.parent !== undefined) {
      if (typeof op.parent !== 'string') {
        throw new Error('Mount op "parent" must be a string');
      }
      if (!this.liveNodes.has(op.parent)) {
        throw new Error(`Parent "${op.parent}" not found`);
      }
      const parent = this.liveNodes.get(op.parent);
      if (op.slot !== undefined) {
        if (typeof op.slot !== 'string') {
          throw new Error('Mount op "slot" must be a string');
        }
        const slotDef = parent.definition.slots?.[op.slot];
        if (!slotDef) {
          throw new Error(`Unknown slot "${op.slot}" on "${parent.definition.id}"`);
        }
      }
    } else {
      // Root mount (no parent): optional "target" CSS selector for a mount point.
      if (op.target !== undefined) {
        if (typeof op.target !== 'string' || op.target.trim() === '') {
          throw new Error('Mount op "target" must be a non-empty string (CSS selector)');
        }
      }
    }
  }

  _validateUnmountOp(op) {
    if (typeof op.id !== 'string') {
      throw new Error('Unmount op requires a string "id"');
    }
    if (!this.liveNodes.has(op.id)) {
      throw new Error(`Instance "${op.id}" not found`);
    }
  }

  _validateReorderOp(op) {
    if (typeof op.parent !== 'string') throw new Error('Reorder op requires a string "parent"');
    if (typeof op.slot !== 'string') throw new Error('Reorder op requires a string "slot"');
    if (!Array.isArray(op.order) || op.order.length === 0) throw new Error('Reorder op requires a non-empty "order" array');
    const parent = this.liveNodes.get(op.parent);
    if (!parent) throw new Error(`Parent "${op.parent}" not found`);
    const slotDef = parent.definition.slots?.[op.slot];
    if (!slotDef) throw new Error(`Unknown slot "${op.slot}" on "${parent.definition.id}"`);
    const current = parent.children.get(op.slot) || [];
    if (op.order.length !== current.length) {
      throw new Error('Reorder "order" length must match current children count');
    }
    const currentIds = new Set(current.map((c) => c.id));
    for (const id of op.order) {
      if (!currentIds.has(id)) throw new Error(`Child "${id}" not found in slot "${op.slot}"`);
    }
  }

  _validateClearOp(op) {
    if (typeof op.parent !== 'string') throw new Error('Clear op requires a string "parent"');
    if (typeof op.slot !== 'string') throw new Error('Clear op requires a string "slot"');
    const parent = this.liveNodes.get(op.parent);
    if (!parent) throw new Error(`Parent "${op.parent}" not found`);
    const slotDef = parent.definition.slots?.[op.slot];
    if (!slotDef) throw new Error(`Unknown slot "${op.slot}" on "${parent.definition.id}"`);
  }

  _validateUpdatePropsOp(op) {
    if (typeof op.id !== 'string') throw new Error('updateProps op requires a string "id"');
    if (!this.liveNodes.has(op.id)) throw new Error(`Instance "${op.id}" not found`);
    if (!isPlainObject(op.props)) throw new Error('updateProps op requires a "props" object');
    const node = this.liveNodes.get(op.id);
    const allowedProps = new Set(Object.keys(node.definition.propsSchema || {}));
    const isModuleSurface = this._isModuleSurface(node.definition);
    for (const key of Object.keys(op.props)) {
      if (!allowedProps.has(key)) throw new Error(`Unknown prop "${key}" for "${node.definition.id}"`);
      const value = op.props[key];
      if (value === null || value === undefined) continue;
      if (isModuleSurface) {
        this._validateStructuredProp(key, value, node.definition.id);
        continue;
      }
      if (typeof value !== 'string') throw new Error(`Prop "${key}" must be a string`);
      if (value.length > MAX_TEXT_LENGTH) throw new Error(`Prop "${key}" exceeds max length`);
      if (/(url|href|src)$/i.test(key) && !this.isSafeUrl(value)) {
        throw new Error(`Unsafe URL rejected for prop "${key}"`);
      }
    }
  }

  _validateSetStateOp(op) {
    if (typeof op.id !== 'string') throw new Error('setState op requires a string "id"');
    if (!this.liveNodes.has(op.id)) throw new Error(`Instance "${op.id}" not found`);
    if (typeof op.attr !== 'string') throw new Error('setState op requires a string "attr"');
    const attrName = `data-${op.attr}`;
    if (!KNOWN_STATE_ATTRS.has(attrName)) throw new Error(`Unknown state attribute "${attrName}"`);
    if (typeof op.value !== 'string') throw new Error('State value must be a string');
    if (op.value.length > MAX_TEXT_LENGTH) throw new Error('State value exceeds max length');
  }

  _validateSetTextOp(op) {
    if (typeof op.id !== 'string') throw new Error('setText op requires a string "id"');
    if (!this.liveNodes.has(op.id)) throw new Error(`Instance "${op.id}" not found`);
    const node = this.liveNodes.get(op.id);
    if (!node.definition.render.textProp) {
      throw new Error(`Component "${node.definition.id}" does not support text updates`);
    }
    if (typeof op.text !== 'string') throw new Error('Text must be a string');
    if (op.text.length > MAX_TEXT_LENGTH) throw new Error('Text exceeds max length');
  }

  // ── Op application ──────────────────────────────────────────────

  _applyMount(op, { documentRef }) {
    const normalized = this.normalizeSpec(op.spec);
    const element = this.renderNode(normalized, { documentRef, depth: 0, parent: null });
    element.setAttribute('data-aiui-id', op.id);

    const definition = this.catalog.get(op.spec.component);
    const liveNode = {
      id: op.id,
      definition,
      element,
      props: { ...(op.spec.props || {}) },
      parentId: op.parent || null,
      slot: op.slot || null,
      children: new Map(),
      surfaceCleanup: typeof element.__aiuiSurfaceCleanup === 'function' ? element.__aiuiSurfaceCleanup : null
    };

    if (op.parent && op.slot) {
      const parentNode = this.liveNodes.get(op.parent);
      const slotContainer = parentNode.element.querySelector(
        parentNode.definition.slots[op.slot]?.selector || ':root'
      );
      if (!slotContainer) throw new Error(`Slot container for "${op.slot}" not found`);
      slotContainer.append(element);
      if (!parentNode.children.has(op.slot)) parentNode.children.set(op.slot, []);
      parentNode.children.get(op.slot).push(liveNode);
    } else if (op.target) {
      // Root mount with a mount-point target: attach to a DOM anchor.
      const anchor = documentRef.querySelector(op.target);
      if (!anchor) {
        throw new Error(`Mount target "${op.target}" not found in document`);
      }
      anchor.append(element);
    }

    this.liveNodes.set(op.id, liveNode);

    // Register nested children that carry optional id hints
    this._registerNestedIds(normalized, element, { parentId: op.id, parentSlot: null });

    return liveNode;
  }

  /**
   * Walk a normalized spec tree and register any nested nodes that have an `id`.
   * Maps each nested id to the corresponding rendered DOM element inside the root.
   *
   * @param {Object} normalized - Normalized spec (from normalizeSpec)
   * @param {HTMLElement} rootEl - The rendered root element
   * @param {Object} ctx - { parentId, parentSlot }
   */
    _registerNestedIds(normalized, rootEl, { parentId, parentSlot }) {
    const slots = normalized.slots || {};
    for (const [slotName, children] of Object.entries(slots)) {
      for (const childSpec of children) {
        if (!childSpec.id) continue;

        // Check for duplicate — root id or already-registered
        if (this.liveNodes.has(childSpec.id)) {
          throw new Error(`Nested id "${childSpec.id}" already exists`);
        }

        // Find the rendered element for this child inside rootEl
        const childDef = this.catalog.get(childSpec.component);
        if (!childDef) continue;

        // Query by the component's className to locate the child element
        const childEl = this._findChildElement(rootEl, childDef, childSpec);
        if (!childEl) continue;

        childEl.setAttribute('data-aiui-id', childSpec.id);

        const childLiveNode = {
          id: childSpec.id,
          definition: childDef,
          element: childEl,
          props: { ...childSpec.props },
          parentId,
          slot: parentSlot || slotName,
          children: new Map()
        };

        // Add to parent's children map
        const parentNode = this.liveNodes.get(parentId);
        if (parentNode) {
          const effectiveSlot = parentSlot || slotName;
          if (!parentNode.children.has(effectiveSlot)) parentNode.children.set(effectiveSlot, []);
          parentNode.children.get(effectiveSlot).push(childLiveNode);
        }

        this.liveNodes.set(childSpec.id, childLiveNode);

        // Recurse into this child's nested slots
        this._registerNestedIds(childSpec, childEl, { parentId: childSpec.id, parentSlot: null });
      }
    }
  }

  /**
   * Find the rendered DOM element for a child spec inside a parent element.
   * Uses the component's render.className to locate it.
   */
  _findChildElement(parentEl, definition, spec) {
    const className = definition.render?.className;
    if (!className) return null;

    // Find all matching elements inside parent
    const candidates = parentEl.querySelectorAll('.' + className.split(' ').join('.'));
    // Return the first one that isn't already claimed by another live node
    for (const el of candidates) {
      // Check if this element is already claimed (has data-aiui-id from another registration)
      const existingId = el.getAttribute('data-aiui-id');
      if (existingId && this.liveNodes.has(existingId)) continue;
      return el;
    }
    return null;
  }

  _applyUnmount(op) {
    this._unmountRecursive(op.id);
  }

  _applyReorder(op) {
    const parentNode = this.liveNodes.get(op.parent);
    const slotDef = parentNode.definition.slots[op.slot];
    const slotChildren = parentNode.children.get(op.slot);
    const slotContainer = parentNode.element.querySelector(slotDef.selector || ':root');
    for (const id of op.order) {
      const childNode = slotChildren.find((c) => c.id === id);
      slotContainer.append(childNode.element);
    }
    slotChildren.sort((a, b) => op.order.indexOf(a.id) - op.order.indexOf(b.id));
  }

  _applyClear(op) {
    const parentNode = this.liveNodes.get(op.parent);
    const slotChildren = parentNode.children.get(op.slot) || [];
    for (const child of [...slotChildren]) {
      this._unmountRecursive(child.id);
    }
  }

  _applyUpdateProps(op) {
    const node = this.liveNodes.get(op.id);
    this.applyAttributes(node.element, node.definition.render.attributes || {}, op.props);
    // If any updated prop is the textProp, update textContent
    if (node.definition.render.textProp && op.props[node.definition.render.textProp] !== undefined) {
      node.element.textContent = op.props[node.definition.render.textProp];
    }
    Object.assign(node.props, op.props);
  }

  _applySetState(op) {
    const node = this.liveNodes.get(op.id);
    node.element.setAttribute(`data-${op.attr}`, op.value);
  }

  _applySetText(op) {
    const node = this.liveNodes.get(op.id);
    node.element.textContent = op.text;
    node.props[node.definition.render.textProp] = op.text;
  }

  // ── Internal helpers ────────────────────────────────────────────

  _unmountRecursive(id) {
    const node = this.liveNodes.get(id);
    if (!node) return;
    for (const [, children] of node.children) {
      for (const child of [...children]) {
        this._unmountRecursive(child.id);
      }
    }
    // Tear down module-surface resources before detaching the DOM node.
    if (node.surfaceCleanup) {
      try {
        node.surfaceCleanup();
      } catch { /* surface cleanup is best-effort */ }
      node.surfaceCleanup = null;
    }
    node.element.remove();
    if (node.parentId) {
      const parent = this.liveNodes.get(node.parentId);
      if (parent) {
        const slotChildren = parent.children.get(node.slot);
        if (slotChildren) {
          const idx = slotChildren.findIndex((c) => c.id === id);
          if (idx !== -1) slotChildren.splice(idx, 1);
        }
      }
    }
    this.liveNodes.delete(id);
  }

  _clearAllLiveNodes() {
    const rootIds = [...this.liveNodes.values()]
      .filter((n) => !n.parentId)
      .map((n) => n.id);
    for (const id of rootIds) {
      this._unmountRecursive(id);
    }
  }

  cleanup() {
    this._clearAllLiveNodes();
    this.cleanups.splice(0).reverse().forEach((cleanup) => cleanup?.());
    this.unregisterOwner('runtime');
  }
}
