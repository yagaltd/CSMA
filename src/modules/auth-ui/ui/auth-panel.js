const VIEW_TITLES = {
  login: 'Sign in',
  register: 'Create account',
  'forgot-password': 'Reset password',
  'reset-password': 'Set new password',
  'verify-email': 'Verify email',
  status: 'Account status'
};

const FIELD_SETS = {
  login: [
    { name: 'email', label: 'Email', type: 'email', autocomplete: 'email', required: true },
    { name: 'password', label: 'Password', type: 'password', autocomplete: 'current-password', required: true }
  ],
  register: [
    { name: 'name', label: 'Name', type: 'text', autocomplete: 'name' },
    { name: 'email', label: 'Email', type: 'email', autocomplete: 'email', required: true },
    { name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password', required: true }
  ],
  'forgot-password': [
    { name: 'email', label: 'Email', type: 'email', autocomplete: 'email', required: true }
  ],
  'reset-password': [
    { name: 'token', label: 'Reset token', type: 'text', autocomplete: 'one-time-code', required: true },
    { name: 'password', label: 'New password', type: 'password', autocomplete: 'new-password', required: true }
  ],
  'verify-email': [
    { name: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
    { name: 'token', label: 'Verification token', type: 'text', autocomplete: 'one-time-code', required: true }
  ]
};

function appendText(parent, tag, className, text) {
  const node = parent.ownerDocument.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.append(node);
  return node;
}

function createButton(documentRef, label, { variant = 'ghost', type = 'button', action, view } = {}) {
  const button = documentRef.createElement('button');
  button.className = 'button';
  button.type = type;
  button.dataset.variant = variant;
  if (action) button.dataset.authUiAction = action;
  if (view) button.dataset.authUiView = view;
  button.textContent = label;
  return button;
}

function createField(documentRef, spec, values = {}) {
  const field = documentRef.createElement('div');
  field.className = 'field';

  const id = `auth-ui-${spec.name}`;
  const label = appendText(field, 'label', 'field__label', spec.label);
  label.setAttribute('for', id);

  const control = documentRef.createElement('div');
  control.className = 'field__control';
  const input = documentRef.createElement('input');
  input.className = 'input';
  input.id = id;
  input.name = spec.name;
  input.type = spec.type || 'text';
  input.autocomplete = spec.autocomplete || 'off';
  if (spec.required) input.required = true;
  if (values[spec.name] !== undefined) input.value = values[spec.name];
  control.append(input);
  field.append(control);
  return field;
}

function createHoneypot(documentRef) {
  const input = documentRef.createElement('input');
  input.type = 'text';
  input.name = 'website';
  input.tabIndex = -1;
  input.autocomplete = 'off';
  input.setAttribute('aria-hidden', 'true');
  input.dataset.authUiHoneypot = 'true';
  input.style.position = 'absolute';
  input.style.inlineSize = '1px';
  input.style.blockSize = '1px';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  return input;
}

function createForm(documentRef, state, view) {
  const form = documentRef.createElement('form');
  form.className = 'auth-ui-panel__form';
  form.dataset.authUiForm = view;
  form.noValidate = false;
  form.append(createHoneypot(documentRef));

  for (const field of FIELD_SETS[view] || []) {
    form.append(createField(documentRef, field, state.values?.[view] || {}));
  }

  if (state.errors && Object.keys(state.errors).length > 0) {
    const error = appendText(form, 'p', 'auth-ui-panel__error', Object.values(state.errors).join(' '));
    error.setAttribute('role', 'alert');
  }

  const actions = documentRef.createElement('div');
  actions.className = 'auth-ui-panel__actions';
  const label = view === 'forgot-password'
    ? 'Send reset link'
    : view === 'reset-password'
      ? 'Reset password'
      : view === 'verify-email'
        ? 'Verify email'
        : view === 'register'
          ? 'Create account'
          : 'Sign in';
  actions.append(createButton(documentRef, label, { variant: 'primary', type: 'submit' }));
  if (view === 'verify-email') {
    actions.append(createButton(documentRef, 'Resend verification', { action: 'resend-verification' }));
  }
  form.append(actions);

  return form;
}

function createNav(documentRef, activeView) {
  const nav = documentRef.createElement('nav');
  nav.className = 'auth-ui-panel__nav';
  nav.setAttribute('aria-label', 'Auth views');
  [
    ['login', 'Sign in'],
    ['register', 'Register'],
    ['forgot-password', 'Forgot'],
    ['verify-email', 'Verify'],
    ['status', 'Status']
  ].forEach(([view, label]) => {
    const button = createButton(documentRef, label, { view });
    button.setAttribute('aria-pressed', String(view === activeView));
    nav.append(button);
  });
  return nav;
}

function createStatus(documentRef, state) {
  const user = state.user || null;
  const wrap = documentRef.createElement('div');
  wrap.className = 'auth-ui-panel__status';
  appendText(wrap, 'strong', null, user ? (user.name || user.email || user.id || 'Authenticated user') : 'Guest session');
  appendText(wrap, 'span', null, user ? `Role: ${state.role || user.role || 'user'}` : 'No active user.');
  const actions = documentRef.createElement('div');
  actions.className = 'auth-ui-panel__actions';
  actions.append(createButton(documentRef, 'Refresh', { action: 'refresh-session' }));
  actions.append(createButton(documentRef, 'Logout', { action: 'logout' }));
  wrap.append(actions);
  return wrap;
}

export function renderAuthPanel({ state, documentRef = globalThis.document } = {}) {
  const view = state?.view || 'login';
  const panel = documentRef.createElement('section');
  panel.className = 'auth-ui-panel';
  panel.dataset.authUiPanel = '';
  panel.dataset.view = view;

  const header = documentRef.createElement('header');
  header.className = 'auth-ui-panel__header';
  appendText(header, 'h3', 'auth-ui-panel__title', VIEW_TITLES[view] || VIEW_TITLES.login);
  const badge = appendText(header, 'span', 'badge', state?.status === 'submitting' ? 'Working' : (state?.authenticated ? 'Signed in' : 'Guest'));
  badge.dataset.variant = state?.authenticated ? 'soft-success' : 'soft-primary';
  panel.append(header);

  if (state?.message) {
    appendText(panel, 'p', 'auth-ui-panel__message', state.message);
  }
  if (state?.error) {
    const error = appendText(panel, 'p', 'auth-ui-panel__error', state.error);
    error.setAttribute('role', 'alert');
  }

  panel.append(createNav(documentRef, view));

  if (view === 'status') {
    panel.append(createStatus(documentRef, state));
  } else {
    panel.append(createForm(documentRef, state, view));
    if (view === 'login') {
      const oauth = documentRef.createElement('div');
      oauth.className = 'auth-ui-panel__oauth';
      oauth.append(createButton(documentRef, 'Continue with OAuth', { action: 'oauth' }));
      panel.append(oauth);
    }
  }

  return panel;
}
