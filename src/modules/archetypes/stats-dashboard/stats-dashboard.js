/**
 * Stats Dashboard Archetype — CSMA Token-Driven Metric Cards
 *
 * Factory: createStatsDashboard(container, emit, options) → { update, destroy, refresh }
 *
 * Features:
 * - Responsive auto-grid of stat cards
 * - Declarative metric definitions (label, fetch, format)
 * - Optional trend indicators (up/down/neutral)
 * - Optional charts section with explicit renderer hook or text summary fallback
 * - Loading / empty / error states
 * - Skeleton loading animation per card
 * - CSMA design tokens for all visual values
 */

const TREND_ICONS = {
    up:   '<svg viewBox="0 0 12 12" fill="none"><path d="M6 2L10 7H2L6 2Z" fill="currentColor"/></svg>',
    down: '<svg viewBox="0 0 12 12" fill="none"><path d="M6 10L2 5H10L6 10Z" fill="currentColor"/></svg>',
    neutral: '<svg viewBox="0 0 12 12" fill="none"><rect x="2" y="5" width="8" height="2" rx="1" fill="currentColor"/></svg>',
};

const FORMATTERS = {
    number: (v) => Number(v).toLocaleString(),
    bytes: (v) => {
        const n = Number(v);
        if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB';
        if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB';
        return n + ' B';
    },
    percent: (v) => Number(v).toFixed(1) + '%',
    duration: (v) => {
        const s = Math.round(Number(v));
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    },
    currency: (v) => '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 }),
};

export function createStatsDashboard(container, emit, options = {}) {
    const {
        cards = [],
        charts = [],
        cols = { sm: 2, md: 3, lg: 4 },
        emptyMessage = 'No metrics to display',
        loadingMessage = 'Loading metrics…',
        errorMessage = 'Failed to load metrics',
    } = options;

    let isLoading = cards.some(c => c.fetch);
    let error = null;
    let cardData = {};

    // ─── DOM ───────────────────────────────────────────

    const root = document.createElement('div');
    root.className = 'csma-stats';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Stats dashboard');
    if (isLoading) root.dataset.state = 'loading';

    // Card grid
    const grid = document.createElement('div');
    grid.className = 'csma-stats__grid';

    // Charts section
    const chartsEl = document.createElement('div');
    chartsEl.className = 'csma-stats__charts';

    // State overlays
    const stateEls = {};
    ['loading', 'empty', 'error'].forEach((state) => {
        const el = document.createElement('div');
        el.className = 'csma-stats__state';
        el.dataset.state = state;
        el.setAttribute('role', 'status');

        if (state === 'loading') {
            const spinner = document.createElement('div');
            spinner.className = 'csma-stats__spinner';
            el.appendChild(spinner);
        }

        const msg = document.createElement('span');
        msg.className = 'csma-stats__state-message';
        msg.textContent = state === 'loading' ? loadingMessage :
                          state === 'empty' ? emptyMessage : errorMessage;
        el.appendChild(msg);

        if (state === 'error') {
            const retry = document.createElement('button');
            retry.className = 'csma-stats__state-retry';
            retry.textContent = 'Retry';
            retry.addEventListener('click', () => loadAll());
            el.appendChild(retry);
        }

        stateEls[state] = el;
    });

    root.appendChild(grid);
    root.appendChild(chartsEl);
    Object.values(stateEls).forEach(el => root.appendChild(el));

    // ─── Render ────────────────────────────────────────

    function buildCard(cardDef, data) {
        const card = document.createElement('div');
        card.className = 'csma-stats__card';
        card.dataset.cardId = cardDef.id;

        const label = document.createElement('div');
        label.className = 'csma-stats__card-label';
        label.textContent = cardDef.label;
        card.appendChild(label);

        if (data == null && isLoading) {
            const skelVal = document.createElement('div');
            skelVal.className = 'csma-stats__skeleton';
            skelVal.style.width = '60%';
            card.appendChild(skelVal);
        } else {
            const value = document.createElement('div');
            value.className = 'csma-stats__card-value';
            const fmt = FORMATTERS[cardDef.format] || FORMATTERS.number;
            value.textContent = fmt(data != null ? (data.value != null ? data.value : data) : 0);
            card.appendChild(value);

            if (data && data.trend != null) {
                const trend = document.createElement('div');
                trend.className = 'csma-stats__card-trend';
                const dir = data.trend > 0 ? 'up' : data.trend < 0 ? 'down' : 'neutral';
                trend.dataset.direction = dir;
                trend.innerHTML = `${TREND_ICONS[dir]} ${Math.abs(data.trend)}%`;
                card.appendChild(trend);
            }
        }

        return card;
    }

    function buildChart(chartDef) {
        const chart = document.createElement('div');
        chart.className = 'csma-stats__chart';
        chart.dataset.chartId = chartDef.id;

        const label = document.createElement('div');
        label.className = 'csma-stats__chart-label';
        label.textContent = chartDef.label;
        chart.appendChild(label);

        // Extension point: if a renderChart callback is provided, use it.
        // If absent, render an accessible summary instead of a blank canvas.
        if (typeof options.renderChart === 'function') {
            const rendered = options.renderChart(chartDef, { emit, container: chart });
            if (rendered instanceof Node) {
                chart.appendChild(rendered);
            }
        } else {
            const summary = document.createElement('p');
            summary.className = 'csma-stats__chart-summary';
            summary.textContent = chartDef.description || `Chart: ${chartDef.label}`;
            chart.appendChild(summary);
        }

        return chart;
    }

    let chartsBuilt = false;

    function renderCards() {
        grid.innerHTML = '';
        cards.forEach((cardDef) => {
            const data = cardData[cardDef.id];
            grid.appendChild(buildCard(cardDef, data));
        });
    }

    function renderChartsDOM() {
        if (chartsBuilt) return;
        chartsEl.innerHTML = '';
        charts.forEach((chartDef) => {
            chartsEl.appendChild(buildChart(chartDef));
        });
        if (charts.length === 0) {
            chartsEl.setAttribute('hidden', '');
        } else {
            chartsEl.removeAttribute('hidden');
        }
        chartsBuilt = true;
    }

    function renderAll() {
        renderCards();
        renderChartsDOM();
    }

    function setState(state) {
        delete root.dataset.state;
        if (state) root.dataset.state = state;
    }

    // ─── Data Loading ──────────────────────────────────

    async function loadAll() {
        if (!cards.some(c => c.fetch)) {
            setState(cards.length === 0 ? 'empty' : null);
            renderAll();
            return;
        }

        setState('loading');
        isLoading = true;
        error = null;

        try {
            const results = await Promise.allSettled(
                cards.map(async (cardDef) => {
                    if (!cardDef.fetch) return { id: cardDef.id, value: 0 };
                    const data = await cardDef.fetch();
                    return { id: cardDef.id, ...(typeof data === 'object' && data !== null ? data : { value: data }) };
                })
            );

            results.forEach((r) => {
                if (r.status === 'fulfilled') {
                    cardData[r.value.id] = r.value;
                } else {
                    cardData[r.value?.id || 'unknown'] = { value: 0, _error: r.reason?.message };
                }
            });

            isLoading = false;
            setState(null);
            renderAll();
        } catch (err) {
            error = err;
            isLoading = false;
            setState('error');
            if (emit) emit('stats:error', { error: err.message || String(err) });
        }
    }

    // ─── Initial Render ────────────────────────────────

    container.appendChild(root);
    renderAll();

    if (cards.some(c => c.fetch)) {
        loadAll();
    } else if (cards.length === 0) {
        setState('empty');
    }

    // ─── Public API ────────────────────────────────────

    return {
        /** Refresh all card data (re-fetches). */
        refresh() {
            loadAll();
        },

        /** Update dashboard runtime data for existing card definitions. */
        update(data = {}) {
            cardData = data;
            renderAll();
        },

        /** Get current card data. */
        getData() {
            return cardData;
        },

        /** Destroy the dashboard. */
        destroy() {
            root.remove();
        },
    };
}
