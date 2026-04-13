(function () {
  const STORAGE_KEY = 'csma-theme';
  const THEMES = ['light', 'dark', 'contrast'];
  const THEME_LABELS = {
    light: 'Light',
    dark: 'Dark',
    contrast: 'Contrast'
  };

  function safeGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // Ignore storage failures in restricted contexts.
    }
  }

  function getCurrentTheme() {
    const stored = safeGet(STORAGE_KEY);
    return THEMES.includes(stored) ? stored : THEMES[0];
  }

  function getNextTheme(theme) {
    const index = THEMES.indexOf(theme);
    return THEMES[(index + 1) % THEMES.length];
  }

  function applyTheme(theme) {
    if (!THEMES.includes(theme)) {
      return getCurrentTheme();
    }

    document.documentElement.dataset.theme = theme;
    safeSet(STORAGE_KEY, theme);
    return theme;
  }

  function syncToggle(button) {
    const current = getCurrentTheme();
    const next = getNextTheme(current);
    const label = button.querySelector('[data-theme-label]');

    button.dataset.themeActive = current;
    button.dataset.themeNext = next;
    button.setAttribute('aria-label', 'Switch to ' + next + ' theme');

    if (label) {
      label.textContent = 'Theme: ' + (THEME_LABELS[current] || current);
    }
  }

  function syncAllToggles() {
    const buttons = document.querySelectorAll('[data-theme-toggle]');
    buttons.forEach(syncToggle);
  }

  function handleToggleClick() {
    const next = getNextTheme(getCurrentTheme());
    applyTheme(next);
    syncAllToggles();
  }

  function bindThemeToggles() {
    applyTheme(getCurrentTheme());
    const buttons = document.querySelectorAll('[data-theme-toggle]');

    buttons.forEach((button) => {
      button.addEventListener('click', handleToggleClick);
    });

    syncAllToggles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindThemeToggles, { once: true });
  } else {
    bindThemeToggles();
  }

  window.CSMATheme = {
    applyTheme,
    getCurrentTheme,
    syncAllToggles
  };
})();
