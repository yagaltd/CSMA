/**
 * ArrowGeometry — SVG path generator for cross-link arrows (CSMA mindmap).
 *
 * Arrows are graph edges between NON-parent nodes (true cross-links), stored
 * at map level (map.arrows). This service computes a bezier path between two
 * node rectangles using the LayoutEngine {x,y,w,h} output — no DOM measure.
 *
 * Sibling of ConnectorGeometry (pure rect math, no document dependency).
 */

/**
 * Pick the point on `rect` border that faces `toward` (a point outside).
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @param {{x:number,y:number}} toward
 */
function borderAnchor(rect, toward) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/**
 * @param {{x:number,y:number,w:number,h:number}} fromRect
 * @param {{x:number,y:number,w:number,h:number}} toRect
 * @param {{curved?:boolean}} [opts]
 * @returns {{d:string, id:string}}
 */
export function arrowPath(fromRect, toRect, opts = {}) {
  const fromC = { x: fromRect.x + fromRect.w / 2, y: fromRect.y + fromRect.h / 2 };
  const toC = { x: toRect.x + toRect.w / 2, y: toRect.y + toRect.h / 2 };
  const start = borderAnchor(fromRect, toC);
  const end = borderAnchor(toRect, fromC);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let d;
  if (!opts.curved || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) {
    d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  } else {
    const c1 = { x: start.x + dx * 0.5, y: start.y };
    const c2 = { x: end.x - dx * 0.5, y: end.y };
    d = `M ${start.x} ${start.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`;
  }
  return { d, id: 'mm-arrow' };
}
