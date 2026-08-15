// demo/mindmap.js — module script externalized from demo/mindmap.html
// so the page can ship a strict CSP (script-src 'self'). Content moved verbatim.

import { MindmapService } from '/src/modules/mindmap/services/MindmapService.js';
import { HistoryService } from '/src/modules/history/services/HistoryService.js';
import { applyStoredTheme, registerThemeToggle } from '/src/style/theme/theme-manager.js';

// EventBus stub - must expose subscribe/publish (names MindmapService expects)
const bus = { _s: new Map(),
  subscribe(n,fn) { if(!this._s.has(n))this._s.set(n,[]); this._s.get(n).push(fn); },
  unsubscribe() {},
  publish(n,p) { (this._s.get(n)||[]).forEach(fn=>fn(p)); }
};
const mem = { init:async()=>{}, getAll:async()=>[], put:async()=>{}, clear:async()=>{} };
const history = new HistoryService(bus);
await history.init({ store: mem });
const svc = new MindmapService(bus);
svc.init({ storage: null, history });

const canvas = document.getElementById('canvas');
const statusEl = document.getElementById('status');
const mapSelect = document.getElementById('map-select');
let activeMap = null;
let surface = null;
function status(m) { statusEl.textContent = m; }

// CSMA theme toggle - cycles light / dark / contrast, persists to localStorage
applyStoredTheme();
const themeToggleBtn = document.querySelector('[data-theme-toggle]');
if (themeToggleBtn) {
  const themeLabel = themeToggleBtn.querySelector('[data-theme-label]');
  const syncLabel = (theme) => { if (themeLabel) themeLabel.textContent = `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`; };
  syncLabel(document.documentElement.getAttribute('data-theme') || 'light');
  registerThemeToggle(themeToggleBtn, ({ theme, next }) => {
    themeToggleBtn.dataset.themeActive = theme;
    themeToggleBtn.setAttribute('aria-label', `Switch to ${next} theme`);
    syncLabel(theme);
  });
}

// All rendering + interaction handlers live inside mountSurface (Wave 2).
// The demo is a thin harness: it owns map data/seed and the status line.
function mountMap(id) {
  if (surface) surface(); // cleanup previous surface
  surface = svc.mountSurface('mindmap-canvas', canvas, { mapId: id });
}

async function refreshMapList() {
  const maps = await svc.listMaps();
  mapSelect.replaceChildren();
  for (const m of maps) {
    const o = document.createElement('option');
    o.value = m.id; o.textContent = m.name;
    mapSelect.appendChild(o);
  }
  if (activeMap) mapSelect.value = activeMap;
}

document.getElementById('new-map').onclick = async () => {
  activeMap = await svc.createMap(`Map ${Date.now() % 1000}`);
  await refreshMapList();
  mapSelect.value = activeMap;
  mountMap(activeMap);
  status('new map');
};
mapSelect.onchange = () => {
  activeMap = mapSelect.value;
  mountMap(activeMap);
  status('switched map');
};
document.getElementById('undo-btn').onclick = async () => {
  await svc.undo();
  if (surface) surface.render();
  status('undo');
};
document.getElementById('redo-btn').onclick = async () => {
  await svc.redo();
  if (surface) surface.render();
  status('redo');
};
document.getElementById('md-btn').onclick = () => { status(svc.toMarkdown(activeMap) || '(empty)'); };

// ─── Seed ────────────────────────────────────────────────────
activeMap = await svc.createMap('Sample map');
await svc.setLayoutDirection(2); // side layout: children on both left and right
const r = svc._getMap(activeMap).root;
const b1 = await svc.addBranch(r.id, 'e2e-test', { tag: 'phase' });
await svc.addLeaf(b1.id, 'init + plan verified');
await svc.addLeaf(b1.id, 'scout: recon');
const b2 = await svc.addBranch(r.id, 'docs', { tag: 'module' });
await svc.addLeaf(b2.id, 'write readme');
const b3 = await svc.addBranch(r.id, 'ui', { tag: 'feature' });
await svc.addLeaf(b3.id, 'selection');
await svc.addLeaf(b3.id, 'keyboard');
await refreshMapList();
mountMap(activeMap);
status('ready - click nodes, double-click to edit, drag to move, right-click for menu, arrow keys to navigate; toolbar: zoom / fit / layout / fullscreen');
