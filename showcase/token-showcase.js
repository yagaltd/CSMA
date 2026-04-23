const STORAGE_KEY = 'csma-theme';
const THEMES = ['light', 'dark', 'contrast'];

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* file:// or restricted storage */
  }
}

function getCurrentTheme() {
  const stored = safeGet(STORAGE_KEY);
  const current = document.documentElement.dataset.theme;
  if (THEMES.includes(stored)) return stored;
  return THEMES.includes(current) ? current : THEMES[0];
}

function applyTheme(theme) {
  if (!THEMES.includes(theme)) return;
  document.documentElement.dataset.theme = theme;
  safeSet(STORAGE_KEY, theme);
}

function syncThemeButtons() {
  const current = getCurrentTheme();
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    const active = button.dataset.themeChoice === current;
    button.setAttribute('aria-pressed', String(active));
  });
}

function bindThemeButtons() {
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const theme = button.dataset.themeChoice;
      applyTheme(theme);
      syncThemeButtons();
      updateComputedTokenValues();
    });
  });
}

function tokenLabelFromPath(path) {
  const token = path.split('.').at(-1) || path;
  return token
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function cssTokenName(name) {
  return `--${name}`;
}

function readComputedVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(cssTokenName(name))
    .trim();
}

function updateComputedTokenValues() {
  document.querySelectorAll('[data-token-value]').forEach((node) => {
    const token = node.dataset.tokenValue;
    const computed = readComputedVar(token);
    node.textContent = computed || cssTokenName(token);
  });
}

function applyFallbackLabels() {
  document.querySelectorAll('[data-token-label]').forEach((node) => {
    node.textContent = tokenLabelFromPath(node.dataset.tokenLabel || '');
  });
}

function boot() {
  applyTheme(getCurrentTheme());
  bindThemeButtons();
  syncThemeButtons();
  applyFallbackLabels();
  updateComputedTokenValues();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
