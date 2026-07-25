import { el, createSlideShell, container } from './_shared.js';

/**
 * section — chapter divider with ghost number. Used in long decks (~12+ slides)
 * to mark transitions between parts.
 *
 * Config: `{ n (chapter number), kicker?, title? }`
 */
export function createSectionSlide(config = {}) {
    const slide = createSlideShell('section', { center: true });
    if (Number.isFinite(config.n)) slide.dataset.chapter = String(config.n);

    const ghost = el('div', { className: 'section-ghost', text: formatChapter(config.n) });
    const inner = el('div', { className: 'section-inner', children: [
        config.kicker ? el('p', { className: 'kicker', text: String(config.kicker) }) : null,
        config.title ? el('h1', { className: 'display', text: String(config.title) }) : null
    ].filter(Boolean) });

    slide.appendChild(container([ghost, inner]));
    return slide;
}

function formatChapter(n) {
    if (!Number.isFinite(n)) return '';
    // Roman numerals for chapters 1–20, then plain number
    const romans = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
    return n >= 1 && n <= 20 ? romans[n - 1] : String(n);
}
