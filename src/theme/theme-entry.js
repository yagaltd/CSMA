import { registerThemeToggle, applyStoredTheme, getNextThemeLabel } from './theme-manager.js';

function bindToggles() {
    const buttons = Array.from(document.querySelectorAll('[data-theme-toggle]'));
    buttons.forEach((button) => {
        registerThemeToggle(button, ({ theme, next }) => {
            button.setAttribute('data-theme-active', theme);
            button.setAttribute('aria-label', `Switch to ${next} theme`);
            button.textContent = `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)} → ${next}`;
        });
    });
}

applyStoredTheme();
document.addEventListener('DOMContentLoaded', bindToggles);
