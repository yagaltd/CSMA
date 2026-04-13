function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (typeof text === 'string' && text !== '') {
    element.textContent = text;
  }
  return element;
}

function renderInput(node) {
  const input = document.createElement('input');
  input.className = 'input';
  input.type = node.props.type || 'text';
  input.name = node.props.name || '';
  input.id = node.props.id || '';
  input.placeholder = node.props.placeholder || '';
  input.autocomplete = node.props.autocomplete || '';
  input.value = node.props.value || '';
  if (node.props.state) {
    input.dataset.state = node.props.state;
  }
  return input;
}

function renderButton(node) {
  const button = document.createElement('button');
  button.className = 'button';
  button.type = 'button';
  if (node.props.variant) {
    button.dataset.variant = node.props.variant;
  }
  if (node.props.size) {
    button.dataset.size = node.props.size;
  }
  if (node.props.shape) {
    button.dataset.shape = node.props.shape;
  }
  button.textContent = node.props.text || node.props.label || 'Action';
  return button;
}

function renderBadge(node) {
  const badge = document.createElement('span');
  badge.className = 'badge';
  if (node.props.variant) {
    badge.dataset.variant = node.props.variant;
  }
  if (node.props.size) {
    badge.dataset.size = node.props.size;
  }
  badge.textContent = node.props.text || node.props.label || node.props.value || 'Badge';
  return badge;
}

function renderField(node) {
  const wrapper = createTextElement('div', 'field');
  const label = createTextElement('label', 'field__label', node.props.label || '');
  if (node.props.for) {
    label.setAttribute('for', node.props.for);
  }
  if (node.props.required === 'true') {
    label.dataset.required = 'true';
  }

  const control = createTextElement('div', 'field__control');
  (node.slots?.control || []).forEach((child) => {
    control.appendChild(renderNode(child));
  });

  wrapper.appendChild(label);
  wrapper.appendChild(control);

  if (node.props.helper) {
    wrapper.appendChild(createTextElement('p', 'field__helper', node.props.helper));
  }
  if (node.props.error) {
    wrapper.appendChild(createTextElement('p', 'field__error', node.props.error));
  }

  return wrapper;
}

function renderCard(node) {
  const card = createTextElement('article', 'card');
  if (node.props.tone) {
    card.dataset.tone = node.props.tone;
  }

  const header = createTextElement('header', 'card__header');
  header.appendChild(createTextElement('h2', 'card__title', node.props.title || 'Untitled'));
  if (node.props.description) {
    header.appendChild(createTextElement('p', 'card__description', node.props.description));
  }
  card.appendChild(header);

  const body = createTextElement('div', 'card__body');
  (node.slots?.body || []).forEach((child) => {
    body.appendChild(renderNode(child));
  });
  card.appendChild(body);

  if (Array.isArray(node.slots?.footer) && node.slots.footer.length > 0) {
    const footer = createTextElement('footer', 'card__footer');
    node.slots.footer.forEach((child) => {
      footer.appendChild(renderNode(child));
    });
    card.appendChild(footer);
  }

  return card;
}

export function renderNode(node) {
  switch (node.component) {
    case 'card':
      return renderCard(node);
    case 'field':
      return renderField(node);
    case 'input':
      return renderInput(node);
    case 'button':
      return renderButton(node);
    case 'badge':
      return renderBadge(node);
    default:
      return createTextElement('pre', '', `Unknown component: ${node.component}`);
  }
}

export function renderViewModel(model, mount) {
  if (!mount) {
    throw new Error('Mount element is required');
  }

  mount.replaceChildren(renderNode(model.view));
}
