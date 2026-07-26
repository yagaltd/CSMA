import { spec, specShell } from './_shared.js';

/**
 * cta — closing slide. Always the last slide. Title + subtitle (contact).
 *
 * Config: `{ title, subtitle?, notes?, center=true }`
 *
 * Emits a SPEC TREE (Phase 2.1). Mounted by `AIUIComposerService.mountTree()`.
 */
export function createCtaSlide(config = {}) {
    const inner = spec('div', { className: 'cta-inner', children: [
        config.title ? spec('h1', { className: 'display', text: String(config.title) }) : null,
        config.subtitle ? spec('p', { className: 'subhead', text: String(config.subtitle) }) : null
    ] });
    return specShell('cta', { center: true }, [inner]);
}
