import { spec, specKicker, specHeading, specBody, specContainer } from './_shared.js';

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
 *
 * Emits a SPEC TREE (Phase 2.1).
 */
export function createGlobeSlide(config = {}) {
    const header = spec('div', { className: 'globe-header', children: [
        specKicker(config.kicker),
        specHeading(config.title),
        specBody(config.body)
    ] });

    const canvasSlot = spec('div', { className: 'globe-canvas', dataset: { globe: 'pending' } });

    const markers = Array.isArray(config.markers) ? config.markers : [];
    const markerList = markers.length > 0
        ? spec('ul', {
            className: 'globe-markers',
            children: markers.map((marker) => spec('li', {
                className: 'globe-marker',
                children: [
                    marker.label ? spec('span', { className: 'globe-marker-label', text: String(marker.label) }) : null,
                    marker.value ? spec('span', { className: 'globe-marker-value', text: String(marker.value) }) : null
                ]
            }))
        })
        : null;

    const stageChildren = [canvasSlot];
    if (markerList) stageChildren.push(markerList);
    const stage = spec('div', { className: 'globe-stage', children: stageChildren });

    const stats = Array.isArray(config.stats) ? config.stats : [];
    const statsEl = stats.length > 0
        ? spec('div', {
            className: 'globe-stats',
            children: stats.map((s) => spec('div', {
                className: 'globe-stat',
                children: [
                    s.value ? spec('p', { className: 'globe-stat-value', text: String(s.value) }) : null,
                    s.label ? spec('p', { className: 'globe-stat-label', text: String(s.label) }) : null
                ]
            }))
        })
        : null;

    const innerChildren = [header, stage];
    if (statsEl) innerChildren.push(statsEl);
    const inner = specContainer(innerChildren);

    return spec('div', { className: 'slide', dataset: { layout: 'globe' }, children: [inner] });
}
