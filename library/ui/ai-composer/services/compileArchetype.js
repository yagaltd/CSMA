function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function resolveValue(value, context) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return key in context ? String(context[key]) : '';
  });
}

function resolveNode(node, context) {
  const props = {};
  Object.entries(node.props || {}).forEach(([key, value]) => {
    props[key] = resolveValue(value, context);
  });

  const slots = {};
  Object.entries(node.slots || {}).forEach(([slotName, children]) => {
    slots[slotName] = children.map((child) => resolveNode(child, context));
  });

  return {
    component: node.component,
    props,
    ...(Object.keys(slots).length > 0 ? { slots } : {})
  };
}

function collectComponents(node, into = new Set()) {
  into.add(node.component);
  Object.values(node.slots || {}).forEach((children) => {
    children.forEach((child) => collectComponents(child, into));
  });
  return into;
}

function collectRegionComponents(nodes, into = new Set()) {
  (nodes || []).forEach((node) => collectComponents(node, into));
  return into;
}

function validateNode(node, catalog, path = 'root') {
  if (!isObject(node) || typeof node.component !== 'string' || node.component.trim() === '') {
    throw new Error(`Invalid archetype node at ${path}`);
  }

  const definition = catalog[node.component];
  if (!definition) {
    throw new Error(`Unknown component id "${node.component}" at ${path}`);
  }

  const allowedProps = new Set(definition.props || []);
  Object.keys(node.props || {}).forEach((propName) => {
    if (!allowedProps.has(propName)) {
      throw new Error(`Unsupported prop "${propName}" on component "${node.component}" at ${path}`);
    }
  });

  const slots = node.slots || {};
  const slotNames = new Set(Object.keys(definition.slots || {}));
  (definition.requiredSlots || []).forEach((slotName) => {
    if (!Array.isArray(slots[slotName])) {
      throw new Error(`Missing required slot "${slotName}" on component "${node.component}" at ${path}`);
    }
  });

  Object.entries(slots).forEach(([slotName, children]) => {
    if (!slotNames.has(slotName)) {
      throw new Error(`Unsupported slot "${slotName}" on component "${node.component}" at ${path}`);
    }
    if (!Array.isArray(children)) {
      throw new Error(`Slot "${slotName}" on component "${node.component}" must be an array at ${path}`);
    }

    const allowedChildren = new Set(definition.slots[slotName] || []);
    children.forEach((child, index) => {
      validateNode(child, catalog, `${path}.${slotName}[${index}]`);
      if (!allowedChildren.has(child.component)) {
        throw new Error(`Component "${child.component}" is not allowed in slot "${slotName}" on "${node.component}" at ${path}`);
      }
    });
  });
}

function validateArchetypes(contentArchetype, layoutArchetype) {
  if (!isObject(contentArchetype) || contentArchetype.kind !== 'content-archetype') {
    throw new Error('Content archetype must be a valid content-archetype object');
  }

  if (!isObject(layoutArchetype) || layoutArchetype.kind !== 'layout-archetype') {
    throw new Error('Layout archetype must be a valid layout-archetype object');
  }

  if (contentArchetype.layout !== layoutArchetype.id) {
    throw new Error(`Content archetype "${contentArchetype.id}" must target layout "${layoutArchetype.id}"`);
  }

  const declaredRegions = Object.keys(contentArchetype.regions || {});
  if (declaredRegions.length === 0) {
    throw new Error(`Content archetype "${contentArchetype.id}" must define at least one region`);
  }

  const layoutRegions = new Set(Object.keys(layoutArchetype.regions || {}));
  declaredRegions.forEach((regionName) => {
    if (!layoutRegions.has(regionName)) {
      throw new Error(`Content archetype "${contentArchetype.id}" targets unknown region "${regionName}"`);
    }
    if (!Array.isArray(contentArchetype.regions[regionName]) || contentArchetype.regions[regionName].length === 0) {
      throw new Error(`Content archetype "${contentArchetype.id}" must define a non-empty "${regionName}" region`);
    }
  });

  if (contentArchetype.targetRegion && !declaredRegions.includes(contentArchetype.targetRegion)) {
    throw new Error(`Content archetype "${contentArchetype.id}" must define its target region "${contentArchetype.targetRegion}"`);
  }
}

export function compileContentArchetypeView({
  contentArchetype,
  layoutArchetype,
  catalog,
  target,
  viewId,
  mode = 'replace',
  props = {},
  state = {}
}) {
  validateArchetypes(contentArchetype, layoutArchetype);

  const context = {
    ...(layoutArchetype.defaults || {}),
    ...(contentArchetype.defaults || {}),
    ...(props || {}),
    ...(state || {})
  };

  const resolvedRegions = {};
  Object.entries(contentArchetype.regions || {}).forEach(([regionName, nodes]) => {
    resolvedRegions[regionName] = nodes.map((node) => resolveNode(node, context));
    resolvedRegions[regionName].forEach((node, index) => validateNode(node, catalog, `${regionName}[${index}]`));
  });

  const targetRegion = contentArchetype.targetRegion || 'main';
  const targetNodes = resolvedRegions[targetRegion] || [];

  if (targetNodes.length !== 1) {
    throw new Error(`Content archetype "${contentArchetype.id}" must currently compile to a single root node in "${targetRegion}"`);
  }

  const root = targetNodes[0];
  const componentsUsed = Array.from(
    Object.values(resolvedRegions).reduce((set, nodes) => collectRegionComponents(nodes, set), new Set())
  ).sort();

  return {
    ok: true,
    layoutId: layoutArchetype.id,
    archetypeId: contentArchetype.id,
    contentArchetypeId: contentArchetype.id,
    viewId,
    target,
    mode,
    state: { ...(state || {}) },
    layout: {
      id: layoutArchetype.id,
      regions: Object.keys(layoutArchetype.regions || {}),
      rules: { ...(layoutArchetype.layoutRules || {}) }
    },
    shell: {
      id: layoutArchetype.id,
      intro: {
        eyebrow: context.eyebrow || '',
        headline: context.headline || '',
        supportingText: context.supportingText || ''
      },
      regions: {
        hero: [],
        main: resolvedRegions.main || [],
        aside: resolvedRegions.aside || []
      }
    },
    view: root,
    componentsUsed
  };
}
