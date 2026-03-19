/**
 * Theme Loader Script
 * Immediately loads theme from localStorage to prevent flash
 * Include this script in all demo pages
 */

(function () {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
        document.documentElement.dataset.theme = savedTheme;
    }
})();
