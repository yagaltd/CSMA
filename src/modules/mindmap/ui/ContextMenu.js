/**
 * ContextMenu — right-click context menu for the mindmap canvas.
 *
 * Phase 17 of the mindmap module (CSMA). Standalone class; imported by
 * the demo page or renderer.
 *
 * Contract: .wave1-contract.md §Phase 17.  Uses SelectionController and
 * MindmapService APIs from Phases 10 and 15.
 *
 * Security: no innerHTML for user data.  All labels use textContent.
 * Menu items built with createElement + textContent.  Design-token
 * styled via injected <style> element (idempotent).
 */

const STYLE_ID = 'mindmap-context-menu-styles';
const MENU_CLASS = 'mindmap-context-menu';

// ---------------------------------------------------------------------------
// English fallback labels (used when no i18n object is provided)
// ---------------------------------------------------------------------------
const DEFAULT_LABELS = Object.freeze({
  'mindmap.menu.addChild': 'Add child',
  'mindmap.menu.addParent': 'Add parent',
  'mindmap.menu.addSibling': 'Add sibling',
  'mindmap.menu.removeNode': 'Remove node',
  'mindmap.menu.moveUp': 'Move up',
  'mindmap.menu.moveDown': 'Move down',
});

// ---------------------------------------------------------------------------
// Inject styles (once, idempotent)
// ---------------------------------------------------------------------------
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.${MENU_CLASS} {
  position: fixed;
  z-index: 10000;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #ccc);
  border-radius: var(--radius-sm, 4px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  padding: 4px 0;
  min-width: 160px;
  font-family: var(--font-sans, sans-serif);
  font-size: var(--font-size-sm, 14px);
  user-select: none;
  -webkit-user-select: none;
}
.${MENU_CLASS} li {
  padding: 6px 12px;
  cursor: pointer;
  list-style: none;
  color: var(--foreground, #333);
  white-space: nowrap;
}
.${MENU_CLASS} li:hover {
  background: var(--accent, #4f90f2);
  color: white;
}
.${MENU_CLASS} li.disabled {
  color: var(--foreground-muted, #999);
  cursor: default;
  pointer-events: none;
}
.${MENU_CLASS} .mindmap-context-separator {
  border-top: 1px solid var(--border, #eee);
  margin: 4px 0;
  pointer-events: none;
  cursor: default;
  padding: 0;
  height: 0;
  overflow: hidden;
}
`;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a menu <li>.  text always set via textContent (safe). */
function createItem(text, disabled, onClick) {
  const li = document.createElement('li');
  li.textContent = text;
  if (disabled) li.classList.add('disabled');
  if (onClick) {
    li.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!disabled) onClick();
    });
  }
  return li;
}

/** Build a separator <li>. */
function createSeparator() {
  const li = document.createElement('li');
  li.classList.add('mindmap-context-separator');
  return li;
}

/** Position the menu so it fits within the viewport. */
function positionMenu(menu, x, y) {
  // Read dimensions first (menu must be in DOM, even if invisible).
  // We make it visible but off-screen temporarily so measurements work.
  menu.style.visibility = 'hidden';
  menu.style.left = '0px';
  menu.style.top = '0px';
  // Flush layout
  menu.offsetHeight; // eslint-disable-line no-unused-expressions

  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;

  let left = x;
  let top = y;

  // Flip horizontally if menu overflows right edge
  if (x + mw > window.innerWidth) {
    left = Math.max(0, x - mw);
  }
  // Flip vertically if menu overflows bottom edge
  if (y + mh > window.innerHeight) {
    top = Math.max(0, y - mh);
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = '';
}

// ---------------------------------------------------------------------------
// ContextMenu class
// ---------------------------------------------------------------------------

export class ContextMenu {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.container — the .canvas element (receives contextmenu)
   * @param {import('../services/MindmapService.js').MindmapService} opts.service
   * @param {import('../services/SelectionController.js').SelectionController} opts.selection
   * @param {object} [opts.eventBus] — optional EventBus
   * @param {string} [opts.mapId] — active map id
   * @param {{ t(key:string):string }} [opts.i18n] — optional i18n object with t() method
   * @param {function():void} [opts.onRenderNeeded] — called after a tree mutation so the host re-renders
   */
  constructor({ container, service, selection, eventBus, mapId, i18n, onRenderNeeded }) {
    this._container = container;
    this._service = service;
    this._selection = selection;
    this._mapId = mapId || null;
    this._i18n = i18n || null;
    this._onRenderNeeded = onRenderNeeded || (() => {});

    /** @type {HTMLElement|null} */
    this._menu = null;

    this._boundContextMenu = this._onContextMenu.bind(this);
    this._boundGlobalClick = this._onGlobalClick.bind(this);
    this._boundEscape = this._onEscape.bind(this);

    injectStyles();
  }

  // ---- t() helper ------------------------------------------------

  /** Return a label for the given key, falling back to built-in English. */
  _t(key) {
    if (this._i18n && typeof this._i18n.t === 'function') {
      const result = this._i18n.t(key);
      if (typeof result === 'string' && result !== key) return result;
    }
    // Try the key directly (mindmap-en.json stores flattened keys)
    if (this._i18n && this._i18n[key] !== undefined) {
      return String(this._i18n[key]);
    }
    return DEFAULT_LABELS[key] || key;
  }

  // ---- attach / detach / destroy ----------------------------------

  attach() {
    this._container.addEventListener('contextmenu', this._boundContextMenu);
    document.addEventListener('click', this._boundGlobalClick, true); // capture to close before any other handler
    document.addEventListener('keydown', this._boundEscape);
  }

  detach() {
    this._container.removeEventListener('contextmenu', this._boundContextMenu);
    document.removeEventListener('click', this._boundGlobalClick, true);
    document.removeEventListener('keydown', this._boundEscape);
    this._removeMenu();
  }

  destroy() {
    this.detach();
    this._container = null;
    this._service = null;
    this._selection = null;
    this._i18n = null;
    this._onRenderNeeded = null;
  }

  // ---- event handlers ---------------------------------------------

  /** @param {MouseEvent} e */
  _onContextMenu(e) {
    e.preventDefault();

    // Find the node element that was right-clicked.
    const nodeEl = /** @type {HTMLElement|null} */ (
      e.target.closest('[data-node-id]')
    );
    if (!nodeEl) {
      this._removeMenu();
      return;
    }

    const nodeId = nodeEl.dataset.nodeId;
    if (!nodeId) return;

    // Don't show menu during inline editing.
    if (this._selection.isEditing) return;

    // Select the node if it isn't already selected.
    if (!this._selection.selectedIds.includes(nodeId)) {
      this._selection.selectNode(nodeId);
    }

    // Determine if this is the root node.
    const isRoot = this._isRootNode(nodeId);

    // Collapsed state for dynamic label.
    const node = this._service.findNode(nodeId);
    const isCollapsed = node ? node.expanded === false : false;

    // Remove any existing menu.
    this._removeMenu();

    // Build the menu.
    const menu = this._buildMenu(nodeId, isRoot, isCollapsed);
    this._menu = menu;
    document.body.appendChild(menu);

    // Position (after DOM insertion so offset measurements work).
    positionMenu(menu, e.clientX, e.clientY);
  }

  /** Close menu on click anywhere outside it. */
  _onGlobalClick(e) {
    if (this._menu && !this._menu.contains(/** @type {Node} */ (e.target))) {
      this._removeMenu();
    }
  }

  /** Close menu on Escape. */
  _onEscape(e) {
    if (e.key === 'Escape' && this._menu) {
      this._removeMenu();
    }
  }

  // ---- helpers ----------------------------------------------------

  /** @param {string} nodeId */
  _isRootNode(nodeId) {
    const map = this._service._getMap(this._mapId);
    if (!map || !map.meta) return false;
    return map.meta.rootId === nodeId;
  }

  /**
   * Build the context menu DOM.
   * @param {string} nodeId
   * @param {boolean} isRoot
   * @param {boolean} isCollapsed
   * @returns {HTMLElement}
   */
  _buildMenu(nodeId, isRoot, isCollapsed) {
    const ul = document.createElement('ul');
    ul.className = MENU_CLASS;
    ul.setAttribute('role', 'menu');

    // Add child
    ul.appendChild(createItem(this._t('mindmap.menu.addChild'), false, () => {
      this._service.addBranch(nodeId, 'New node').then(() => this._onRenderNeeded());
      this._removeMenu();
    }));

    // Add parent — disabled for root
    ul.appendChild(createItem(this._t('mindmap.menu.addParent'), isRoot, () => {
      this._service.insertParent(nodeId).then(() => this._onRenderNeeded());
      this._removeMenu();
    }));

    // Add sibling (after) — disabled for root
    ul.appendChild(createItem(this._t('mindmap.menu.addSibling'), isRoot, () => {
      this._service.insertSibling(nodeId, 'after', 'New node').then(() => this._onRenderNeeded());
      this._removeMenu();
    }));

    // Remove node — disabled for root
    ul.appendChild(createItem(this._t('mindmap.menu.removeNode'), isRoot, () => {
      this._service.removeNode(nodeId).then(() => this._onRenderNeeded());
      this._removeMenu();
    }));

    // --- separator ---
    ul.appendChild(createSeparator());

    // Move up — disabled for root
    ul.appendChild(createItem(this._t('mindmap.menu.moveUp'), isRoot, () => {
      this._service.moveUp(nodeId).then(() => this._onRenderNeeded());
      this._removeMenu();
    }));

    // Move down — disabled for root
    ul.appendChild(createItem(this._t('mindmap.menu.moveDown'), isRoot, () => {
      this._service.moveDown(nodeId).then(() => this._onRenderNeeded());
      this._removeMenu();
    }));

    // --- separator ---
    ul.appendChild(createSeparator());

    // Collapse / Expand (dynamic label). svc.collapse(nodeId, collapsed) sets
    // node.expanded = !collapsed, so pass the current EXPANDED flag (!isCollapsed)
    // to toggle correctly (mirrors the demo's svc.collapse(nodeId, expanded)).
    const collapseLabel = isCollapsed ? 'Expand' : 'Collapse';
    ul.appendChild(createItem(collapseLabel, false, () => {
      this._service.collapse(nodeId, !isCollapsed).then(() => this._onRenderNeeded());
      this._removeMenu();
    }));

    return ul;
  }

  _removeMenu() {
    if (this._menu) {
      this._menu.remove();
      this._menu = null;
    }
  }
}
