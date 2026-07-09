/**
 * Viewer Archetype — CSMA Token-Driven Content Viewer
 *
 * Factory: createViewer(container, emit, options) → { update, destroy }
 *
 * Features:
 * - Fetch-and-render pattern (fetch data, render into DOM)
 * - Loading / empty / error states via data-state attribute
 * - Optional Markdown rendering (auto-detected or forced)
 * - HTML sanitization via textContent (safe by default)
 * - CSMA design tokens for all visual values
 * - ARIA live region for state announcements
 *
 * States (via data-state on root):
 *   "loading"  — spinner with message
 *   "empty"    — "Nothing to display" message
 *   "error"    — error message with optional retry
 *   (absent)   — content displayed normally
 */

import { clearChildren, createIcon, createSvgElement } from '../../../utils/dom.js';

// ─── HTML Sanitizer ───────────────────────────────────

/**
 * Sanitize HTML by stripping dangerous elements and attributes.
 * Allows basic formatting tags with safe attributes only.
 */
const ALLOWED_TAGS = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre',
    'a', 'img',
    'ul', 'ol', 'li',
    'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'div', 'span',
]);

const ALLOWED_ATTRS = new Set([
    'href', 'src', 'alt', 'title', 'target', 'rel',
    'class', 'id',
    'loading', 'width', 'height',
    'colspan', 'rowspan',
]);

const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript):/i;

/**
 * Strip dangerous event handlers from an attribute name.
 */
function isSafeAttr(name) {
    const lower = name.toLowerCase().trim();
    // Reject event handlers
    if (lower.startsWith('on')) return false;
    return ALLOWED_ATTRS.has(lower);
}

/**
 * Sanitize a URL value, stripping dangerous protocols.
 */
function safeUrl(value) {
    if (!value) return '';
    const trimmed = value.trim();
    if (DANGEROUS_PROTOCOLS.test(trimmed)) return '';
    return trimmed;
}

/**
 * Strip dangerous content from an HTML string.
 * Uses a two-pass approach: regex for script/style removal,
 * then DOM parse for attribute stripping.
 */
function createSanitizedFragment(html) {
    const fragment = document.createDocumentFragment();
    if (!html || typeof html !== 'string') return fragment;

    const cleaned = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');

    try {
        const parsed = new DOMParser().parseFromString(cleaned, 'text/html');
        walkAndSanitize(parsed.body);
        while (parsed.body.firstChild) {
            fragment.appendChild(document.importNode(parsed.body.firstChild, true));
            parsed.body.firstChild.remove();
        }
    } catch (_) {
        fragment.appendChild(document.createTextNode(cleaned.replace(/<[^>]*>/g, '')));
    }

    return fragment;
}

/**
 * Walk parsed HTML once, unwrapping disallowed elements and sanitizing every
 * allowed element's attributes. `querySelectorAll('*')` snapshots descendants
 * before mutations, so children moved out of a removed wrapper are still
 * visited later in the same pass.
 */
function walkAndSanitize(root) {
    const elements = root.querySelectorAll ? [...root.querySelectorAll('*')] : [];

    for (const node of elements) {
        if (!node.parentNode) continue;

        const tag = node.tagName.toLowerCase();

        if (!ALLOWED_TAGS.has(tag)) {
            while (node.firstChild) {
                node.parentNode.insertBefore(node.firstChild, node);
            }
            node.parentNode.removeChild(node);
            continue;
        }

        sanitizeElementAttributes(node, tag);
    }
}

function createViewerEmptyIcon() {
    return createIcon('0 0 24 24', [
        createSvgElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        createSvgElement('polyline', { points: '14 2 14 8 20 8' })
    ], { stroke: 'currentColor', 'stroke-width': 1.5 });
}

function createViewerErrorIcon() {
    return createIcon('0 0 24 24', [
        createSvgElement('circle', { cx: 12, cy: 12, r: 10 }),
        createSvgElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }),
        createSvgElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 })
    ], { stroke: 'currentColor', 'stroke-width': 1.5 });
}

function sanitizeElementAttributes(node, tag) {
    const attrs = [...node.attributes];
    for (const attr of attrs) {
        if (!isSafeAttr(attr.name)) {
            node.removeAttribute(attr.name);
            continue;
        }

        if (attr.name === 'href' || attr.name === 'src') {
            const safe = safeUrl(attr.value);
            if (safe) {
                node.setAttribute(attr.name, safe);
            } else {
                node.removeAttribute(attr.name);
            }
        }
    }

    if (tag === 'a' && node.getAttribute('target') === '_blank') {
        const rel = node.getAttribute('rel') || '';
        if (!rel.includes('noopener')) {
            node.setAttribute('rel', (rel + ' noopener noreferrer').trim());
        }
    }
}

// Simple Markdown-to-HTML converter (safe subset)
function parseMarkdown(text) {
    if (!text) return '';

    let html = text;

    // Code blocks (must run before inline code)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code>${escapeHtml(code.trimEnd())}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headings
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');

    // Blockquotes
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

    // Horizontal rules
    html = html.replace(/^(---|\*\*\*)$/gm, '<hr>');

    // Unordered lists
    html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    // Fix ordered lists that were wrapped as unordered
    // Simple approach: if we see consecutive <li> not in <ul>, wrap in <ol>
    // For simplicity, we treat all remaining <li> blocks as <ul>

    // Paragraphs (lines not already wrapped in a block tag)
    html = html.replace(/^(?!<[hupbolc]|<\/?[hupbolc]|<li|<hr|<img|<pre|<blockquote)(.+)$/gm, '<p>$1</p>');

    // Clean up: remove empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
}

function escapeHtml(str) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return str.replace(/[&<>"']/g, (c) => map[c]);
}

export function createViewer(container, emit, options = {}) {
    const {
        fetch: fetchFn = null,
        render: customRender = null,
        markdown = 'auto',     // 'auto' | true | false
        sanitize = true,
        loadingMessage = 'Loading…',
        emptyMessage = 'Nothing to display',
        errorMessage = 'Failed to load content',
    } = options;

    // ─── State ─────────────────────────────────────────

    let currentData = null;
    let isLoading = fetchFn !== null;
    let error = null;
    let currentFetchId = 0;
    let retryFn = null;

    // ─── DOM Construction ──────────────────────────────

    const root = document.createElement('div');
    root.className = 'csma-viewer';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Content viewer');
    if (isLoading) root.dataset.state = 'loading';

    // Content area
    const contentEl = document.createElement('div');
    contentEl.className = 'csma-viewer__content';

    // State overlays
    const stateEls = {};
    ['loading', 'empty', 'error'].forEach((state) => {
        const el = document.createElement('div');
        el.className = 'csma-viewer__state';
        el.dataset.state = state;
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', state === 'error' ? 'assertive' : 'polite');
        stateEls[state] = el;
    });

    // Loading
    const spinner = document.createElement('div');
    spinner.className = 'csma-viewer__spinner';
    stateEls.loading.appendChild(spinner);
    const loadMsg = document.createElement('span');
    loadMsg.className = 'csma-viewer__state-message';
    loadMsg.textContent = loadingMessage;
    stateEls.loading.appendChild(loadMsg);

    // Empty
    const emptyIcon = document.createElement('div');
    emptyIcon.className = 'csma-viewer__state-icon';
    emptyIcon.appendChild(createViewerEmptyIcon());
    stateEls.empty.appendChild(emptyIcon);
    const emptyMsg = document.createElement('span');
    emptyMsg.className = 'csma-viewer__state-message';
    emptyMsg.textContent = emptyMessage;
    stateEls.empty.appendChild(emptyMsg);

    // Error
    const errorIcon = document.createElement('div');
    errorIcon.className = 'csma-viewer__state-icon';
    errorIcon.appendChild(createViewerErrorIcon());
    stateEls.error.appendChild(errorIcon);
    const errMsg = document.createElement('span');
    errMsg.className = 'csma-viewer__state-message';
    errMsg.textContent = errorMessage;
    stateEls.error.appendChild(errMsg);
    const errDetail = document.createElement('span');
    errDetail.className = 'csma-viewer__state-detail';
    stateEls.error.appendChild(errDetail);
    const retryBtn = document.createElement('button');
    retryBtn.className = 'csma-viewer__state-retry';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => {
        if (retryFn) retryFn();
    });
    stateEls.error.appendChild(retryBtn);

    root.appendChild(contentEl);
    Object.values(stateEls).forEach((el) => root.appendChild(el));

    // ─── Render ────────────────────────────────────────

    function renderContent(data) {
        if (customRender) {
            clearChildren(contentEl);
            customRender(data, contentEl);
            return;
        }

        let content = data;
        let forceText = false;

        // Extract body/content from common API shapes. `text` is explicitly
        // plain text, even if its value contains markup-looking characters.
        if (typeof data === 'object' && data !== null) {
            if (typeof data.body === 'string') content = data.body;
            else if (typeof data.content === 'string') content = data.content;
            else if (typeof data.html === 'string') content = data.html;
            else if (typeof data.text === 'string') { content = data.text; forceText = true; }
            else { content = JSON.stringify(data, null, 2); forceText = true; }
        }

        const shouldRenderMarkdown =
            !forceText && (
                markdown === true ||
                (markdown === 'auto' && typeof content === 'string' && looksLikeMarkdown(content))
            );

        if (shouldRenderMarkdown) {
            clearChildren(contentEl);
            contentEl.appendChild(createSanitizedFragment(parseMarkdown(String(content))));
        } else if (typeof content === 'string') {
            if (!forceText && sanitize && looksLikeHtml(content)) {
                clearChildren(contentEl);
                contentEl.appendChild(createSanitizedFragment(content));
            } else {
                contentEl.textContent = content;
            }
        } else {
            contentEl.textContent = String(content);
        }
    }

    function looksLikeMarkdown(text) {
        return /^#{1,4}\s|^\*\*|^[\*\-]\s|^```|^>\s|\[.+\]\(.+\)/m.test(text);
    }

    function looksLikeHtml(text) {
        return /<\/?[a-z][\s\S]*>/i.test(text) && /<[a-z]+[\s\S]*>/i.test(text);
    }

    function setState(state) {
        delete root.dataset.state;
        if (state) root.dataset.state = state;
    }

    // ─── Fetch ─────────────────────────────────────────

    async function doFetch(id) {
        if (!fetchFn) return;

        const fetchId = ++currentFetchId;
        setState('loading');
        isLoading = true;
        error = null;

        try {
            const result = await fetchFn(id);
            if (fetchId !== currentFetchId) return; // stale

            currentData = result;
            if (result == null || (typeof result === 'string' && result.trim() === '')) {
                setState('empty');
            } else {
                setState(null);
                renderContent(result);
            }
            isLoading = false;
        } catch (err) {
            if (fetchId !== currentFetchId) return; // stale
            error = err;
            isLoading = false;
            setState('error');
            errDetail.textContent = err.message || String(err);
            if (emit) {
                emit('viewer:error', { error: err.message || String(err) });
            }
        }
    }

    function setRetry(fn) {
        retryFn = fn;
    }

    // ─── Initial Render ────────────────────────────────

    container.appendChild(root);

    if (fetchFn) {
        doFetch();
    } else {
        setState('empty');
    }

    // ─── Public API ────────────────────────────────────

    return {
        /** Update with new data. Pass an ID for fetch mode, or raw data for render mode. */
        update(dataOrId) {
            if (fetchFn) {
                doFetch(dataOrId);
            } else {
                currentData = dataOrId;
                error = null;
                if (dataOrId == null || (typeof dataOrId === 'string' && dataOrId.trim() === '')) {
                    setState('empty');
                } else {
                    setState(null);
                    renderContent(dataOrId);
                }
            }
        },

        /** Re-fetch with a custom retry function. */
        retry(fn) {
            setRetry(fn);
            if (fetchFn) {
                doFetch();
            } else if (fn) {
                try {
                    setState('loading');
                    const result = fn();
                    if (result && typeof result.then === 'function') {
                        result.then((data) => this.update(data))
                              .catch((err) => {
                                  error = err;
                                  setState('error');
                                  errDetail.textContent = err.message || String(err);
                              });
                    } else {
                        this.update(result);
                    }
                } catch (err) {
                    error = err;
                    setState('error');
                    errDetail.textContent = err.message || String(err);
                }
            }
        },

        /** Get the current data. */
        getData() {
            return currentData;
        },

        /** Set loading state manually. */
        setLoading(loading) {
            isLoading = loading;
            setState(loading ? 'loading' : currentData == null ? 'empty' : null);
        },

        /** Destroy the viewer, removing all DOM. */
        destroy() {
            currentFetchId = -1; // cancel pending fetches
            root.remove();
        },
    };
}
