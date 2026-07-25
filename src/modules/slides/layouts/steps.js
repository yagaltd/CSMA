import { el, createSlideShell, createKicker, createHeading, container } from './_shared.js';

/**
 * steps — horizontal numbered process. 3–5 sequential steps.
 *
 * Config: `{ kicker?, title?, items: [{title, body}], center=false }`
 */
export function createStepsSlide(config = {}) {
    const slide = createSlideShell('steps', { center: false });

    const header = el('div', { className: 'steps-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const row = el('div', { className: 'steps-row' });
    const items = Array.isArray(config.items) ? config.items : [];
    items.forEach((item, i) => {
        row.appendChild(buildStep(item, i + 1));
    });

    slide.appendChild(container([header, row]));
    return slide;
}

function buildStep(item = {}, n) {
    const step = el('div', { className: 'step-item', dataset: { step: String(n) } });
    const children = [
        el('p', { className: 'step-num', text: String(n) }),
        item.title ? el('h3', { className: 'step-title', text: String(item.title) }) : null,
        item.body ? el('p', { className: 'step-body', text: String(item.body) }) : null
    ];
    for (const child of children.filter(Boolean)) step.appendChild(child);
    return step;
}
