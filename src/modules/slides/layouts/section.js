import { spec, specContainer } from './_shared.js';

/**
 * section — chapter divider with ghost number. Used in long decks (~12+ slides)
 * to mark transitions between parts.
 *
 * Config: `{ n (chapter number), kicker?, title? }`
 *
 * Emits a SPEC TREE (Phase 2.1). Mounted by `AIUIComposerService.mountTree()`.
 * Shell is built directly (not via specShell) because this layout adds a
 * `data-chapter` attribute alongside `data-layout`.
 */
export function createSectionSlide(config = {}) {
    const dataset = { layout: 'section' };
    if (Number.isFinite(config.n)) dataset.chapter = String(config.n);

    const ghost = spec('div', { className: 'section-ghost', text: formatChapter(config.n) });
    const inner = spec('div', { className: 'section-inner', children: [
        config.kicker ? spec('p', { className: 'kicker', text: String(config.kicker) }) : null,
        config.title ? spec('h1', { className: 'display', text: String(config.title) }) : null
    ] });

    return spec('div', { className: 'slide center', dataset, children: [specContainer([ghost, inner])] });
}

function formatChapter(n) {
    if (!Number.isFinite(n)) return '';
    // Roman numerals for chapters 1–20, then plain number
    const romans = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
    return n >= 1 && n <= 20 ? romans[n - 1] : String(n);
}
