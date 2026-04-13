const RENDER_CONTRACT_VERSION = '1.0.0';
const DEFAULT_ROUTE_PATH = '/';

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

function buildLayoutIntro(context) {
  return {
    eyebrow: context.eyebrow || '',
    headline: context.headline || '',
    supportingText: context.supportingText || ''
  };
}

function buildHead({
  pageId,
  pageTitle,
  description,
  routePath,
  canonicalUrl,
  lang = 'en',
  layoutArchetype,
  contentArchetype,
  viewId
}) {
  const tags = [];

  if (description) {
    tags.push({
      tag: 'meta',
      key: 'meta:key:description',
      props: {
        name: 'description',
        content: description
      }
    });
  }

  const canonicalHref = canonicalUrl || routePath;
  if (canonicalHref) {
    tags.push({
      tag: 'link',
      key: 'link:canonical',
      props: {
        rel: 'canonical',
        href: canonicalHref
      }
    });
  }

  return {
    title: pageTitle,
    tags,
    htmlAttrs: {
      attrs: {
        lang
      },
      classes: [`layout-${layoutArchetype.id}`, `page-${pageId}`],
      style: {}
    },
    bodyAttrs: {
      attrs: {
        'data-view-id': viewId,
        'data-layout-id': layoutArchetype.id,
        'data-content-id': contentArchetype.id
      },
      classes: [],
      style: {}
    }
  };
}

function buildResolvedRegions(contentArchetype, context, catalog) {
  const resolvedRegions = {};
  Object.entries(contentArchetype.regions || {}).forEach(([regionName, nodes]) => {
    resolvedRegions[regionName] = nodes.map((node) => resolveNode(node, context));
    resolvedRegions[regionName].forEach((node, index) => validateNode(node, catalog, `${regionName}[${index}]`));
  });
  return resolvedRegions;
}

function buildRenderRegions(layoutArchetype, resolvedRegions) {
  const declaredLayoutRegions = Object.keys(layoutArchetype.regions || {});
  const regions = {
    hero: Array.isArray(resolvedRegions.hero) ? resolvedRegions.hero : [],
    main: Array.isArray(resolvedRegions.main) ? resolvedRegions.main : [],
    aside: Array.isArray(resolvedRegions.aside) ? resolvedRegions.aside : []
  };

  declaredLayoutRegions.forEach((regionName) => {
    if (!Array.isArray(regions[regionName])) {
      regions[regionName] = Array.isArray(resolvedRegions[regionName]) ? resolvedRegions[regionName] : [];
    }
  });

  Object.entries(resolvedRegions).forEach(([regionName, nodes]) => {
    if (!Array.isArray(regions[regionName])) {
      regions[regionName] = nodes;
    }
  });

  return regions;
}

function classifyComponents(componentsUsed, catalog) {
  return componentsUsed.reduce((classification, componentId) => {
    const definition = catalog[componentId] || {};
    const componentType = definition.componentType;
    if (componentType === 'II') {
      classification.typeIIComponents.push(componentId);
      (definition.runtimeDependencies || []).forEach((dependency) => classification.runtimeDependencies.add(dependency));
    } else {
      classification.typeIComponents.push(componentId);
    }
    return classification;
  }, {
    typeIComponents: [],
    typeIIComponents: [],
    runtimeDependencies: new Set()
  });
}

export function compileContentArchetypeRenderContract({
  contentArchetype,
  layoutArchetype,
  catalog,
  viewId,
  props = {},
  state = {},
  source,
  routePath,
  pageId,
  canonicalUrl,
  lang = 'en'
}) {
  validateArchetypes(contentArchetype, layoutArchetype);

  const context = {
    ...(layoutArchetype.defaults || {}),
    ...(contentArchetype.defaults || {}),
    ...(props || {}),
    ...(state || {})
  };

  const resolvedRegions = buildResolvedRegions(contentArchetype, context, catalog);

  const targetRegion = contentArchetype.targetRegion || 'main';
  const targetNodes = resolvedRegions[targetRegion] || [];

  if (targetNodes.length !== 1) {
    throw new Error(`Content archetype "${contentArchetype.id}" must currently compile to a single root node in "${targetRegion}"`);
  }

  const componentsUsed = Array.from(
    Object.values(resolvedRegions).reduce((set, nodes) => collectRegionComponents(nodes, set), new Set())
  ).sort();
  const { typeIComponents, typeIIComponents, runtimeDependencies } = classifyComponents(componentsUsed, catalog);
  const resolvedPageId = pageId || contentArchetype.id;
  const resolvedRoutePath = routePath || (contentArchetype.id ? `${DEFAULT_ROUTE_PATH}${contentArchetype.id}` : DEFAULT_ROUTE_PATH);
  const pageTitle = context.title || contentArchetype.defaults?.title || contentArchetype.description || viewId;
  const description = context.description || contentArchetype.defaults?.description || layoutArchetype.defaults?.supportingText || '';
  const intro = buildLayoutIntro(context);
  const activationRequired = typeIIComponents.length > 0;

  return {
    id: resolvedPageId,
    kind: 'render-contract',
    version: RENDER_CONTRACT_VERSION,
    page: {
      id: resolvedPageId,
      viewId,
      contentArchetypeId: contentArchetype.id,
      layoutArchetypeId: layoutArchetype.id,
      routePath: resolvedRoutePath,
      title: pageTitle
    },
    layout: {
      id: layoutArchetype.id,
      regions: Object.keys(layoutArchetype.regions || {}),
      rules: { ...(layoutArchetype.layoutRules || {}) },
      intro
    },
    head: buildHead({
      pageId: resolvedPageId,
      pageTitle,
      description,
      routePath: resolvedRoutePath,
      canonicalUrl,
      lang,
      layoutArchetype,
      contentArchetype,
      viewId
    }),
    regions: buildRenderRegions(layoutArchetype, resolvedRegions),
    activation: {
      bootstrap: 'full-runtime',
      mode: 'page',
      required: activationRequired,
      ...(source ? { source } : {}),
      runtimeDependencies: Array.from(runtimeDependencies).sort(),
      ...(isObject(state) && Object.keys(state).length > 0 ? { initialState: { ...state } } : {}),
      typeIComponents,
      typeIIComponents
    },
    componentsUsed
  };
}
