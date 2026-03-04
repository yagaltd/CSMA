import { EventBus } from '../../../runtime/EventBus.js';
import { Contracts } from '../../../runtime/Contracts.js';
import { createSearchService } from '../../../modules/search/index.js';
import { LogAccumulator } from '../../../runtime/LogAccumulator.js';

const csma = window.csma || (window.csma = {});
const eventBus = ensureEventBus();
const searchService = ensureSearchService();
const analyticsConsent = ensureAnalyticsConsent();
const logAccumulator = ensureLogAccumulator();

// Track page load
logAccumulator.trackPageView('Search Demo');

const container = document.querySelector('.search-demo');
const loadButton = document.querySelector('[data-load-sample]');
const clearButton = document.querySelector('[data-clear-search]');
const randomButton = document.querySelector('[data-random-search]');
const statusEl = document.querySelector('[data-index-status]');
const progressFill = document.querySelector('[data-progress]');
const indexTimeEl = document.querySelector('[data-index-time]');
const searchInput = document.querySelector('[data-search-input]');
const resultsList = document.querySelector('[data-results-list]');
const resultsCount = document.querySelector('[data-results-count]');
const searchTime = document.querySelector('[data-search-time]');
const filterBar = document.querySelector('[data-filter-tags]');

const docs = new Map();
const dataset = [];
let datasetLoaded = false;
let activeCategory = null;
let lastQuery = '';

const randomQueries = ['search', 'CSMA', 'analytics', 'offline', 'FlexSearch'];

loadButton?.addEventListener('click', loadSampleData);
clearButton?.addEventListener('click', () => {
    searchInput.value = '';
    lastQuery = '';
    renderResults([]);
    container.dataset.state = datasetLoaded ? 'ready' : 'idle';
    searchTime.textContent = '0ms';
});
randomButton?.addEventListener('click', () => {
    if (!datasetLoaded) return;
    const pool = dataset.map((doc) => doc.title.split(' ')[0]).filter(Boolean);
    const words = pool.length ? pool : randomQueries;
    const query = words[Math.floor(Math.random() * words.length)];
    searchInput.value = query;
    triggerSearch(query);
});

if (filterBar) {
    filterBar.querySelectorAll('button').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const value = btn.dataset.category;
            activeCategory = activeCategory === value ? null : value;
            filterBar.querySelectorAll('button').forEach((chip) => {
                chip.dataset.active = chip.dataset.category === activeCategory ? 'true' : 'false';
            });
            if (lastQuery) {
                triggerSearch(lastQuery, { skipInput: true });
            } else {
                renderResults([]);
            }
        });
    });
}

searchInput?.addEventListener('input', debounce((event) => {
    triggerSearch(event.target.value);
}, 250));

eventBus.subscribe?.('SEARCH_RESULTS_RETURNED', ({ results, durationMs }) => {
    if (!Array.isArray(results?.ids)) return;
    lastQuery && renderResults(results.ids, durationMs);
});

eventBus.subscribe?.('SEARCH_FACETS_UPDATED', ({ facets }) => {
    if (!facets || !filterBar) return;
    filterBar.querySelectorAll('button').forEach((btn) => {
        const key = btn.dataset.category;
        const count = facets[key]?.[key] || facets[key]?.total || sumFacetCounts(facets[key]);
        if (typeof count === 'number') {
            btn.textContent = `${capitalize(key)} (${count})`;
        }
    });
});

eventBus.subscribe?.('SEARCH_ERROR', ({ message }) => {
    setStatus(message || 'Search error');
    container.dataset.state = 'ready';
    logAccumulator.track('Search Error', { message });
});

init();

async function loadSampleData() {
    if (datasetLoaded) return;
    try {
        container.dataset.state = 'loading';
        setStatus('Downloading dataset...');
        // Track download start
        const downloadStart = now();
        const response = await fetch('./data/blog-posts.csv');
        const text = await response.text();
        const records = parseCSV(text);

        // Track download completion
        logAccumulator.track('Dataset Downloaded', {
            recordCount: records.length,
            durationMs: now() - downloadStart
        });

        setStatus('Indexing articles...');
        const indexingStart = now();

        // Batch process records
        const BATCH_SIZE = 500;
        const normalizedDocs = records.map(normalizeDoc);

        for (let i = 0; i < normalizedDocs.length; i += BATCH_SIZE) {
            const batch = normalizedDocs.slice(i, i + BATCH_SIZE);

            // Add to local arrays
            batch.forEach(doc => {
                dataset.push(doc);
                docs.set(doc.id, doc);
            });

            // Index batch
            if (searchService?.addDocuments) {
                await searchService.addDocuments(batch);
            } else {
                // Fallback for older service versions
                await Promise.all(batch.map(doc => indexDocument(doc)));
            }

            // Update UI
            const processed = Math.min(i + BATCH_SIZE, normalizedDocs.length);
            const pct = Math.round((processed / normalizedDocs.length) * 100);
            if (progressFill) {
                progressFill.style.width = `${pct}%`;
            }
            setStatus(`Indexed ${processed} / ${normalizedDocs.length} articles`);

            // Allow UI to breathe
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const indexingDuration = now() - indexingStart;
        datasetLoaded = true;
        container.dataset.state = 'ready';
        enableControls(records.length, indexingDuration);
        loadButton.disabled = true;
        setStatus(`Dataset ready — ${records.length} records indexed in ${formatDuration(indexingDuration)}.`);

        logAccumulator.track('Dataset Loaded', {
            recordCount: records.length,
            durationMs: indexingDuration
        });

    } catch (error) {
        console.error('[Search Demo]', error);
        setStatus('Failed to load dataset. Check console for details.');
        container.dataset.state = 'idle';
        logAccumulator.track('Dataset Load Failed', { error: error.message });
    }
}

async function indexDocument(doc) {
    if (searchService?.addDocument) {
        await searchService.addDocument(doc);
        return;
    }
}

function triggerSearch(rawQuery, options = {}) {
    if (!datasetLoaded) return;
    const query = (rawQuery || '').trim();
    lastQuery = query;
    clearButton.disabled = query.length === 0;
    if (!query) {
        container.dataset.state = 'ready';
        renderResults([]);
        return;
    }
    if (!options.skipInput) {
        container.dataset.state = 'loading';
    }

    if (searchService?.handleQuery) {
        searchService.handleQuery({
            version: 1,
            query,
            tier: 'enhanced',
            options: {
                limit: 30,
                bool: 'or',
                threshold: 0.5,
                facets: ['category', 'tags'],
                suggestions: { enabled: true }
            },
            timestamp: Date.now()
        });
        return;
    }

    if (eventBus.publish) {
        eventBus.publish('SEARCH_QUERY_INITIATED', {
            version: 1,
            query,
            tier: 'enhanced',
            timestamp: Date.now()
        });
        return;
    }

    const matches = fallbackFilter(query);
    renderResults(matches, 0);
}

function renderResults(ids, duration = 0) {
    const filteredIds = applyCategoryFilter(ids);
    const items = filteredIds.map((id) => docs.get(id)).filter(Boolean);
    resultsList.innerHTML = '';

    if (!items.length) {
        container.dataset.state = lastQuery ? 'empty' : datasetLoaded ? 'ready' : 'idle';
        if (resultsCount) {
            resultsCount.textContent = '0 results';
        }
        return;
    }

    container.dataset.state = 'results';
    if (resultsCount) {
        resultsCount.textContent = `${items.length} result${items.length === 1 ? '' : 's'}`;
    }
    if (searchTime) {
        const safeDuration = Number.isFinite(duration) ? duration : 0;
        searchTime.textContent = `${safeDuration.toFixed(2)}ms`;
    }

    // Track anonymized telemetry
    logAccumulator.track('Search Performed', {
        query: lastQuery,
        resultCount: items.length,
        durationMs: duration
    });

    items.forEach((doc) => {
        const card = document.createElement('article');
        card.className = 'search-result-card';
        card.innerHTML = `
            <h3>${highlightText(doc.title, lastQuery)}</h3>
            <p class="search-result-snippet">${highlightText(doc.content.substring(0, 140), lastQuery)}...</p>
            <div class="search-result-meta">
                <span class="search-chip">${doc.category}</span>
                <span class="search-chip">${doc.author}</span>
                <span class="search-chip">${doc.date}</span>
            </div>
        `;
        resultsList.appendChild(card);
    });
}

function applyCategoryFilter(ids) {
    if (!activeCategory) {
        return ids;
    }
    return ids.filter((id) => {
        const doc = docs.get(id);
        return doc?.category?.toLowerCase() === activeCategory;
    });
}

function fallbackFilter(query) {
    const q = query.toLowerCase();
    return dataset
        .filter((doc) =>
            doc.title.toLowerCase().includes(q) ||
            doc.content.toLowerCase().includes(q) ||
            doc.tags.some((tag) => tag.includes(q))
        )
        .map((doc) => doc.id);
}

function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = parseLine(lines.shift());
    return lines.map((line) => {
        const values = parseLine(line);
        return headers.reduce((acc, header, idx) => {
            acc[header.trim()] = (values[idx] || '').trim();
            return acc;
        }, {});
    });
}

function parseLine(line) {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            cells.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    cells.push(current);
    return cells;
}

function normalizeDoc(raw) {
    return {
        id: raw.id || crypto.randomUUID(),
        title: raw.title,
        content: raw.content,
        tags: (raw.tags || '')
            .split(/[,;]+/)
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean),
        category: (raw.category || 'tutorial').toLowerCase(),
        author: raw.author || 'CSMA Team',
        date: raw.date || '2024-01-01'
    };
}

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        window.clearTimeout(timeout);
        timeout = window.setTimeout(() => fn(...args), delay);
    };
}

function setStatus(text) {
    if (!statusEl) return;
    statusEl.textContent = text;
}

function now() {
    if (typeof performance !== 'undefined' && performance.now) {
        return performance.now();
    }
    return Date.now();
}

function formatDuration(ms) {
    return `${ms.toFixed(2)} ms`;
}

function highlightText(text, query) {
    if (!text || !query) return escapeHTML(text || '');
    const tokens = query
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map(escapeRegex);
    if (!tokens.length) return escapeHTML(text);
    const pattern = new RegExp(`(${tokens.join('|')})`, 'gi');
    return escapeHTML(text).replace(pattern, '<mark>$1</mark>');
}

function escapeHTML(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function enableControls(count = 0, duration = 0) {
    searchInput.disabled = false;
    randomButton.disabled = false;
    clearButton.disabled = true;
    filterBar?.querySelectorAll('button').forEach((btn) => {
        btn.disabled = false;
    });
    if (resultsCount && count > 0) {
        resultsCount.textContent = `${count} records loaded`;
    }
    if (indexTimeEl && duration > 0) {
        indexTimeEl.textContent = `Index built in ${formatDuration(duration)}`;
    }
}

function sumFacetCounts(facet) {
    if (!facet) return 0;
    return Object.values(facet).reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function ensureEventBus() {
    if (csma.eventBus) {
        if (!csma.eventBus.contracts) {
            csma.eventBus.contracts = Contracts;
        }
        return csma.eventBus;
    }
    const bus = new EventBus();
    bus.contracts = Contracts;
    csma.eventBus = bus;
    return bus;
}

function ensureSearchService() {
    if (csma.search) {
        return csma.search;
    }
    const service = createSearchService(eventBus, {
        tier: 'enhanced',
        facets: ['category', 'tags'],
        suggestions: { enabled: true }
    });
    service.init({ facets: ['category', 'tags'] });
    csma.search = service;
    return service;
}

function ensureAnalyticsConsent() {
    if (csma.analyticsConsent) {
        return csma.analyticsConsent;
    }
    return null;
}

function ensureLogAccumulator() {
    if (csma.logAccumulator) {
        return csma.logAccumulator;
    }
    const acc = new LogAccumulator(eventBus);
    acc.init({
        endpoint: 'http://localhost:5050/logs/batch',
        source: 'csma-search-demo',
        appVersion: 'dev',
        authProvider: () => localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
    });
    csma.logAccumulator = acc;
    return acc;
}

function init() {
    setStatus('Load the dataset to begin.');
}
