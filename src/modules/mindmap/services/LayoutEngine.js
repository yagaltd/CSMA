/**
 * LayoutEngine — pure-function mindmap tree layout using the
 * non-layered tidy tree algorithm (Buchheim et al., "Improving Walker's
 * Algorithm to Run in Linear Time").
 *
 * Ported from mindmap-layouts (MIT, leungwensen) and adapted for CSMA's
 * NodeObj model with collapse support, variable node sizing, and the
 * CSMA direction system (0 = left, 1 = right, 2 = balanced side, 3 = down).
 *
 * The core algorithm (firstWalk / secondWalk) uses contour threads to
 * pack subtrees as close as possible. Separation is resolved by comparing
 * left/right subtree outlines — siblings with mismatched shapes (tall +
 * short) no longer waste space at a fixed gap.
 *
 * Public surface:
 *   layout(root, options) → { nodes, links, bounds }
 *
 * Returned `nodes[i]` shape:
 *   { id, x, y, w, h, depth, direction, kind, status, collapsed, hasChildren }
 *
 * Returned `links[i]` shape:
 *   { from, to, kind: 'main' | 'sub', direction }
 *
 * Returned `bounds` shape:
 *   { x, y, w, h }
 */

// ─── Direction constants ────────────────────────────────────────────

export const DIRECTION = Object.freeze({
  SIDE: 'side',
  DOWN: 'down'
});

export const SIDE_LEFT = 0;
export const SIDE_RIGHT = 1;

// ─── Defaults ───────────────────────────────────────────────────────

const DEFAULTS = {
  direction: DIRECTION.SIDE,
  nodeWidth: 180,
  nodeHeight: 44,
  columnGap: 80,
  siblingGap: 16,
  branchGap: 32,
  collapsedWidth: 180,
  collapsedHeight: 44
};

export const LAYOUT_DEFAULTS = DEFAULTS;

// ─── Text measurement (approximate) ─────────────────────────────────

function textWidth(text) {
  if (!text) return 40;
  return Math.max(40, String(text).length * 8 + 24);
}

// ═══════════════════════════════════════════════════════════════════════
// WrappedTree — internal node for the tidy tree algorithm
// ═══════════════════════════════════════════════════════════════════════

class WrappedTree {
  constructor(w, h, y, c = []) {
    this.w = w;         // orthogonal dimension (algorithm positions this)
    this.h = h;         // along-depth dimension
    this.y = y;         // depth position (set by layer / assignDepth)
    this.c = c;         // child WrappedTrees
    this.cs = c.length;

    this.x = 0;         // final orthogonal position
    this.prelim = 0;    // preliminary position
    this.mod = 0;       // modifier accumulated by ancestors
    this.shift = 0;     // distributed spacing adjustment
    this.change = 0;    // residual distribution
    this.tl = null;     // left thread
    this.tr = null;     // right thread
    this.el = null;     // extreme left of subtree
    this.er = null;     // extreme right of subtree
    this.msel = 0;      // modifier sum at extreme left
    this.mser = 0;      // modifier sum at extreme right
  }

  /**
   * Build WrappedTree from a CSMA NodeObj subtree.
   * @param {object} node - CSMA NodeObj (with _ly depth set by assignDepth)
   * @param {Function} gw - getWidth(node) → total width
   * @param {Function} gh - getHeight(node) → total height
   * @param {boolean} isH - horizontal layout
   */
  static fromNode(node, gw, gh, isH) {
    const collapsed = node.expanded === false;
    const kids = (!collapsed && Array.isArray(node.children)) ? node.children : [];
    const c = kids.map((k) => WrappedTree.fromNode(k, gw, gh, isH));
    const w = gw(node);
    const h = gh(node);
    if (isH) {
      // Horizontal: depth → x-axis. Algorithm positions y-axis.
      // WrappedTree.w = height (orthogonal), .h = width (depth), .y = node._ly (x position)
      return new WrappedTree(h, w, node._ly, c);
    }
    // Vertical: depth → y-axis. Algorithm positions x-axis.
    return new WrappedTree(w, h, node._ly, c);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Core algorithm: non-layered tidy tree (Walker / Buchheim et al.)
// Ported from mindmap-layouts/lib/algorithms/non-layered-tidy-tree.js (MIT)
// ═══════════════════════════════════════════════════════════════════════

function firstWalk(t) {
  if (t.cs === 0) { setExtremes(t); return; }
  firstWalk(t.c[0]);
  let ih = updateIYL(bottom(t.c[0].el), 0, null);
  for (let i = 1; i < t.cs; ++i) {
    firstWalk(t.c[i]);
    const min = bottom(t.c[i].er);
    separate(t, i, ih);
    ih = updateIYL(min, i, ih);
  }
  positionRoot(t);
  setExtremes(t);
}

function setExtremes(t) {
  if (t.cs === 0) { t.el = t; t.er = t; t.msel = t.mser = 0; }
  else {
    t.el = t.c[0].el; t.msel = t.c[0].msel;
    t.er = t.c[t.cs - 1].er; t.mser = t.c[t.cs - 1].mser;
  }
}

function separate(t, i, ih) {
  let sr = t.c[i - 1]; let mssr = sr.mod;
  let cl = t.c[i];      let mscl = cl.mod;
  while (sr !== null && cl !== null) {
    if (bottom(sr) > ih.low) ih = ih.nxt;
    const dist = (mssr + sr.prelim + sr.w) - (mscl + cl.prelim);
    if (dist > 0) { mscl += dist; moveSubtree(t, i, ih.index, dist); }
    const sy = bottom(sr); const cy = bottom(cl);
    if (sy <= cy) { sr = nextRightContour(sr); if (sr !== null) mssr += sr.mod; }
    if (sy >= cy) { cl = nextLeftContour(cl);   if (cl !== null) mscl += cl.mod; }
  }
  if (!sr && !!cl) setLeftThread(t, i, cl, mscl);
  else if (!!sr && !cl) setRightThread(t, i, sr, mssr);
}

function moveSubtree(t, i, si, dist) {
  t.c[i].mod += dist; t.c[i].msel += dist; t.c[i].mser += dist;
  distributeExtra(t, i, si, dist);
}

function nextLeftContour(t)  { return t.cs === 0 ? t.tl : t.c[0]; }
function nextRightContour(t) { return t.cs === 0 ? t.tr : t.c[t.cs - 1]; }
function bottom(t)           { return t.y + t.h; }

function setLeftThread(t, i, cl, modsumcl) {
  const li = t.c[0].el; li.tl = cl;
  const diff = (modsumcl - cl.mod) - t.c[0].msel;
  li.mod += diff; li.prelim -= diff;
  t.c[0].el = t.c[i].el; t.c[0].msel = t.c[i].msel;
}

function setRightThread(t, i, sr, modsumsr) {
  const ri = t.c[i].er; ri.tr = sr;
  const diff = (modsumsr - sr.mod) - t.c[i].mser;
  ri.mod += diff; ri.prelim -= diff;
  t.c[i].er = t.c[i - 1].er; t.c[i].mser = t.c[i - 1].mser;
}

function positionRoot(t) {
  t.prelim = (
    t.c[0].prelim + t.c[0].mod + t.c[t.cs - 1].mod +
    t.c[t.cs - 1].prelim + t.c[t.cs - 1].w
  ) / 2 - t.w / 2;
}

function secondWalk(t, modsum) {
  modsum += t.mod; t.x = t.prelim + modsum;
  addChildSpacing(t);
  for (let i = 0; i < t.cs; i++) secondWalk(t.c[i], modsum);
}

function distributeExtra(t, i, si, dist) {
  if (si !== i - 1) {
    const nr = i - si;
    t.c[si + 1].shift += dist / nr;
    t.c[i].shift -= dist / nr;
    t.c[i].change -= dist - dist / nr;
  }
}

function addChildSpacing(t) {
  let d = 0, modsumdelta = 0;
  for (let i = 0; i < t.cs; i++) {
    d += t.c[i].shift; modsumdelta += d + t.c[i].change;
    t.c[i].mod += modsumdelta;
  }
}

function updateIYL(low, index, ih) {
  while (ih !== null && low >= ih.low) ih = ih.nxt;
  return { low, index, nxt: ih };
}

// ═══════════════════════════════════════════════════════════════════════
// Tree utilities
// ═══════════════════════════════════════════════════════════════════════

/** Shift the orthogonal coordinate of entire subtree. */
function shiftOrtho(node, move, isH) {
  if (isH) node.y += move; else node.x += move;
  if (Array.isArray(node.children)) node.children.forEach((c) => shiftOrtho(c, move, isH));
}

/** Minimum orthogonal coordinate in subtree. */
function minOrtho(node, isH) {
  let res = isH ? node.y : node.x;
  if (Array.isArray(node.children)) {
    node.children.forEach((c) => { res = Math.min(res, minOrtho(c, isH)); });
  }
  return res;
}

/** Normalize so orthogonal coordinates start at 0. */
function normalizeOrtho(node, isH) {
  const min = minOrtho(node, isH);
  if (min < 0) shiftOrtho(node, -min, isH);
}

/**
 * Assign depth positions along the primary axis.
 * `colGap` is added between levels (does NOT affect node size).
 */
function assignDepth(node, isH, gw, gh, directionTag, colGap, d = 0) {
  node._ly = d;
  node._dir = directionTag;
  const dim = isH ? gw(node) : gh(node);
  d += dim + (colGap || 0);
  const collapsed = node.expanded === false;
  const kids = (!collapsed && Array.isArray(node.children)) ? node.children : [];
  for (const k of kids) assignDepth(k, isH, gw, gh, directionTag, colGap, d);
}

/**
 * Map WrappedTree positions back to node coordinates.
 * Horizontal: wt.x → node.y (orthogonal), node._ly → node.x (depth).
 * Vertical:   wt.x → node.x (orthogonal), node._ly → node.y (depth).
 */
function applyPositions(node, wt, isH) {
  if (isH) { node.x = node._ly; node.y = wt.x; }
  else     { node.x = wt.x;    node.y = node._ly; }
  const collapsed = node.expanded === false;
  const kids = (!collapsed && Array.isArray(node.children)) ? node.children : [];
  for (let i = 0; i < kids.length; i++) applyPositions(kids[i], wt.c[i], isH);
}

/** Mirror a right-growing tree to grow leftward. Mutates in-place. */
function mirrorRightToLeft(node, gw) {
  let left = Infinity, right = -Infinity;
  const walkBB = (n) => {
    const w = n._w || gw(n);
    left = Math.min(left, n.x); right = Math.max(right, n.x + w);
    if (Array.isArray(n.children)) n.children.forEach(walkBB);
  };
  walkBB(node);
  const bbw = right - left;
  const walkMirror = (n) => {
    const w = n._w || gw(n);
    n.x = left - (n.x - left) - w + bbw;
    if (Array.isArray(n.children)) n.children.forEach(walkMirror);
  };
  walkMirror(node);
}

/**
 * Compute bounding box of a set of children (not including their parent).
 * Nodes must have `_w` / `_h` set (or use gw/gh).
 */
function childrenBounds(children, gw, gh) {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  const walk = (n) => {
    const w = n._w || gw(n); const h = n._h || gh(n);
    l = Math.min(l, n.x); t = Math.min(t, n.y);
    r = Math.max(r, n.x + w); b = Math.max(b, n.y + h);
    if (Array.isArray(n.children)) n.children.forEach(walk);
  };
  children.forEach(walk);
  return { left: l, top: t, right: r, bottom: b, width: r - l, height: b - t };
}

/** Translate a subtree. */
function translateTree(node, tx, ty) {
  if (tx) { const w = (n) => { n.x += tx; if (n.children) n.children.forEach(w); }; w(node); }
  if (ty) { const w = (n) => { n.y += ty; if (n.children) n.children.forEach(w); }; w(node); }
}

/** Clone a NodeObj tree (shallow copy nodes, deep copy children arrays). */
function cloneTree(node) {
  const c = Array.isArray(node.children) ? node.children.map(cloneTree) : [];
  return { ...node, children: c };
}

// ═══════════════════════════════════════════════════════════════════════
// Node kind from schemaType
// ═══════════════════════════════════════════════════════════════════════

function nodeKind(node) {
  if (node._isRoot) return 'root';
  if (node.schemaType === 'mindmap/leaf') return 'leaf';
  return 'branch';
}

// ═══════════════════════════════════════════════════════════════════════
// Collect output nodes and links
// ═══════════════════════════════════════════════════════════════════════

function collectNodes(node, dirTag, outNodes, outLinks, parentInfo, gw, gh, depth) {
  const w = node._w || gw(node);
  const h = node._h || gh(node);
  const collapsed = node.expanded === false;
  const kids = (!collapsed && Array.isArray(node.children)) ? node.children : [];
  const kind = node._isRoot ? 'root' : nodeKind(node);

  outNodes.push({
    id: node.id,
    x: node.x, y: node.y,
    w, h,
    depth,
    kind,
    direction: dirTag,
    status: node.status || 'pending',
    collapsed,
    hasChildren: kids.length > 0
  });

  if (parentInfo) {
    outLinks.push({
      from: parentInfo.id,
      to: node.id,
      kind: parentInfo.kind === 'root' ? 'main' : 'sub',
      direction: dirTag
    });
  }

  for (const child of kids) {
    collectNodes(child, dirTag, outNodes, outLinks,
      { id: node.id, kind }, gw, gh, depth + 1);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Run tidy tree on a single-direction subtree
// ═══════════════════════════════════════════════════════════════════════

function runTidyTree(rootNode, directionTag, gw, gh, ghOut, colGap) {
  const isH = directionTag !== undefined; // undefined → DOWN (vertical)

  // 1. Assign depth positions (uses gh = with sibling gap for algorithm spacing).
  assignDepth(rootNode, isH, gw, gh, directionTag, colGap);

  // 2. Build WrappedTree.
  const wt = WrappedTree.fromNode(rootNode, gw, gh, isH);

  // 3. Run the algorithm.
  firstWalk(wt);
  secondWalk(wt, 0);

  // 4. Map back.
  applyPositions(rootNode, wt, isH);

  // 5. Normalize to non-negative orthogonal coordinates.
  normalizeOrtho(rootNode, isH);

  // 6. Store OUTPUT dimensions (ghOut = without sibling gap, for rendering).
  const storeDims = (n) => { n._w = gw(n); n._h = ghOut(n); if (n.children) n.children.forEach(storeDims); };
  storeDims(rootNode);
}

// ═══════════════════════════════════════════════════════════════════════
// Public: layout
// ═══════════════════════════════════════════════════════════════════════

/**
 * Lay out a mindmap tree.
 *
 * @param {object} root - Root NodeObj
 * @param {object} [options]
 * @param {number|string} [options.direction=1] - 0=left, 1=right, 2=side, 3=down
 * @param {Function} [options.getWidth]  - (node) → total node width
 * @param {Function} [options.getHeight] - (node) → total node height
 * @returns {{nodes: object[], links: object[], bounds: object}}
 */
export function layout(root, options = {}) {
  if (!root || typeof root !== 'object') {
    throw new Error('[LayoutEngine] layout() requires a root NodeObj');
  }

  const dir = options.direction ?? 1;
  const baseW = options.nodeWidth ?? DEFAULTS.nodeWidth;
  const baseH = options.nodeHeight ?? DEFAULTS.nodeHeight;
  const colGap = options.columnGap ?? DEFAULTS.columnGap;
  const sibGap = options.siblingGap ?? DEFAULTS.siblingGap;

  // Dimension functions. Default: fixed size unless callbacks provided.
  const gw = options.getWidth  || ((n) => baseW);
  // Height includes sibling gap so the algorithm spaces siblings apart.
  const ghRaw = options.getHeight || ((n) => baseH);
  const gh = (n) => ghRaw(n) + sibGap;

  const isDown = dir === 3 || dir === DIRECTION.DOWN;
  const isSide = dir === 2 || dir === DIRECTION.SIDE;
  const isLeft = dir === 0;

  const outNodes = [];
  const outLinks = [];

  // ── Top-down layout ──────────────────────────────────────────────
  if (isDown) {
    const r = cloneTree(root);
    r._isRoot = true;
    runTidyTree(r, undefined, gw, gh, ghRaw, colGap);
    collectNodes(r, undefined, outNodes, outLinks, null, gw, ghRaw, 0);
  }

  // ── Single-direction (left or right) ─────────────────────────────
  else if (!isSide) {
    const directionTag = isLeft ? SIDE_LEFT : SIDE_RIGHT;
    const r = cloneTree(root);
    r._isRoot = true;
    runTidyTree(r, SIDE_RIGHT, gw, gh, ghRaw, colGap); // algorithm always grows rightward
    if (isLeft) mirrorRightToLeft(r, gw);
    collectNodes(r, directionTag, outNodes, outLinks, null, gw, ghRaw, 0);
  }

  // ── Balanced side layout ─────────────────────────────────────────
  else {
    const allChildren = Array.isArray(root.children) ? [...root.children] : [];
    const rightKids = allChildren.filter(c => c.direction !== SIDE_LEFT);
    const leftKids = allChildren.filter(c => c.direction === SIDE_LEFT);
    // If all children are undirected, balance them.
    if (rightKids.length === allChildren.length || leftKids.length === allChildren.length) {
      const split = Math.round(allChildren.length / 2);
      rightKids.length = 0;
      leftKids.length = 0;
      for (let i = 0; i < allChildren.length; i++) {
        if (i < split) rightKids.push(allChildren[i]);
        else leftKids.push(allChildren[i]);
      }
    }

    // Virtual roots for each side — same dimensions as main root.
    const rw = gw(root);
    const rh = gh(root);

    const rightVirt = { ...root, children: rightKids.map(cloneTree), _isRoot: true };
    const leftVirt  = { ...root, children: leftKids.map(cloneTree),  _isRoot: true };

    if (rightKids.length > 0) {
      runTidyTree(rightVirt, SIDE_RIGHT, gw, gh, ghRaw, colGap);

      // Children x starts at rw (virtual root width). That's exactly where
      // they should sit relative to the main root — no X shift needed.
      // Center children block vertically on main root center.
      const bb = childrenBounds(rightVirt.children, gw, ghRaw);
      const shiftY = rh / 2 - (bb.top + bb.bottom) / 2;
      if (shiftY) translateTree(rightVirt, 0, shiftY);

      for (const child of rightVirt.children) {
        collectNodes(child, SIDE_RIGHT, outNodes, outLinks,
          { id: root.id, kind: 'root' }, gw, ghRaw, 1);
      }
    }

    if (leftKids.length > 0) {
      runTidyTree(leftVirt, SIDE_RIGHT, gw, gh, ghRaw, colGap); // temporary rightward
      mirrorRightToLeft(leftVirt, gw);

      // After mirror, children are to the left of the virtual root.
      // Position rightmost child edge at -colGap from root's left edge.
      const bb = childrenBounds(leftVirt.children, gw, ghRaw);
      const shiftX = -colGap - bb.right;
      const shiftY = rh / 2 - (bb.top + bb.bottom) / 2;
      translateTree(leftVirt, shiftX, shiftY);

      for (const child of leftVirt.children) {
        collectNodes(child, SIDE_LEFT, outNodes, outLinks,
          { id: root.id, kind: 'root' }, gw, ghRaw, 1);
      }
    }

    // Add main root node.
    outNodes.unshift({
      id: root.id, x: 0, y: 0, w: rw, h: rh,
      depth: 0, kind: 'root', direction: undefined,
      status: root.status || 'pending',
      collapsed: root.expanded === false,
      hasChildren: allChildren.length > 0
    });

    // Center root vertically among its children.
    if (outNodes.length > 1) {
      let minY = Infinity, maxY = -Infinity;
      for (let i = 1; i < outNodes.length; i++) {
        minY = Math.min(minY, outNodes[i].y);
        maxY = Math.max(maxY, outNodes[i].y + outNodes[i].h);
      }
      const centerY = (minY + maxY) / 2;
      outNodes[0].y = Math.round(centerY - rh / 2);
    }
  }

  // ── Compute bounds ───────────────────────────────────────────────
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of outNodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.w > maxX) maxX = n.x + n.w;
    if (n.y + n.h > maxY) maxY = n.y + n.h;
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }
  const bounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

  return { nodes: outNodes, links: outLinks, bounds };
}

/** Alias for API compatibility. */
export function relayout(root, options = {}) {
  return layout(root, options);
}
