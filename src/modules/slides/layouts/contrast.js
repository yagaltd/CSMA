import { el, createSlideShell, createKicker, createHeading, container } from './_shared.js';

/**
 * contrast — before/after comparison panels. Each side has a label, title,
 * and bullet points.
 *
 * Config: `{ kicker?, title?, left: {label,title,points[]}, right: {...}, center=true }`
 */
export function createContrastSlide(config = {}) {
    const slide = createSlideShell('contrast', { center: true });

    const header = el('div', { className: 'contrast-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const grid = el('div', { className: 'contrast-grid', children: [
        buildPanel('left', config.left),
        buildPanel('right', config.right)
    ].filter(Boolean) });

    slide.appendChild(container([header, grid]));
    return slide;
}

function buildPanel(side, spec = {}) {
    const panel = el('div', { className: 'contrast-panel', dataset: { side } });
    const children = [];
    if (spec.label) children.push(el('p', { className: 'kicker', text: String(spec.label) }));
    if (spec.title) children.push(el('h3', { className: 'panel-title', text: String(spec.title) }));
    if (Array.isArray(spec.points)) {
        const ul = el('ul', { className: 'panel-points' });
        for (const point of spec.points) {
            ul.appendChild(el('li', { text: String(point) }));
        }
        children.push(ul);
    }
    for (const child of children.filter(Boolean)) panel.appendChild(child);
    return panel;
}
