import { el, createSlideShell, createKicker, createHeading, createBody, container, formatFigure } from './_shared.js';

/**
 * globe — canvas 3D globe with markers + arcs. Used ONLY for genuinely
 * geographic stories (per §12.7).
 *
 * Canvas renderer is a Phase 5+ concern — the full bolt-slides GlobeCanvas
 * port is non-trivial and depends on a per-frame rAF loop. v1 ships the DOM
 * shell with markers as a styled list, plus a `[data-globe]` slot the canvas
 * will mount into when fully ported. Stats render as a small grid alongside.
 *
 * Config: `{ kicker?, title?, body?, markers: [{location:[lat,lng],label?,value?,size?}], arcs:[{from,to}], stats:[{value,label}] }`
 */
export function createGlobeSlide(config = {}) {
    const slide = createSlideShell('globe', { center: false });

    const header = el('div', { className: 'globe-header', children: [
        createKicker(config.kicker),
        createHeading(config.title),
        createBody(config.body)
    ].filter(Boolean) });

    const stage = el('div', { className: 'globe-stage' });
    // Canvas slot — the renderer mounts here when ported. For v1, we render
    // a styled placeholder so the slide is not empty.
    const canvasSlot = el('div', { className: 'globe-canvas', dataset: { globe: 'pending' } });
    stage.appendChild(canvasSlot);

    // Markers list — visible proof of real locations even without canvas
    const markers = Array.isArray(config.markers) ? config.markers : [];
    if (markers.length > 0) {
        const list = el('ul', { className: 'globe-markers' });
        for (const marker of markers) {
            const li = el('li', { className: 'globe-marker' });
            if (marker.label) li.appendChild(el('span', { className: 'globe-marker-label', text: String(marker.label) }));
            if (marker.value) li.appendChild(el('span', { className: 'globe-marker-value', text: String(marker.value) }));
            list.appendChild(li);
        }
        stage.appendChild(list);
    }

    // Stats grid alongside
    const stats = Array.isArray(config.stats) ? config.stats : [];
    const statsEl = stats.length > 0
        ? el('div', { className: 'globe-stats', children: stats.map((s) => el('div', {
            className: 'globe-stat',
            children: [
                s.value ? el('p', { className: 'globe-stat-value', text: String(s.value) }) : null,
                s.label ? el('p', { className: 'globe-stat-label', text: String(s.label) }) : null
            ].filter(Boolean)
        })) })
        : null;

    const children = [header, stage];
    if (statsEl) children.push(statsEl);
    slide.appendChild(container(children));
    return slide;
}
