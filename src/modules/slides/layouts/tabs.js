import { spec, specShell, specKicker, specHeading, specContainer } from './_shared.js';

/**
 * tabs — 3–5 parallel perspectives on one topic. Sliding pill indicator
 * handled by CSS (data-active attr on the tab bar). Active tab toggled by
 * service.setActiveTab or directly via data-active on click (we wire it up in
 * deck.js if a tabs slide is present).
 *
 * Config: `{ kicker?, title?, tabs: [{label, body?, chart?}] }`
 *
 * Emits a SPEC TREE (Phase 2.0). deck.js mounts it via the aiui composer's
 * `mountTree()`. aria-selected / role attrs pass validation (aria-* prefix
 * allowed since the foundation update).
 */
export function createTabsSlide(config = {}) {
    const headerChildren = [
        specKicker(config.kicker),
        specHeading(config.title)
    ].filter(Boolean);

    const barChildren = [];
    const panelChildren = [];
    const tabs = Array.isArray(config.tabs) ? config.tabs : [];
    tabs.forEach((tab, i) => {
        const isActive = i === 0;
        const btnDataset = { tab: String(i) };
        if (isActive) btnDataset.active = 'true';

        barChildren.push(spec('button', {
            className: 'tab-button',
            text: String(tab.label || ''),
            attrs: { role: 'tab', 'aria-selected': isActive ? 'true' : 'false' },
            dataset: btnDataset
        }));

        const panelChildrenInner = [];
        if (tab.body) panelChildrenInner.push(spec('p', { className: 'tab-body', text: String(tab.body) }));
        if (tab.chart) panelChildrenInner.push(spec('div', { className: 'tab-chart', dataset: { chartType: tab.chart.type || 'bar' } }));

        const panelDataset = { tab: String(i) };
        if (!isActive) panelDataset.hidden = 'true';

        panelChildren.push(spec('div', {
            className: 'tab-panel',
            attrs: { role: 'tabpanel' },
            dataset: panelDataset,
            children: panelChildrenInner
        }));
    });

    return specShell('tabs', { center: true }, [specContainer([
        spec('div', { className: 'tabs-header', children: headerChildren }),
        spec('div', { className: 'tabs-bar', attrs: { role: 'tablist' }, children: barChildren }),
        spec('div', { className: 'tabs-panels', children: panelChildren })
    ])]);
}
