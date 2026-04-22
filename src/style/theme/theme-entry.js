import { registerThemeToggle, applyStoredTheme } from './theme-manager.js';

const THEME_LABELS = {
    light: 'Light',
    dark: 'Dark',
    contrast: 'Contrast',
};

function bindToggles() {
    const buttons = Array.from(document.querySelectorAll('[data-theme-toggle]'));
    buttons.forEach((button) => {
        registerThemeToggle(button, ({ theme, next }) => {
            button.setAttribute('data-theme-active', theme);
            button.setAttribute('aria-label', `Switch to ${next} theme`);

            const label = button.querySelector('[data-theme-label]');
            if (label) {
                label.textContent = `Theme: ${THEME_LABELS[theme] || theme}`;
            }
        });
    });
}

applyStoredTheme();
document.addEventListener('DOMContentLoaded', bindToggles);
