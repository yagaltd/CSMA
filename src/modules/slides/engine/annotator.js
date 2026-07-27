/**
 * annotator.js — SVG freehand drawing overlay.
 *
 * Mounted inside the slide-stage when `drawing=true` (UI_STATE_CHANGED).
 * Listens to pointer events on the SVG, publishes INTENT_ANNOTATION_STROKE
 * intents with point arrays. Reads ANNOTATION_UPDATED to render persisted
 * strokes.
 *
 * Type II: subscribes to events, publishes intents. No direct service mutation.
 * Pure SVG construction — no inline styles for stroke colors (uses data-color
 * attribute + CSS rule). Returns a cleanup function.
 */

const DEFAULT_COLOR = 'currentColor';
const DEFAULT_WIDTH = 3;

/**
 * Mount the annotator overlay on a container.
 *
 * @param {HTMLElement} container — the slide-stage element
 * @param {object} eventBus
 * @param {object} service — SlideDeckService (for current slide index)
 * @returns {() => void} cleanup function
 */
export function initAnnotator(container, eventBus, service) {
    if (!container || !eventBus) return () => {};
    const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return () => {};

    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'slide-annotator');
    svg.setAttribute('data-active', 'false');
    svg.setAttribute('aria-hidden', 'true');
    container.appendChild(svg);

    let currentStroke = null;
    let currentPath = null;
    const subs = [];

    // Render persisted strokes when ANNOTATION_UPDATED fires.
    // Hidden strokes stay in the DOM (with display:none) so element anchors
    // remain findable for comment popovers and pin highlights.
    const renderAll = (strokes) => {
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        for (const stroke of (strokes || [])) {
            const path = buildPath(stroke);
            if (stroke.hidden) path.style.display = 'none';
            // Reflect selection state
            if (stroke.id === selectedStrokeId) {
                path.dataset.selected = 'true';
            }
            // Click to select a stroke when not in drawing mode
            path.addEventListener('click', (e) => {
                if (svg.dataset.active === 'true') return;
                e.stopPropagation();
                selectStroke(stroke.id);
            });
            svg.appendChild(path);
        }
    };

    // ── Stroke selection ────────────────────────────────────────────

    let selectedStrokeId = null;

    // Safe CSS ID selector (avoids crash if CSS.escape is unavailable)
    const cssId = (id) => {
        try { return '#' + CSS.escape(id); } catch { return '#' + id.replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
    };

    function selectStroke(strokeId) {
        if (selectedStrokeId === strokeId) return;
        if (selectedStrokeId) {
            const prev = svg.querySelector(cssId(selectedStrokeId));
            if (prev) prev.dataset.selected = 'false';
        }
        selectedStrokeId = strokeId;
        const path = svg.querySelector(cssId(strokeId));
        if (path) path.dataset.selected = 'true';
    }

    function deselectAll() {
        if (!selectedStrokeId) return;
        const path = svg.querySelector(cssId(selectedStrokeId));
        if (path) path.dataset.selected = 'false';
        selectedStrokeId = null;
    }

    // Deselect when clicking anywhere outside a stroke path
    const onDocClick = (e) => {
        if (!selectedStrokeId) return;
        if (svg.dataset.active === 'true') return;
        const clickedPath = e.target.closest('.slide-annotation');
        if (!clickedPath || !svg.contains(clickedPath)) {
            deselectAll();
        }
    };
    doc.addEventListener('click', onDocClick);

    // Delete key removes the selected stroke
    const onDocKeyDown = (e) => {
        if (!selectedStrokeId) return;
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const tag = doc.activeElement?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (doc.activeElement?.isContentEditable) return;
            e.preventDefault();
            const id = selectedStrokeId;
            deselectAll();
            if (service && typeof service.removeStrokeById === 'function') {
                service.removeStrokeById(id);
            }
            // Signal so the comment linked to this stroke can be cleaned up
            if (typeof eventBus.publishSync === 'function') {
                eventBus.publishSync('INTENT_ANNOTATION_STROKE_DELETE', { strokeId: id, timestamp: Date.now() });
            } else {
                eventBus.publish('INTENT_ANNOTATION_STROKE_DELETE', { strokeId: id, timestamp: Date.now() });
            }
        }
        if (e.key === 'Escape') {
            deselectAll();
        }
    };
    doc.addEventListener('keydown', onDocKeyDown);

    subs.push(eventBus.subscribe('ANNOTATION_UPDATED', (payload) => {
        const idx = service?.index;
        if (Number.isFinite(idx) && payload?.slide !== idx) return;
        renderAll(payload?.strokes);
    }));

    // Re-render the NEW slide's strokes on navigation. Without this, strokes
    // drawn on slide A stay visible after navigating to slide B (the service
    // only emits ANNOTATION_UPDATED on add/clear, not on slide change).
    subs.push(eventBus.subscribe('SLIDE_CHANGED', (payload) => {
        const idx = Number.isFinite(payload?.slide) ? payload.slide : service?.index;
        if (service && typeof service.getAnnotations === 'function' && Number.isFinite(idx)) {
            renderAll(service.getAnnotations(idx));
        }
    }));

    // Reflect drawing state from UI_STATE_CHANGED.
    subs.push(eventBus.subscribe('UI_STATE_CHANGED', (payload) => {
        svg.dataset.active = payload?.drawing ? 'true' : 'false';
    }));

    // Pointer capture → live stroke preview → commit on pointerup.
    const onPointerDown = (e) => {
        if (svg.dataset.active !== 'true') return;
        e.preventDefault();
        const pt = toLocalPoint(svg, e);
        currentStroke = {
            points: [pt],
            color: DEFAULT_COLOR,
            width: DEFAULT_WIDTH
        };
        currentPath = buildPath(currentStroke);
        svg.appendChild(currentPath);
        try { svg.setPointerCapture(e.pointerId); } catch { /* noop */ }
    };

    const onPointerMove = (e) => {
        if (!currentStroke || !currentPath) return;
        e.preventDefault();
        const pt = toLocalPoint(svg, e);
        currentStroke.points.push(pt);
        currentPath.setAttribute('d', toPathData(currentStroke.points));
    };

    const onPointerUp = (e) => {
        if (!currentStroke) return;
        e.preventDefault();
        const committed = currentStroke;
        currentStroke = null;
        currentPath = null;
        try { svg.releasePointerCapture(e.pointerId); } catch { /* noop */ }
        if (committed.points.length > 1 && service && Number.isFinite(service.index)) {
            eventBus.publish('INTENT_ANNOTATION_STROKE', {
                slide: service.index,
                points: committed.points,
                color: committed.color,
                width: committed.width
            });
        }
    };

    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerUp);

    // Initial render of current slide's persisted strokes.
    if (service && typeof service.getAnnotations === 'function') {
        renderAll(service.getAnnotations(service.index));
    }

    return () => {
        subs.forEach((unsub) => unsub && unsub());
        svg.removeEventListener('pointerdown', onPointerDown);
        svg.removeEventListener('pointermove', onPointerMove);
        svg.removeEventListener('pointerup', onPointerUp);
        svg.removeEventListener('pointercancel', onPointerUp);
        doc.removeEventListener('click', onDocClick);
        doc.removeEventListener('keydown', onDocKeyDown);
        if (svg.parentNode) svg.parentNode.removeChild(svg);
    };
}

function buildPath(stroke) {
    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc) return null;
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'slide-annotation');
    path.setAttribute('data-color', stroke.color || DEFAULT_COLOR);
    path.setAttribute('stroke-width', String(stroke.width || DEFAULT_WIDTH));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('d', toPathData(stroke.points || []));
    if (stroke.id) path.setAttribute('id', stroke.id);
    return path;
}

function toPathData(points) {
    if (!Array.isArray(points) || points.length === 0) return '';
    if (points.length === 1) {
        return 'M' + points[0].x + ',' + points[0].y + ' l0.1,0.1';
    }
    let d = 'M' + points[0].x + ',' + points[0].y;
    for (let i = 1; i < points.length; i++) {
        d += ' L' + points[i].x + ',' + points[i].y;
    }
    return d;
}

function toLocalPoint(svg, e) {
    const rect = svg.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}
