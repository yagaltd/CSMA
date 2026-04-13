function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function applySelectorText(root, selectors = [], text) {
  selectors.forEach((selector) => {
    const targets = [];
    if (selector === ':root') {
      targets.push(root);
    } else {
      if (root.matches?.(selector)) {
        targets.push(root);
      }
      root.querySelectorAll(selector).forEach((node) => targets.push(node));
    }

    targets.forEach((node) => {
      node.textContent = text;
    });
  });
}

function findAttributeTarget(root, attributeName) {
  if (attributeName === 'for') {
    return root.matches?.('[for], label') ? root : root.querySelector('[for], label') || root;
  }

  if (root.matches?.(`[${attributeName}]`)) {
    return root;
  }

  const direct = root.querySelector(`[${attributeName}]`);
  if (direct) {
    return direct;
  }

  if (['id', 'type', 'name', 'value', 'placeholder', 'autocomplete'].includes(attributeName)) {
    return root.matches?.('input, textarea, select, button') ? root : root.querySelector('input, textarea, select, button') || root;
  }

  if (attributeName === 'href') {
    return root.matches?.('a') ? root : root.querySelector('a') || root;
  }

  if (['src', 'alt'].includes(attributeName)) {
    return root.matches?.('img') ? root : root.querySelector('img') || root;
  }

  return root;
}

function applyPropToDom(root, definition, propName, propValue) {
  const value = String(propValue);
  const textTargets = definition.textTargets || {};

  if (propName === 'title') {
    applySelectorText(root, textTargets.title || [], value);
  } else if (['description', 'helper', 'error', 'body'].includes(propName)) {
    applySelectorText(root, textTargets.description || [], value);
  } else if (['label', 'text', 'value'].includes(propName)) {
    applySelectorText(root, textTargets.label || [], value);
  }

  if (['variant', 'size', 'shape', 'theme', 'tone', 'align', 'state'].includes(propName)) {
    root.dataset[propName] = value;
    return;
  }

  if (propName === 'required') {
    const target = root.matches?.('label') ? root : root.querySelector('label') || root;
    if (value === 'true') {
      target.dataset.required = 'true';
    }
    return;
  }

  if (['id', 'type', 'name', 'value', 'placeholder', 'autocomplete', 'href', 'src', 'alt', 'for'].includes(propName)) {
    const target = findAttributeTarget(root, propName);
    target.setAttribute(propName, value);
  }
}

function buildTypeIIBoundary(documentRef, node, definition) {
  const activation = isObject(definition.activation) ? definition.activation : {};
  const strategy = activation.strategy || 'unsupported';

  if (strategy === 'client-only-fallback') {
    const tagName = activation.placeholderTag || 'div';
    const boundary = documentRef.createElement(tagName);
    if (activation.placeholderClass) {
      boundary.className = activation.placeholderClass;
    }
    boundary.dataset.component = node.component;
    boundary.dataset.activationBoundary = 'client-only-fallback';
    if (activation.placeholderText) {
      boundary.textContent = activation.placeholderText;
    }
    return boundary;
  }

  if (strategy === 'server-shell') {
    const container = documentRef.createElement('div');
    container.innerHTML = (definition.render?.template || '').trim();
    const root = container.firstElementChild;
    if (!root) {
      throw new Error(`Type II component "${node.component}" requires server-shell markup.`);
    }
    root.dataset.component = node.component;
    root.dataset.activationBoundary = 'server-shell';
    return root;
  }

  throw new Error(`Type II component "${node.component}" does not declare a supported activation strategy.`);
}

export function renderNodeToDom(documentRef, node, catalog) {
  const definition = catalog[node.component];
  if (!definition) {
    throw new Error(`Unknown component "${node.component}" in renderContractToDom.`);
  }

  if (definition.componentType === 'II') {
    return buildTypeIIBoundary(documentRef, node, definition);
  }

  const container = documentRef.createElement('div');
  container.innerHTML = (definition.render?.template || '').trim();
  const root = container.firstElementChild;
  if (!root) {
    throw new Error(`Component "${node.component}" template must produce a root element.`);
  }

  Object.entries(node.props || {}).forEach(([propName, propValue]) => {
    applyPropToDom(root, definition, propName, propValue);
  });

  Object.entries(node.slots || {}).forEach(([slotName, children]) => {
    const slotDefinition = definition.slotDefinitions?.[slotName];
    if (!slotDefinition) {
      return;
    }

    const target = slotDefinition.selector === ':root'
      ? root
      : root.querySelector(slotDefinition.selector);

    if (!target) {
      throw new Error(`Component "${node.component}" is missing slot target "${slotName}" (${slotDefinition.selector}).`);
    }

    target.replaceChildren();
    children.forEach((child) => {
      target.appendChild(renderNodeToDom(documentRef, child, catalog));
    });
  });

  return root;
}

export function renderRegionToDom(documentRef, nodes, catalog) {
  const fragment = documentRef.createDocumentFragment();
  (nodes || []).forEach((node) => {
    fragment.appendChild(renderNodeToDom(documentRef, node, catalog));
  });
  return fragment;
}

export function renderContractPage(documentRef, contract, catalog) {
  if (!documentRef) {
    throw new Error('renderContractPage requires a document.');
  }
  if (!isObject(contract)) {
    throw new Error('renderContractPage requires a render contract.');
  }

  const pageShell = documentRef.createElement('main');
  pageShell.className = 'csma-static-page';
  pageShell.dataset.pageId = contract.page.id;
  pageShell.dataset.layoutId = contract.layout.id;

  const shell = documentRef.createElement('section');
  shell.className = 'stack csma-static-shell';
  shell.dataset.gap = 'xl';
  shell.dataset.layout = contract.layout.id;
  pageShell.appendChild(shell);

  const intro = contract.layout.intro || {};
  if (intro.eyebrow || intro.headline || intro.supportingText) {
    const hero = documentRef.createElement('article');
    hero.className = 'card';
    const heroHeader = documentRef.createElement('header');
    heroHeader.className = 'card__header';

    if (intro.eyebrow) {
      const badge = documentRef.createElement('span');
      badge.className = 'badge';
      badge.textContent = intro.eyebrow;
      heroHeader.appendChild(badge);
    }
    if (intro.headline) {
      const title = documentRef.createElement('h1');
      title.className = 'card__title';
      title.textContent = intro.headline;
      heroHeader.appendChild(title);
    }
    if (intro.supportingText) {
      const text = documentRef.createElement('p');
      text.className = 'card__description';
      text.textContent = intro.supportingText;
      heroHeader.appendChild(text);
    }

    hero.appendChild(heroHeader);
    shell.appendChild(hero);
  }

  const grid = documentRef.createElement('section');
  grid.className = 'grid';
  grid.dataset.responsiveColumns = contract.regions.aside?.length ? '2' : '1';
  shell.appendChild(grid);

  const main = documentRef.createElement('div');
  main.className = 'stack';
  main.dataset.gap = 'lg';
  main.appendChild(renderRegionToDom(documentRef, contract.regions.main, catalog));
  grid.appendChild(main);

  if ((contract.regions.aside || []).length > 0) {
    const aside = documentRef.createElement('aside');
    aside.className = 'stack';
    aside.dataset.gap = 'lg';
    aside.appendChild(renderRegionToDom(documentRef, contract.regions.aside, catalog));
    grid.appendChild(aside);
  }

  return pageShell;
}

export function mountRenderContractPage({ documentRef = document, mount, contract, catalog }) {
  if (!mount) {
    throw new Error('mountRenderContractPage requires a mount element.');
  }

  const page = renderContractPage(documentRef, contract, catalog);
  mount.replaceChildren(page);
  return page;
}
