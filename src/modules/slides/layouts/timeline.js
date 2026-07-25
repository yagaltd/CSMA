import { el, createSlideShell, createKicker, createHeading, container } from './_shared.js';

/**
 * timeline — vertical roadmap with past → now → future entries.
 *
 * Config: `{ kicker?, title?, items: [{time, title, body}], center=false }`
 */
export function createTimelineSlide(config = {}) {
    const slide = createSlideShell('timeline', { center: false });

    const header = el('div', { className: 'timeline-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const rail = el('div', { className: 'timeline-rail' });
    const items = Array.isArray(config.items) ? config.items : [];
    items.forEach((item) => {
        rail.appendChild(buildTimelineItem(item));
    });

    slide.appendChild(container([header, rail]));
    return slide;
}

function buildTimelineItem(item = {}) {
    const entry = el('div', { className: 'timeline-item' });
    const children = [
        item.time ? el('p', { className: 'timeline-time', text: String(item.time) }) : null,
        item.title ? el('h3', { className: 'timeline-title', text: String(item.title) }) : null,
        item.body ? el('p', { className: 'timeline-body', text: String(item.body) }) : null
    ];
    for (const child of children.filter(Boolean)) entry.appendChild(child);
    return entry;
}
