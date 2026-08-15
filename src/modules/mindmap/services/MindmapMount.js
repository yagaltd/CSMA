/**
 * MindmapMount - aiui surface mounting ('mindmap-canvas') for MindmapService.
 *
 * Extracted from MindmapService.js (Phase 6 modular decomposition, lane M1;
 * see docs/plans/active/audit-fix-plan.md 6.1). Mixed onto
 * MindmapService.prototype by MindmapService.js; methods run with `this`
 * bound to the service instance. Cut/paste move; no behavior changes.
 *
 * Extraction-forced adaptation: `MindmapService.SURFACE_CSS` becomes the
 * `SURFACE_CSS` import from MindmapSurfaceCSS.js (the class-name reference
 * is out of scope in this module; MindmapService keeps the static).
 */

import { NodeDragHandler } from './NodeDragHandler.js';
import { SelectionController } from './SelectionController.js';
import { ViewportController } from './ViewportController.js';
import { KeyboardHandler } from './KeyboardHandler.js';
import { BoxSelector } from './BoxSelector.js';
import { ClipboardManager } from './ClipboardManager.js';
import { FocusController } from './FocusController.js';
import { renderMindmapNodes } from '../ui/MindmapRenderer.js';
import { ContextMenu } from '../ui/ContextMenu.js';
import { SURFACE_CSS } from './MindmapSurfaceCSS.js';

export const MindmapMount = {
  // ─── aiui surface mounting ──────────────────────────────────────

  /**
   * Mount an aiui surface into a container element.
   *
   * Runtime contract for module aiui surfaces:
   *   mountSurface(surfaceId, container, props) → cleanupFn
   *
   * Supported surfaces:
   *   - 'mindmap-canvas' — renders the map identified by `props.mapId` (or the
   *     active map) as an absolutely-positioned node layer plus an SVG
   *     connector layer, mirroring demo/mindmap.html. `props.readOnly` stamps
   *     a `data-read-only` attribute and disables pointer interaction.
   *
   * Returns a cleanup function that empties the container and unsubscribes
   * from structure-change events.
   */
  mountSurface(surfaceId, container, props = {}) {
    if (surfaceId !== 'mindmap-canvas') {
      throw new Error(`MindmapService.mountSurface: unknown surface "${surfaceId}"`);
    }
    const doc = container.ownerDocument || globalThis.document;
    const service = this;
    let resolvedMapId = props.mapId || this._activeMapId;

    const canvas = doc.createElement('div');
    canvas.className = 'mm-canvas';
    canvas.setAttribute('data-surface', 'mindmap-canvas');
    if (props.readOnly === true || props.readOnly === 'true') {
      canvas.setAttribute('data-read-only', '');
    }
    const style = doc.createElement('style');
    style.textContent = SURFACE_CSS;
    const toolbar = doc.createElement('div');
    toolbar.className = 'mm-toolbar';
    const svgLayer = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgLayer.setAttribute('class', 'mm-surface-svg');
    svgLayer.setAttribute('overflow', 'visible');
    const nodeLayer = doc.createElement('div');
    nodeLayer.className = 'mm-surface-nodes';
    canvas.append(style, toolbar, svgLayer, nodeLayer);
    container.append(canvas);

    // ── Toolbar surface (Wave 2) ───────────────────────────────────
    // Direction cycle: right → side → down → left (matches setLayoutDirection).
    const layoutDirs = [1, 2, 3, 0];
    const dirLabel = { 0: 'Left', 1: 'Right', 2: 'Side', 3: 'Down' };
    const makeToolButton = (label) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'button';
      b.setAttribute('data-variant', 'ghost');
      b.setAttribute('data-size', 'sm');
      b.textContent = label;
      return b;
    };
    const zoomInBtn = makeToolButton('Zoom in');
    const zoomOutBtn = makeToolButton('Zoom out');
    const fitBtn = makeToolButton('Fit');
    const layoutBtn = makeToolButton('Layout');
    const fullBtn = makeToolButton('Fullscreen');
    toolbar.append(zoomInBtn, zoomOutBtn, fitBtn, layoutBtn, fullBtn);
    const focusBtn = makeToolButton('Focus');
    const exitFocusBtn = makeToolButton('Exit focus');
    toolbar.append(focusBtn, exitFocusBtn);
    // Focus pill (Wave 3) — visibility driven by FocusController.onChange.
    const pill = doc.createElement('div');
    pill.className = 'mm-focus-pill';
    pill.hidden = true;
    const pillCount = doc.createElement('span');
    pillCount.className = 'badge';
    const pillHint = doc.createElement('span');
    pillHint.className = 'mm-focus-pill__hint';
    pillHint.textContent = 'Alt+Click node · Shift+Click arrow to add · Esc exit';
    const copyMdBtn = makeToolButton('Copy');
    const copyJsonBtn = makeToolButton('Copy JSON');
    const exitPillBtn = makeToolButton('Exit');
    pill.append(pillCount, pillHint, copyMdBtn, copyJsonBtn, exitPillBtn);
    canvas.append(pill);
    const updatePill = (s) => {
      const active = !!s?.active;
      pill.hidden = !active;
      pillCount.textContent = active ? `${s.focusIds?.length || 0} focused` : '0';
    };
    // Pill button listeners attached after focus is created (see below).
    // Stop toolbar pointer/keyboard events from reaching the canvas handlers
    // (drag / pan / context-menu / keyboard) attached below.
    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'wheel', 'contextmenu', 'keydown', 'keyup', 'click']) {
      toolbar.addEventListener(ev, (e) => e.stopPropagation());
    }

    const topicOf = (id) => {
      const node = service.findNode(id, { mapId: resolvedMapId });
      return node ? node.topic : null;
    };

    const computeBounds = () => {
      const { nodes } = service.layout(resolvedMapId);
      if (!nodes.length) return { x: 0, y: 0, w: 1, h: 1 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
      }
      return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
    };

    // ── Render via catalog components (mind-node / connector-line) ──
    const render = () => {
      const mapId = resolvedMapId || service._activeMapId;
      if (!mapId) return;

      renderMindmapNodes(nodeLayer, svgLayer, service, mapId, {
        onToggleCollapse: async (id, next) => {
          await service.collapse(id, next, { mapId: resolvedMapId });
          renderAfterMut();
        },
      });
      // Cross-link arrows (§11) — recomputed every render from fresh layout rects.
      const arrowDefs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const marker = doc.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'mm-arrow');
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '8');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '7');
      marker.setAttribute('markerHeight', '7');
      marker.setAttribute('orient', 'auto-start-reverse');
      const tip = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      tip.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
      tip.setAttribute('class', 'mm-arrow-head');
      marker.appendChild(tip);
      arrowDefs.appendChild(marker);
      svgLayer.append(arrowDefs);
      for (const { d, arrow } of service.arrowPaths(mapId)) {
        const p = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', d);
        p.setAttribute('class', 'arrow-line');
        p.setAttribute('data-arrow-id', arrow.id);
        p.setAttribute('data-from', arrow.from);
        p.setAttribute('data-to', arrow.to);
        p.setAttribute('data-direction', arrow.direction);
        if (arrow.style?.color) p.setAttribute('data-style-color', arrow.style.color);
        if (service._selectedArrowId === arrow.id) p.setAttribute('data-selected', 'true');
        p.setAttribute('marker-end', 'url(#mm-arrow)');
        svgLayer.append(p);
      }

      focus.apply();
    };

    const renderAfterMut = () => {
      render();
      requestAnimationFrame(() => {
        const rootEl = nodeLayer.querySelector('[data-kind="root"]');
        if (rootEl) {
          const rr = rootEl.getBoundingClientRect();
          const cr = canvas.getBoundingClientRect();
          if (rr.left < -200 || rr.top < -200 || rr.left > cr.width + 200) {
            const layout = service.layout(resolvedMapId);
            const root = layout.nodes.find((x) => x.kind === 'root');
            if (root) viewport.toCenter({ x: root.x, y: root.y, w: root.w, h: root.h });
          }
        }
      });
    };

    // ── Wire interaction handlers (Wave 2) ─────────────────────────
    // Selection + Viewport are shared controllers used by the other handlers.
    const selection = new SelectionController({
      container: canvas, nodeLayer, eventBus: service.eventBus, mapId: resolvedMapId,
      onSelect: () => {}, onMultiSelect: () => {},
      onEditCommit: async (id, topic) => {
        await service.updateNode(id, { topic }, { mapId: resolvedMapId });
        renderAfterMut();
      }
    });
    const viewport = new ViewportController({ container: canvas, nodeLayer, connectorLayer: svgLayer, eventBus: service.eventBus, mapId: resolvedMapId });
    const focus = new FocusController({ service, eventBus: service.eventBus, nodeLayer, svgLayer, mapId: resolvedMapId, getRoot: () => service._getMap(resolvedMapId)?.root, onChange: updatePill });

    // ── Attach pill button listeners (focus now available) ──────────
    copyMdBtn.addEventListener('click', () => focus.copyContext('markdown'));
    copyJsonBtn.addEventListener('click', () => focus.copyContext('json'));
    exitPillBtn.addEventListener('click', () => focus.clearFocus());

    // CullingCore available for opt-in use (see src/modules/layout/).
    service.eventBus.subscribe('MINDMAP_FOCUS_REQUESTED', (e) => {
      if (e?.mapId && e.mapId !== resolvedMapId) return;
      if (e?.focusIds?.length) focus.focusNodes(e.focusIds, { scope: e.scope || 'branch' });
    });
    new NodeDragHandler({ container: canvas, nodeLayer, selection, viewport, service, eventBus: service.eventBus, mapId: resolvedMapId, onRenderNeeded: renderAfterMut }).attach();
    const contextMenu = new ContextMenu({ container: canvas, service, selection, eventBus: service.eventBus, mapId: resolvedMapId, onRenderNeeded: renderAfterMut, focus });
    contextMenu.attach();
    new KeyboardHandler({ container: canvas, selection, viewport, service, eventBus: service.eventBus, mapId: resolvedMapId, onRenderNeeded: renderAfterMut, getRoot: () => service._getMap(resolvedMapId)?.root }).attach();
    new BoxSelector({ container: canvas, nodeLayer, selection, eventBus: service.eventBus, mapId: resolvedMapId }).attach();
    new ClipboardManager({ service, selection, eventBus: service.eventBus, mapId: resolvedMapId });

    // ── Wave 3: focus / isolation interactions ──────────────────────
    svgLayer.addEventListener('click', (e) => {
      const path = e.target.closest('.connector-line');
      if (!path) return;
      const childId = path.getAttribute('data-child-id');
      if (!childId) return;
      // Shift+Click accumulates into the focus set; plain click replaces (single branch).
      if (e.shiftKey) focus.addToFocus(childId);
      else focus.focusNode(childId);
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!e.altKey) return;
      const nodeEl = e.target.closest('[data-node-id]');
      if (!nodeEl) return;
      const id = nodeEl.dataset.nodeId;
      if (!id) return;
      e.stopPropagation();
      e.preventDefault();
      focus.toggleFocus(id);
    }, true);
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') focus.clearFocus();
    });
    canvas.addEventListener('click', (e) => {
      if (e.target.closest('[data-node-id]') || e.target.closest('.mm-toolbar') || e.target.closest('.connector-line') || e.target.closest('.mm-focus-pill')) return;
      focus.clearFocus();
    });

    // ── Wave 4: cross-link arrows (§11) ────────────────────────────
    let linkMode = null;
    let arrowSource = null;
    this.startLinkMode = (direction, sourceId) => {
      linkMode = direction;
      arrowSource = sourceId || selection.selectedIds[0] || null;
      canvas.setAttribute('data-link-mode', direction);
      service._publish('MINDMAP_LINK_MODE_CHANGED', { mapId: resolvedMapId, active: true, direction, source: arrowSource });
      if (arrowSource) focus.focusNodes([arrowSource]);
    };
    const selectArrow = (arrowId) => {
      service._selectedArrowId = arrowId;
      const arrow = service.getArrows(resolvedMapId).find((a) => a.id === arrowId);
      if (arrow) {
        focus.focusNodes([arrow.from, arrow.to]);
        service._publish('MINDMAP_ARROW_SELECTED', { mapId: resolvedMapId, arrowId, from: arrow.from, to: arrow.to });
      }
      renderAfterMut();
    };
    svgLayer.addEventListener('click', (e) => {
      const p = e.target.closest('.arrow-line');
      if (!p) return;
      e.stopPropagation();
      const arrowId = p.getAttribute('data-arrow-id');
      if (arrowId) selectArrow(arrowId);
    });
    canvas.addEventListener('click', (e) => {
      if (!linkMode) return;
      const nodeEl = e.target.closest('[data-node-id]');
      if (!nodeEl) return;
      const targetId = nodeEl.dataset.nodeId;
      if (!targetId || targetId === arrowSource) return;
      service.addArrow(arrowSource, targetId, { direction: linkMode })
        .then(() => renderAfterMut())
        .catch((err) => console.warn('[mindmap] addArrow failed:', err.message));
      linkMode = null;
      arrowSource = null;
      canvas.removeAttribute('data-link-mode');
      service._publish('MINDMAP_LINK_MODE_CHANGED', { mapId: resolvedMapId, active: false });
    });
    canvas.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && service._selectedArrowId) {
        e.preventDefault();
        const id = service._selectedArrowId;
        service._selectedArrowId = null;
        service.removeArrow(id).then(() => renderAfterMut());
      }
    });

    // ── Toolbar bindings ──────────────────────────────────────────────
    zoomInBtn.addEventListener('click', () => viewport.scaleTo(viewport.scale * 1.2));
    zoomOutBtn.addEventListener('click', () => viewport.scaleTo(viewport.scale / 1.2));
    fitBtn.addEventListener('click', () => viewport.scaleFit(computeBounds()));
    layoutBtn.addEventListener('click', () => {
      const cur = service.getLayoutDirection(resolvedMapId);
      const next = layoutDirs[(layoutDirs.indexOf(cur) + 1) % layoutDirs.length];
      service.setLayoutDirection(next, { mapId: resolvedMapId });
      layoutBtn.textContent = `Layout: ${dirLabel[next]}`;
    });
    fullBtn.addEventListener('click', () => {
      if (doc.fullscreenElement) doc.exitFullscreen?.();
      else canvas.requestFullscreen?.();
    });
    focusBtn.addEventListener('click', () => focus.focusNodes(selection.selectedIds));
    exitFocusBtn.addEventListener('click', () => focus.clearFocus());
    layoutBtn.textContent = `Layout: ${dirLabel[service.getLayoutDirection(resolvedMapId)] || 'Right'}`;

    render();
    const offStructure = service.eventBus?.subscribe?.('MINDMAP_STRUCTURE_CHANGED', render);
    // Center the root on initial mount (mirrors the demo's centerMap()).
    requestAnimationFrame(() => {
      const layout = service.layout(resolvedMapId);
      const root = layout.nodes.find((x) => x.kind === 'root');
      if (root) viewport.toCenter({ x: root.x, y: root.y, w: root.w, h: root.h });
    });

    const destroy = () => {
      if (typeof offStructure === 'function') offStructure();
      try { selection.destroy(); } catch { /* noop */ }
      try { viewport.destroy(); } catch { /* noop */ }
      try { contextMenu.destroy(); } catch { /* noop */ }
      container.replaceChildren();
    };
    // Return a callable cleanup fn with host helper methods.
    const api = () => destroy();
    api.render = render;
    api.setMapId = (id) => { resolvedMapId = id; renderAfterMut(); };
    api.destroy = destroy;
    return api;
  },
};
