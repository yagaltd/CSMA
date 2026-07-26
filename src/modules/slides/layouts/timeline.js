import { spec, specShell, specKicker, specHeading, specContainer } from './_shared.js';

/**
 * timeline — vertical roadmap with past → now → future entries.
 *
 * Config: `{ kicker?, title?, items: [{time, title, body}], center=false }`
 *
 * Emits a SPEC TREE (Phase 2.1). Byte-identical DOM to the prior el() version.
 */
export function createTimelineSlide(config = {}) {
    const header = spec('div', { className: 'timeline-header', children: [
        specKicker(config.kicker),
        specHeading(config.title)
    ] });

    const items = Array.isArray(config.items) ? config.items : [];
    const rail = spec('div', {
        className: 'timeline-rail',
        children: items.map((item) => buildTimelineItem(item))
    });

    return specShell('timeline', { center: false }, [specContainer([header, rail])]);
}

function buildTimelineItem(item = {}) {
    return spec('div', { className: 'timeline-item', children: [
        item.time ? spec('p', { className: 'timeline-time', text: String(item.time) }) : null,
        item.title ? spec('h3', { className: 'timeline-title', text: String(item.title) }) : null,
        item.body ? spec('p', { className: 'timeline-body', text: String(item.body) }) : null
    ] });
}
