/**
 * MindmapRenderer — CSMA-native mindmap renderer.
 *
 * Emits a single adaptive catalog component (mind-node) + connector-line,
 * positioned by LayoutEngine output. No foreign renderer, no inline visual
 * styling: all visuals live in mind-node.css / connector-line.css (tokens.css).
 *
 * branch vs leaf is a *state* (data-has-children), not a type — one component
 * renders both, so a leaf "morphs" into a branch automatically on addChild
 * (the renderer just re-runs and the node gains data-has-children).
 *
 * Position (left/top/width/height) is layout, not visual state, so it is set
 * per-element; every colour/typography/shape lives in the catalog CSS.
 *
 * Interaction controllers (SelectionController, NodeDragHandler, …) that
 * select by `.mm-node` keep working: every node also carries the `mm-node`
 * bridge class and a `data-node-id` attribute.
 */

const DEFAULT_STATUS = 'pending';

function deriveKind(node, layoutNode) {
  if (layoutNode.kind) return layoutNode.kind;
  if (node && node.children && node.children.length > 0) return 'branch';
  return 'leaf';
}

function buildNode(doc, service, mapId, n, handlers) {
  const node = service.findNode(n.id, { mapId }) || {};
  const hasChildren = !!(node.children && node.children.length > 0);
  const collapsed = node.expanded === false;
  const kind = deriveKind(node, n);
  const status = node.status || n.status || DEFAULT_STATUS;
  const tag = node.tag || '';

  const el = doc.createElement('div');
  el.className = 'mind-node';
  el.dataset.status = status;
  if (tag) el.dataset.tag = tag;
  el.dataset.kind = kind;
  if (hasChildren) el.dataset.hasChildren = 'true';
  if (collapsed) el.dataset.collapsed = 'true';
  if (typeof node.childCount === 'number') el.dataset.childCount = String(node.childCount);
  if (node.metadata && node.metadata.bottleneck) el.dataset.bottleneck = node.metadata.bottleneck;

  const statusEl = doc.createElement('span');
  statusEl.className = 'mind-node__status';
  const topic = doc.createElement('span');
  topic.className = 'mind-node__topic';
  topic.textContent = node.topic || n.topic || '';
  el.append(statusEl, topic);

  if (tag) {
    const tagEl = doc.createElement('span');
    tagEl.className = 'mind-node__tag';
    tagEl.textContent = tag;
    el.append(tagEl);
  }

  if (hasChildren) {
    const collapse = doc.createElement('button');
    collapse.className = 'mind-node__collapse';
    collapse.type = 'button';
    collapse.setAttribute('aria-label', collapsed ? 'Expand' : 'Collapse');
    if (handlers && handlers.onToggleCollapse) {
      collapse.addEventListener('pointerdown', async (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        await handlers.onToggleCollapse(n.id, !collapsed);
      });
    }
    const count = doc.createElement('span');
    count.className = 'mind-node__count';
    count.textContent = `${node.doneCount ?? 0}/${node.childCount ?? 0}`;
    el.append(collapse, count);
  }

  // Bridge class so legacy controllers/SURFACE_CSS selecting .mm-node keep working.
  el.classList.add('mm-node');
  el.dataset.nodeId = n.id;
  el.style.position = 'absolute';
  el.style.left = `${Math.round(n.x)}px`;
  el.style.top = `${Math.round(n.y)}px`;
  if (n.w) el.style.width = `${Math.round(n.w)}px`;
  if (n.h) el.style.height = `${Math.round(n.h)}px`;
  return el;
}

/**
 * Render the map identified by `mapId` into the given node + SVG layers.
 * Returns a small summary ({ nodeCount, connectorCount }) for tests/telemetry.
 *
 * @param {HTMLElement} nodeLayer  absolutely-positioned node container
 * @param {SVGElement}  svgLayer   SVG connector layer
 * @param {object}      service    MindmapService (layout/connectorPaths/findNode/collapse)
 * @param {string}      mapId
 * @param {object}      [handlers] { onToggleCollapse(id, nextCollapsed) }
 */
export function renderMindmapNodes(nodeLayer, svgLayer, service, mapId, handlers = {}) {
  const doc = nodeLayer.ownerDocument || globalThis.document;
  const { nodes } = service.layout(mapId);
  const paths = service.connectorPaths(mapId);
  nodeLayer.replaceChildren();
  svgLayer.replaceChildren();
  for (const n of nodes) nodeLayer.append(buildNode(doc, service, mapId, n, handlers));
  for (const { d, link } of paths) {
    const child = nodes.find((x) => x.id === link.to);
    const childNode = service.findNode(link.to, { mapId }) || {};
    const p = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', 'connector-line');
    p.setAttribute('data-link-kind', link.kind || 'main');
    if (link.to) p.setAttribute('data-child-id', link.to);
    const st = (child && (childNode.status || child.status)) || DEFAULT_STATUS;
    p.setAttribute('data-status', st);
    svgLayer.append(p);
  }
  return { nodeCount: nodes.length, connectorCount: paths.length };
}
