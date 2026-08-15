/**
 * MindmapSurfaceCSS - SURFACE_CSS stylesheet for the mounted mindmap surface.
 *
 * Extracted from MindmapService.js (Phase 6 modular decomposition, lane M1;
 * see docs/plans/active/audit-fix-plan.md 6.1). Cut/paste move; no behavior
 * changes. Re-attached to the class as `static SURFACE_CSS` by
 * MindmapService.js so the public static keeps working.
 */

export const SURFACE_CSS = `/* ── Canvas ─────────────────────────────────────────────────── */
.mm-canvas {
  position: relative; width: 100%; height: 100%; min-height: 320px;
  overflow: hidden; outline: none; user-select: none; touch-action: none;
  background: var(--mindmap-canvas-bg, var(--background, #fafafa));
}
.mm-surface-svg {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; overflow: visible;
}
.mm-surface-nodes {
  position: absolute; top: 0; left: 0; transform-origin: 0 0;
}
.mm-canvas[data-read-only] { pointer-events: none; }
.mm-surface-nodes [data-selected] {
  outline: 2px solid var(--accent); outline-offset: 2px;
}

/* ── Node base (shared) ─────────────────────────────────────── */
.mm-surface-nodes .mm-node {
  box-sizing: border-box; position: absolute;
  min-width: 0; min-height: 0; overflow: hidden;
  font-family: var(--font-family-base, system-ui);
  transition: box-shadow var(--duration-fast, 120ms) ease,
              opacity var(--duration-fast, 120ms) ease;
}
/* All nodes: rounded rect, tinted background, left accent border */
.mm-surface-nodes .mm-node {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 8px;
  background: hsl(var(--mm-hue, 210), 70%, 95%);
  border: 1px solid hsl(var(--mm-hue, 210), 50%, 65%);
  border-left-width: 3px;
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  cursor: pointer;
}
.mm-node[data-kind="root"] {
  background: hsl(var(--mm-hue, 210), 60%, 90%);
  border: 2px solid hsl(var(--mm-hue, 210), 50%, 50%);
  border-radius: var(--radius-lg, 12px);
  padding: 6px 12px;
  font-weight: var(--font-weight-bold, 700);
}
/* Dark */
[data-theme="dark"] .mm-surface-nodes .mm-node,
[data-theme="dark-storm"] .mm-surface-nodes .mm-node {
  background: hsl(var(--mm-hue, 210), 25%, 14%);
  border-color: hsl(var(--mm-hue, 210), 40%, 35%);
}
[data-theme="dark"] .mm-node[data-kind="root"],
[data-theme="dark-storm"] .mm-node[data-kind="root"] {
  background: hsl(var(--mm-hue, 210), 20%, 18%);
  border-color: hsl(var(--mm-hue, 210), 50%, 45%);
}

/* ── Status dot ─────────────────────────────────────────────── */
.mm-node__status {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  background: hsl(var(--mm-hue, 210), 40%, 60%);
}
.mm-node[data-status="done"] .mm-node__status {
  background: var(--success, #22c55e);
}
.mm-node[data-status="in_progress"] .mm-node__status {
  background: hsl(var(--mm-hue, 210), 70%, 45%);
}
.mm-node[data-status="blocked"] .mm-node__status {
  background: var(--destructive, #ef4444);
}

/* ── Topic text ─────────────────────────────────────────────── */
.mm-node__topic {
  font-size: var(--font-size-sm, 13px);
  font-weight: var(--font-weight-semibold, 600);
  line-height: 1.3;
  color: var(--foreground);
  flex: 1;
}
.mm-node[data-kind="root"] .mm-node__topic {
  font-size: var(--font-size-base, 15px);
  font-weight: var(--font-weight-bold, 700);
}
.mm-node[data-status="done"] .mm-node__topic {
  text-decoration: line-through; opacity: 0.6;
}

/* ── Tag ────────────────────────────────────────────────────── */
.mm-node__tag {
  font-size: 10px; font-weight: 500;
  padding: 0 4px; border-radius: 3px;
  background: hsl(var(--mm-hue, 210), 60%, 88%);
  color: hsl(var(--mm-hue, 210), 60%, 30%);
  text-transform: lowercase;
}
[data-theme="dark"] .mm-node__tag,
[data-theme="dark-storm"] .mm-node__tag {
  background: hsl(var(--mm-hue, 210), 30%, 25%);
  color: hsl(var(--mm-hue, 210), 50%, 75%);
}

/* ── Collapse button ────────────────────────────────────────── */
.mm-node__collapse {
  position: absolute; left: -14px; top: 50%; transform: translateY(-50%);
  width: 14px; height: 14px; border-radius: 50%; padding: 0;
  background: var(--surface); border: 1px solid hsl(var(--mm-hue, 210), 50%, 65%);
  cursor: pointer; font-size: 8px; line-height: 12px; text-align: center;
  color: hsl(var(--mm-hue, 210), 50%, 40%); z-index: 2;
}
.mm-node__collapse:hover {
  background: hsl(var(--mm-hue, 210), 60%, 50%);
  border-color: hsl(var(--mm-hue, 210), 60%, 50%);
  color: #fff;
}
.mm-node__collapse::before { content: "▾"; }
.mm-node[data-collapsed="true"] .mm-node__collapse::before { content: "▸"; }
/* Hide collapse when no children */
.mm-node:not([data-has-children="true"]) .mm-node__collapse { display: none; }

/* ── Connectors ─────────────────────────────────────────────── */
.connector-line {
  stroke: hsl(var(--mm-hue, 210), 50%, 60%);
  stroke-width: 2; stroke-linecap: round; fill: none;
}
.connector-line[data-link-kind="main"] { stroke-width: 2.5; }
.connector-line[data-status="done"] { opacity: 0.3; }
.connector-line[data-status="blocked"] { stroke: var(--destructive, #ef4444); }
[data-theme="dark"] .connector-line,
[data-theme="dark-storm"] .connector-line {
  stroke: hsl(var(--mm-hue, 210), 45%, 50%);
}

/* ── Arrow cross-links ──────────────────────────────────────── */
.arrow-line {
  fill: none; stroke: hsl(var(--mm-hue, 210), 40%, 50%);
  stroke-width: 1.5; stroke-dasharray: 4 3; pointer-events: stroke; cursor: pointer;
}
.arrow-line[data-selected] { stroke-width: 2.5; stroke-dasharray: none; }
.mm-arrow-head { fill: hsl(var(--mm-hue, 210), 40%, 50%); }

/* ── Toolbar ────────────────────────────────────────────────── */
.mm-toolbar {
  position: absolute; top: var(--space-sm); left: var(--space-sm); z-index: 5;
  display: flex; gap: var(--space-xs); flex-wrap: wrap; align-items: center;
  padding: var(--space-xs);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  border: 1px solid var(--border); border-radius: var(--radius-md);
  pointer-events: auto;
}
.mm-toolbar .button { pointer-events: auto; }

/* ── Focus ──────────────────────────────────────────────────── */
.mm-canvas[data-mode="focus"] .mm-surface-nodes .mm-node:not([data-in-focus]) { opacity: 0.25; filter: saturate(0.55); }
.mm-canvas[data-mode="focus"] .mm-surface-svg .connector-line:not([data-in-focus]) { opacity: 0.12; }
.mm-focus-pill {
  position: absolute; bottom: var(--space-sm); left: 50%; transform: translateX(-50%); z-index: 6;
  display: flex; gap: var(--space-xs); align-items: center;
  padding: var(--space-xs) var(--space-sm);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  border: 1px solid var(--border); border-radius: var(--radius-md);
  pointer-events: auto;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--foreground) 12%, transparent);
}
.mm-focus-pill .badge { font-size: var(--font-size-xs, 12px); }

/* ── Drag ghost ─────────────────────────────────────────────── */
.mindmap-drag-ghost {
  position: fixed; z-index: 10001; pointer-events: none;
  padding: 4px 8px; border-radius: var(--radius-sm, 4px);
  background: var(--surface); border: 1px dashed var(--accent);
  font-size: var(--font-size-sm, 14px); white-space: nowrap;
}
.insert-preview-in { outline: 2px solid var(--accent); outline-offset: 3px; }
.insert-preview-before, .insert-preview-after {
  position: absolute; left: 0; right: 0; height: 3px;
  background: var(--accent); border-radius: 2px;
  z-index: 9999; pointer-events: none;
}
.insert-preview-before { top: -2px; }
.insert-preview-after { bottom: -2px; }
`;
