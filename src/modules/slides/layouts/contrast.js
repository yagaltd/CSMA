import { spec, specShell, specKicker, specHeading, specContainer } from './_shared.js';

/**
 * contrast — before/after comparison panels. Each side has a label, title,
 * and bullet points.
 *
 * Config: `{ kicker?, title?, left: {label,title,points[]}, right: {...}, center=true }`
 *
 * Emits a SPEC TREE (Phase 2.1). Byte-identical DOM to the prior el() version.
 */
export function createContrastSlide(config = {}) {
    const header = spec('div', { className: 'contrast-header', children: [
        specKicker(config.kicker),
        specHeading(config.title)
    ] });

    const grid = spec('div', { className: 'contrast-grid', children: [
        buildPanel('left', config.left),
        buildPanel('right', config.right)
    ] });

    return specShell('contrast', { center: true }, [specContainer([header, grid])]);
}

function buildPanel(side, panelConfig = {}) {
    const children = [];
    if (panelConfig.label) children.push(spec('p', { className: 'kicker', text: String(panelConfig.label) }));
    if (panelConfig.title) children.push(spec('h3', { className: 'panel-title', text: String(panelConfig.title) }));
    if (Array.isArray(panelConfig.points)) {
        children.push(spec('ul', {
            className: 'panel-points',
            children: panelConfig.points.map((point) => spec('li', { text: String(point) }))
        }));
    }
    return spec('div', { className: 'contrast-panel', dataset: { side }, children });
}
