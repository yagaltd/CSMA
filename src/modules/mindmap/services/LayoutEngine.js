/**
 * LayoutEngine — pure-function mindmap tree layout.
 *
 * Attribution: inspired by mind-elixir-core's tree-direction model
 * (LEFT | RIGHT | SIDE constants, left/right balance assignment in
 * layout.ts, the `--node-gap-x` gap knob). mind-elixir's actual layout
 * is CSS-driven via `me-*` custom elements; no pure layout function
 * exists upstream to port verbatim. This module is a fresh ES
 * implementation that returns absolute rectangles so CSMA can render
 * with its own components via ai-ui. See vendor/MIND_ELIXIR_LICENSE.
 *
 * Public surface:
 *   layout(root, options) → { nodes, links, bounds }
 *
 * Returned `nodes[i]` shape:
 *   { id, x, y, w, h, depth, direction, kind, status, collapsed }
 *     - kind: 'root' | 'branch' | 'leaf'
 *     - direction: 0 (right) | 1 (left) | undefined for DOWN layout
 *
 * Returned `links[i]` shape:
 *   { from, to, kind: 'main' | 'sub', direction }
 *     - 'main' connects root to its direct children
 *     - 'sub'  connects any non-root parent to its children
 *
 * Returned `bounds` shape:
 *   { x, y, w, h } — axis-aligned bounding rectangle of the laid-out tree.
 */

export const DIRECTION = Object.freeze({
  SIDE: 'side', // root in middle, children split left/right
  DOWN: 'down' // root on top, children stacked below
});

export const SIDE_LEFT = 0;
export const SIDE_RIGHT = 1;

const DEFAULTS = {
  direction: DIRECTION.SIDE,
  nodeWidth: 180,
  nodeHeight: 44,
  columnGap: 80, // horizontal gap between depth levels (--node-gap-x analogue)
  siblingGap: 16, // vertical gap between sibling subtrees
  branchGap: 32, // extra vertical gap between top-level branches
  collapsedWidth: 180,
  collapsedHeight: 44
};

/**
 * Assign SIDE directions to root's children, balancing left/right.
 * Favors RIGHT on ties (mindmap convention — most branches grow rightward).
 * Mutates a copy; pure with respect to the input.
 */
function assignSideDirections(children) {
  let leftCount = 0;
  let rightCount = 0;
  return children.map((child) => {
    let dir = child.direction;
    if (dir !== SIDE_LEFT && dir !== SIDE_RIGHT) {
      dir = leftCount < rightCount ? SIDE_LEFT : SIDE_RIGHT;
    }
    if (dir === SIDE_LEFT) leftCount += 1;
    else rightCount += 1;
    return { ...child, direction: dir };
  });
}

/**
 * Compute the vertical extent (height) of a subtree.
 * Collapsed nodes have no expanded children → height is a single node.
 * In SIDE direction, height = max(nodeHeight, sum of children heights + gaps).
 * In DOWN direction, height = nodeHeight + columnGap + sum of children heights + gaps.
 */
function measureSubtreeHeight(node, options, isDown = false) {
  const isCollapsed = node.expanded === false;
  const children = !isCollapsed && Array.isArray(node.children) ? node.children : [];
  if (children.length === 0) {
    return options.nodeHeight;
  }
  const gap = options.siblingGap;
  let childrenTotal = 0;
  for (let i = 0; i < children.length; i += 1) {
    childrenTotal += measureSubtreeHeight(children[i], options, isDown);
    if (i > 0) childrenTotal += gap;
  }
  if (isDown) {
    // In DOWN layout, children stack below the parent vertically.
    return options.nodeHeight + options.columnGap + childrenTotal;
  }
  // In SIDE layout, children stack alongside the parent; subtree height is
  // the max of own height and the stack of children.
  return Math.max(options.nodeHeight, childrenTotal);
}

/**
 * Recursive placement. Assigns x/y to each node and emits links.
 * `xOrigin` is the column assigned to this node's left edge.
 * `yOrigin` is the top edge available for this subtree.
 * Returns the consumed height (for sibling stacking).
 */
function placeNode(node, parent, xOrigin, yOrigin, depth, kind, direction, options, outNodes, outLinks) {
  const isCollapsed = node.expanded === false;
  const width = options.nodeWidth;
  const height = options.nodeHeight;
  const isDown = direction === undefined;

  const placed = {
    id: node.id,
    x: xOrigin,
    y: yOrigin + (measureSubtreeHeight(node, options, isDown) - height) / 2,
    w: width,
    h: height,
    depth,
    kind,
    direction,
    status: node.status || 'pending',
    collapsed: isCollapsed === true,
    hasChildren: Array.isArray(node.children) && node.children.length > 0
  };
  outNodes.push(placed);

  if (parent) {
    outLinks.push({
      from: parent.id,
      to: node.id,
      kind: parent.kind === 'root' ? 'main' : 'sub',
      direction
    });
  }

  if (isCollapsed || !Array.isArray(node.children) || node.children.length === 0) {
    return measureSubtreeHeight(node, options, isDown);
  }

  const gap = depth === 0 ? options.branchGap : options.siblingGap;
  const childKind = node.schemaType === 'mindmap/branch' && depth === 0 ? 'branch' : kind === 'branch' ? 'leaf' : kind;

  if (isDown) {
    // DOWN: children stack vertically below parent at the same x (no horizontal indent).
    const childX = xOrigin;
    const childDepth = depth + 1;
    let totalChildrenHeight = 0;
    for (let i = 0; i < node.children.length; i += 1) {
      totalChildrenHeight += measureSubtreeHeight(node.children[i], options, true);
      if (i > 0) totalChildrenHeight += gap;
    }
    let cursorY = yOrigin + height + options.columnGap;
    cursorY = yOrigin + height + options.columnGap;
    for (let i = 0; i < node.children.length; i += 1) {
      if (i > 0) cursorY += gap;
      const child = node.children[i];
      const consumed = placeNode(
        child,
        { id: node.id, kind },
        childX,
        cursorY,
        childDepth,
        childKind,
        undefined,
        options,
        outNodes,
        outLinks
      );
      cursorY += consumed;
    }
    return measureSubtreeHeight(node, options, true);
  }

  // SIDE: children at the next column in the chosen direction.
  const childX = direction === SIDE_LEFT ? xOrigin - options.columnGap - width : xOrigin + width + options.columnGap;
  const childDepth = depth + 1;

  let cursorY = yOrigin;
  const totalChildrenHeight = node.children.reduce((acc, c, i) => {
    const h = measureSubtreeHeight(c, options, false);
    return acc + h + (i > 0 ? gap : 0);
  }, 0);
  // Center the children block vertically under/over the parent.
  cursorY = yOrigin + (measureSubtreeHeight(node, options, false) - totalChildrenHeight) / 2;

  for (let i = 0; i < node.children.length; i += 1) {
    if (i > 0) cursorY += gap;
    const child = node.children[i];
    const consumed = placeNode(
      child,
      { id: node.id, kind },
      childX,
      cursorY,
      childDepth,
      childKind,
      direction,
      options,
      outNodes,
      outLinks
    );
    cursorY += consumed;
  }

  return measureSubtreeHeight(node, options, false);
}

/**
 * Lay out a mindmap tree.
 *
 * @param {object} root - Root NodeObj (with `children`, `direction`, etc.)
 * @param {object} [options]
 * @returns {{nodes: object[], links: object[], bounds: object}}
 */
export function layout(root, options = {}) {
  if (!root || typeof root !== 'object') {
    throw new Error('[LayoutEngine] layout() requires a root NodeObj');
  }
  const opts = { ...DEFAULTS, ...options };
  const nodes = [];
  const links = [];

  // Root placeholder so root's children get 'main' links.
  const rootParent = null;

  if (opts.direction === 3 || opts.direction === DIRECTION.DOWN) {
    // Top-down: everyone on one column stack below root.
    placeNode(root, rootParent, 0, 0, 0, 'root', undefined, opts, nodes, links);
  } else {
    // SIDE: balance children into left/right subtrees.
    const balancedChildren = assignSideDirections(root.children || []);
    // Synthesise a root with balanced children so child placement uses each child's direction.
    const syntheticRoot = { ...root, children: balancedChildren };

    // First place root at origin so its rectangle exists.
    const rootHeight = opts.nodeHeight;
    nodes.push({
      id: syntheticRoot.id,
      x: 0,
      y: 0,
      w: opts.nodeWidth,
      h: rootHeight,
      depth: 0,
      kind: 'root',
      direction: undefined,
      status: syntheticRoot.status || 'pending',
      collapsed: syntheticRoot.expanded === false,
      hasChildren: balancedChildren.length > 0
    });

    // Compute total height needed across both sides to center root.
    const leftChildren = balancedChildren.filter((c) => c.direction === SIDE_LEFT);
    const rightChildren = balancedChildren.filter((c) => c.direction === SIDE_RIGHT);

    const sideHeight = (kids, gap) =>
      kids.reduce((acc, k, i) => acc + measureSubtreeHeight(k, opts) + (i > 0 ? gap : 0), 0);
    const leftHeight = sideHeight(leftChildren, opts.branchGap);
    const rightHeight = sideHeight(rightChildren, opts.branchGap);
    const totalSideHeight = Math.max(leftHeight, rightHeight, rootHeight);

    // Re-center root vertically.
    nodes[0].y = (totalSideHeight - rootHeight) / 2;

    // Place right side (children grow to the right).
    let cursorY = (totalSideHeight - rightHeight) / 2;
    const rightX = opts.nodeWidth + opts.columnGap;
    for (let i = 0; i < rightChildren.length; i += 1) {
      if (i > 0) cursorY += opts.branchGap;
      const child = rightChildren[i];
      const consumed = placeNode(
        child,
        { id: syntheticRoot.id, kind: 'root' },
        rightX,
        cursorY,
        1,
        'branch',
        SIDE_RIGHT,
        opts,
        nodes,
        links
      );
      cursorY += consumed;
    }

    // Place left side (children grow to the left; x decreasing).
    cursorY = (totalSideHeight - leftHeight) / 2;
    const leftX = -opts.columnGap - opts.nodeWidth;
    for (let i = 0; i < leftChildren.length; i += 1) {
      if (i > 0) cursorY += opts.branchGap;
      const child = leftChildren[i];
      const consumed = placeNode(
        child,
        { id: syntheticRoot.id, kind: 'root' },
        leftX,
        cursorY,
        1,
        'branch',
        SIDE_LEFT,
        opts,
        nodes,
        links
      );
      cursorY += consumed;
    }
  }

  // Compute bounds.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.w > maxX) maxX = n.x + n.w;
    if (n.y + n.h > maxY) maxY = n.y + n.h;
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }
  const bounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

  return { nodes, links, bounds };
}

/**
 * Recompute layout with new options without re-walking input — utility
 * for resize / theme changes. Returns the same shape as layout().
 */
export function relayout(root, options = {}) {
  return layout(root, options);
}

export const LAYOUT_DEFAULTS = DEFAULTS;
