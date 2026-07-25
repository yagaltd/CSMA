import { el, createSlideShell, createKicker, createHeading, container } from './_shared.js';

/**
 * tabs — 3–5 parallel perspectives on one topic. Sliding pill indicator
 * handled by CSS (data-active attr on the tab bar). Active tab toggled by
 * service.setActiveTab or directly via data-active on click (we wire it up in
 * deck.js if a tabs slide is present).
 *
 * Config: `{ kicker?, title?, tabs: [{label, body?, chart?}] }`
 */
export function createTabsSlide(config = {}) {
    const slide = createSlideShell('tabs', { center: true });

    const header = el('div', { className: 'tabs-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const bar = el('div', { className: 'tabs-bar', attrs: { role: 'tablist' } });
    const panels = el('div', { className: 'tabs-panels' });
    const tabs = Array.isArray(config.tabs) ? config.tabs : [];
    tabs.forEach((tab, i) => {
        const btn = el('button', {
            className: 'tab-button',
            text: String(tab.label || ''),
            attrs: { role: 'tab', 'aria-selected': i === 0 ? 'true' : 'false' },
            dataset: { tab: String(i) }
        });
        if (i === 0) btn.dataset.active = 'true';
        bar.appendChild(btn);

        const panel = el('div', {
            className: 'tab-panel',
            attrs: { role: 'tabpanel' },
            dataset: { tab: String(i) }
        });
        if (i !== 0) panel.dataset.hidden = 'true';
        if (tab.body) panel.appendChild(el('p', { className: 'tab-body', text: String(tab.body) }));
        if (tab.chart) panel.appendChild(el('div', { className: 'tab-chart', dataset: { chartType: tab.chart.type || 'bar' } }));
        panels.appendChild(panel);
    });

    slide.appendChild(container([header, bar, panels]));
    return slide;
}
