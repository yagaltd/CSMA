import { spec, specShell, specKicker, specTitleWithAccent, specFoot } from './_shared.js';

/**
 * cover — opening slide. Always the first slide. Full-viewport with optional
 * background image under a scrim. Center-aligned by default.
 *
 * Config: `{ kicker, title, subtitle, foot?, image?, center=true }`
 *
 * Emits a SPEC TREE (Phase 2.0). deck.js mounts it via the aiui composer's
 * `mountTree()`. To embed any aiui surface inside this layout, drop a
 * `component('comments-thread', { threadId })` (or similar) node anywhere in
 * the tree.
 */
export function createCoverSlide(config = {}) {
    const children = [];
    if (config.image) {
        // Actual image rendered via CSS background-image (set by data-attr →
        // CSS rule, never as inline style). Caller may set CSS in slides.css.
        children.push(spec('div', { className: 'cover-bg', dataset: { image: 'present' } }));
    }
    children.push(spec('div', { className: 'cover-inner', children: [
        specKicker(config.kicker),
        specTitleWithAccent(config.title, { level: 'h1', className: 'display' }),
        config.subtitle ? spec('p', { className: 'subhead', text: String(config.subtitle) }) : null,
        specFoot(config.foot)
    ] }));
    return specShell('cover', { center: true }, children);
}
