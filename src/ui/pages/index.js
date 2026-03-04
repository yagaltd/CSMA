
const ICONS = {
  sun: '/src/ui/icons/sun.svg',
  moon: '/src/ui/icons/moon.svg'
};

function updateToggleUI(theme, icon, label) {
  if (!icon || !label) return;
  if (theme === 'dark') {
    icon.src = ICONS.sun;
    label.textContent = 'Light';
  } else {
    icon.src = ICONS.moon;
    label.textContent = 'Dark';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('themeToggle');
  const icon = toggle?.querySelector('.theme-icon');
  const label = toggle?.querySelector('.theme-label');

  const initialTheme = document.documentElement.dataset.theme || localStorage.getItem('theme') || 'light';
  document.documentElement.dataset.theme = initialTheme;
  localStorage.setItem('theme', initialTheme);
  updateToggleUI(initialTheme, icon, label);

  const managedByMain = toggle?.dataset.themeBound === 'true';
  toggle?.addEventListener('click', () => {
    if (managedByMain) {
      requestAnimationFrame(() => {
        const next = document.documentElement.dataset.theme || localStorage.getItem('theme') || 'light';
        updateToggleUI(next, icon, label);
      });
    } else {
      const current = document.documentElement.dataset.theme || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
      updateToggleUI(next, icon, label);
    }
  });
});
