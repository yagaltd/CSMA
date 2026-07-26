import { spec, specShell, specKicker, specHeading, specContainer } from './_shared.js';

/**
 * steps — horizontal numbered process. 3–5 sequential steps.
 *
 * Config: `{ kicker?, title?, items: [{title, body}], center=false }`
 *
 * Emits a SPEC TREE (Phase 2.1). Mounted by `AIUIComposerService.mountTree()`.
 */
export function createStepsSlide(config = {}) {
    const items = Array.isArray(config.items) ? config.items : [];

    const header = spec('div', { className: 'steps-header', children: [
        specKicker(config.kicker),
        specHeading(config.title)
    ] });

    const row = spec('div', {
        className: 'steps-row',
        children: items.map((item, i) => buildStep(item, i + 1))
    });

    return specShell('steps', { center: false }, [specContainer([header, row])]);
}

function buildStep(item = {}, n) {
    return spec('div', {
        className: 'step-item',
        dataset: { step: String(n) },
        children: [
            spec('p', { className: 'step-num', text: String(n) }),
            item.title ? spec('h3', { className: 'step-title', text: String(item.title) }) : null,
            item.body ? spec('p', { className: 'step-body', text: String(item.body) }) : null
        ]
    });
}
