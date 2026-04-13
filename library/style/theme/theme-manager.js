const STORAGE_KEY = 'csma-theme';
const THEMES = ['light', 'dark', 'contrast'];

function safeGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* file:// or restricted */ }
}

export function getCurrentTheme() {
    const stored = safeGet(STORAGE_KEY);
    return THEMES.includes(stored) ? stored : THEMES[0];
}

export function applyTheme(theme) {
    if (!THEMES.includes(theme)) {
        return;
    }
    document.documentElement.dataset.theme = theme;
    safeSet(STORAGE_KEY, theme);
}

export function cycleTheme() {
    const current = getCurrentTheme();
    const index = THEMES.indexOf(current);
    const next = THEMES[(index + 1) % THEMES.length];
    applyTheme(next);
    return next;
}

export function getNextThemeLabel() {
    const current = getCurrentTheme();
    const index = THEMES.indexOf(current);
    const next = THEMES[(index + 1) % THEMES.length];
    return next;
}

export function registerThemeToggle(button, callback) {
    if (!button) return () => {};

    const updateLabel = () => {
        const current = getCurrentTheme();
        const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
        button.dataset.themeNext = next;
        if (typeof callback === 'function') {
            callback({ theme: current, next });
        }
    };

    const handleClick = () => {
        const next = cycleTheme();
        button.dataset.themeNext = getNextThemeLabel();
        if (typeof callback === 'function') {
            callback({ theme: next, next: getNextThemeLabel() });
        }
    };

    updateLabel();
    button.addEventListener('click', handleClick);

    return () => {
        button.removeEventListener('click', handleClick);
    };
}

export function applyStoredTheme() {
    applyTheme(getCurrentTheme());
}
