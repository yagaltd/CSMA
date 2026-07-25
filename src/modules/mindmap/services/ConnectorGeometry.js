/**
 * ConnectorGeometry — SVG path generators for parent→child connectors.
 *
 * Attribution: faithful ES port of mind-elixir-core's
 * `src/utils/generateBranch.ts` (main() and sub() functions). Direction
 * model (LHS / RHS / DOWN), quadratic and cubic Bézier control points,
 * and the roundedVertical orthogonal connector are preserved verbatim
 * (modulo TS→ES syntax). See vendor/MIND_ELIXIR_LICENSE.
 *
 * Each generator takes parent and child rectangles
 * { pT, pL, pW, pH, cT, cL, cW, cH } (top/left/width/height) and returns
 * an SVG path `d` attribute string. Callers render `<path d="…">` in the
 * mindmap's SVG layer.
 */

export const DIRECTION_CLASS = Object.freeze({
  LHS: 'lhs',
  RHS: 'rhs',
  DOWN: 'down'
});

/**
 * Rounded orthogonal connector for top-down layout:
 * vertical → horizontal → vertical with quarter-circle corners.
 * Ported verbatim from generateBranch.ts (radius defaults to 8).
 */
function roundedVertical(x1, y1, x2, y2, radius = 8) {
  if (x1 === x2) return `M ${x1} ${y1} V ${y2}`;
  const midY = (y1 + y2) / 2;
  const dir = x2 > x1 ? 1 : -1;
  const r = Math.min(radius, Math.abs(x2 - x1) / 2, Math.abs(midY - y1), Math.abs(y2 - midY));
  return `M ${x1} ${y1} V ${midY - r} Q ${x1} ${midY} ${x1 + dir * r} ${midY} H ${x2 - dir * r} Q ${x2} ${midY} ${x2} ${midY + r} V ${y2}`;
}

/**
 * Connector from root to a direct child (a "main line").
 *
 * @param {object} rect - { pT, pL, pW, pH, cT, cL, cW, cH }
 * @param {object} ctx  - { direction, containerHeight, containerWidth? }
 * @returns {string} SVG path d attribute
 */
export function main(rect, ctx) {
  const { pT, pL, pW, pH, cT, cL, cW, cH } = rect;
  const { direction, containerHeight } = ctx;

  if (direction === DIRECTION_CLASS.DOWN) {
    const x1 = pL + pW / 2;
    const x2 = cL + cW / 2;
    const y1 = pT + pH;
    const y2 = cT;
    return roundedVertical(x1, y1, x2, y2);
  }

  let x1 = pL + pW / 2;
  const y1 = pT + pH / 2;
  let x2;
  if (direction === DIRECTION_CLASS.LHS) {
    x2 = cL + cW;
  } else {
    x2 = cL;
  }
  const y2 = cT + cH / 2;
  const pct = Math.abs(y2 - y1) / containerHeight;
  const offset = (1 - pct) * 0.25 * (pW / 2);
  if (direction === DIRECTION_CLASS.LHS) {
    x1 = x1 - pW / 10 - offset;
  } else {
    x1 = x1 + pW / 10 + offset;
  }
  return `M ${x1} ${y1} Q ${x1} ${y2} ${x2} ${y2}`;
}

/**
 * Connector between a non-root parent and its child (a "sub line").
 *
 * @param {object} rect - { pT, pL, pW, pH, cT, cL, cW, cH }
 * @param {object} ctx  - { direction, isFirst, nodeGapX? }
 * @returns {string} SVG path d attribute
 *
 * `nodeGapX` mirrors mind-elixir's `--node-gap-x` CSS variable. Defaults
 * to 30 (the value in the original `sub()` comment) when not supplied.
 */
export function sub(rect, ctx) {
  const { pT, pL, pW, pH, cT, cL, cW, cH } = rect;
  const { direction, isFirst } = ctx;

  if (direction === DIRECTION_CLASS.DOWN) {
    const x1 = pL + pW / 2;
    const y1 = pT + pH;
    const x2 = cL + cW / 2;
    const y2 = cT;
    return roundedVertical(x1, y1, x2, y2);
  }

  const GAP = Number.isFinite(ctx.nodeGapX) ? ctx.nodeGapX : 30;
  let y1;
  if (isFirst) {
    y1 = pT + pH / 2;
  } else {
    y1 = pT + pH;
  }
  const y2 = cT + cH;
  let x1;
  let x2;
  let xMid;
  let end;
  const offset = (Math.abs(y1 - y2) / 300) * GAP;
  if (direction === DIRECTION_CLASS.LHS) {
    xMid = pL;
    x1 = xMid + GAP;
    x2 = xMid - GAP;
    end = cL + GAP;
    return `M ${x1} ${y1} C ${xMid} ${y1} ${xMid + offset} ${y2} ${x2} ${y2} H ${end}`;
  }
  xMid = pL + pW;
  x1 = xMid - GAP;
  x2 = xMid + GAP;
  end = cL + cW - GAP;
  return `M ${x1} ${y1} C ${xMid} ${y1} ${xMid - offset} ${y2} ${x2} ${y2} H ${end}`;
}

/**
 * Convenience: build the rectangle context for a parent/child pair from
 * the LayoutEngine node output ({x,y,w,h}).
 */
export function rectFromNodes(parent, child) {
  return {
    pT: parent.y,
    pL: parent.x,
    pW: parent.w,
    pH: parent.h,
    cT: child.y,
    cL: child.x,
    cW: child.w,
    cH: child.h
  };
}

/**
 * Map a LayoutEngine link to a generateBranch direction class.
 * LayoutEngine uses 0 (right) / 1 (left); DOWN layouts emit undefined.
 */
export function directionClassFor(link) {
  if (link.direction === 1) return DIRECTION_CLASS.LHS;
  if (link.direction === 0) return DIRECTION_CLASS.RHS;
  return DIRECTION_CLASS.DOWN;
}
