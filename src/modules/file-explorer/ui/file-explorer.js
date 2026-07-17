/**
 * File Explorer UI — composite component with tree, toolbar, path bar, preview.
 */
import { clearChildren, createIcon, createSvgElement } from '../../../utils/dom.js';
import { FileExplorerService, formatSize, pathKey } from '../services/FileExplorerService.js';

function folderIcon() {
    return createIcon('0 0 24 24', [
        createSvgElement('path', { d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' }),
    ], { stroke: 'currentColor', 'stroke-width': 1.5 });
}
function fileIcon() {
    return createIcon('0 0 24 24', [
        createSvgElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        createSvgElement('polyline', { points: '14 2 14 8 20 8' }),
    ], { stroke: 'currentColor', 'stroke-width': 1.5 });
}
function chevronIcon(open) {
    return createSvgElement('svg', { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true', focusable: 'false', style: 'transition: transform 0.15s ease' }, [
        createSvgElement('polyline', { points: open ? '6 9 12 15 18 9' : '9 6 15 12 9 18', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    ]);
}

export function createFileExplorer(container, emit, options = {}) {
    const { localFileAccess = null, workspaceFileAccess = null, overlayManager = null, onFileOpen = null, onSelectionChange = null, maxPreviewChars = 250000, maxEntries = 500, initialState: initialData = null } = options;
    const localSupported = Boolean(localFileAccess && typeof localFileAccess.pickDirectory === 'function' && (
        typeof localFileAccess.constructor?.supportsDirectoryPicker === 'function'
            ? localFileAccess.constructor.supportsDirectoryPicker()
            : typeof window.showDirectoryPicker === 'function'
    ));
    let sourceMode = localSupported || !workspaceFileAccess ? 'local' : 'workspace';
    const initialAccess = sourceMode === 'local' ? localFileAccess : workspaceFileAccess;
    const service = new FileExplorerService(initialAccess, { maxEntries, maxPreviewChars, eventBus: null });
    if (initialData) service.setState(initialData);
    let destroyed = false;
    let filterDebounceTimer = null;
    let focusRefreshTimer = null;
    let workspaceUnsubscribe = null;
    let pendingFilterFocus = false;
    let previousSelectionKey = null;
    const unsubscribe = service.onChange(() => {
        if (destroyed) return;
        render();
        const selected = service.getSelectedEntry();
        const selectionKey = selected?.entry
            ? `${selected.entry.kind}:${[...(selected.path || []), selected.entry.name].join('/')}`
            : null;
        if (selectionKey !== previousSelectionKey) {
            previousSelectionKey = selectionKey;
            if (onSelectionChange) {
                onSelectionChange(selected?.entry || null, {
                    path: selected?.path || [],
                    selectionKey,
                });
            }
        }
    });
    let prevVisible = null;
    let prevRootHandle = null;

    const root = document.createElement('section');
    root.className = 'csma-file-explorer';
    root.setAttribute('aria-label', 'File explorer');
    const header = document.createElement('header');
    header.className = 'csma-fe-header';
    const titleEl = document.createElement('div');
    titleEl.className = 'csma-fe-title';
    titleEl.textContent = 'Files';
    const rootLabel = document.createElement('div');
    rootLabel.className = 'csma-fe-root-label';
    const toolbar = document.createElement('div');
    toolbar.className = 'csma-fe-toolbar';
    header.append(titleEl, rootLabel, toolbar);
    const breadcrumb = document.createElement('nav');
    breadcrumb.className = 'csma-fe-breadcrumb';
    breadcrumb.setAttribute('aria-label', 'Current path');
    const contentEl = document.createElement('div');
    contentEl.className = 'csma-fe-content';
    const footer = document.createElement('footer');
    footer.className = 'csma-fe-status';
    root.append(header, breadcrumb, contentEl, footer);
    container.appendChild(root);

    function createButton(label, className, onClick, opts = {}) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = className;
        btn.textContent = label;
        if (opts.disabled) btn.disabled = true;
        if (opts.title) btn.title = opts.title;
        if (onClick) btn.addEventListener('click', onClick);
        return btn;
    }
    function emitEvent(name, payload) { if (emit) emit(name, payload); }

    async function openFile(entry, entryPath, forceNewTile = false) {
        try {
            const result = await service.readFilePreview(entry, entryPath);
            if (!result) return;
            if (onFileOpen) {
                onFileOpen(entry, { fileName: entry.name, mimeType: result.mimeType, size: result.size, text: result.text, truncated: result.truncated, blobUrl: result.blobUrl || null, handleId: entry.id, path: entryPath, forceNewTile });
            }
            emitEvent('FILE_OPENED', { name: entry.name, path: entryPath, size: result.size, mimeType: result.mimeType });
        } catch (error) { service.status = error?.message || 'Failed to open file'; service._notify(); }
    }

    async function handleTreeAction(event, shiftKey = false) {
        const visible = service.buildVisibleNodes();
        const index = service.getSelectedVisibleIndex(visible);
        const node = index >= 0 ? visible[index] : null;
        if (!node) return;
        if (node.entry.kind === 'directory') { await service.toggleDirectory(node.entry, node.entryPath); return; }
        await openFile(node.entry, node.entryPath, shiftKey);
    }

    function onTreeKeyDown(event) {
        const key = event.key;
        if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'r') {
            event.preventDefault();
            event.stopPropagation();
            service.refresh();
            return;
        }
        if (key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); service.moveSelection(1); return; }
        if (key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); service.moveSelection(-1); return; }
        if (key === 'Home') { event.preventDefault(); event.stopPropagation(); const v = service.buildVisibleNodes(); if (v.length) service.selectEntry(v[0].entry, v[0].parentPath); return; }
        if (key === 'End') { event.preventDefault(); event.stopPropagation(); const v = service.buildVisibleNodes(); if (v.length) { const l = v[v.length - 1]; service.selectEntry(l.entry, l.parentPath); } return; }
        if (key === 'Enter') { event.preventDefault(); event.stopPropagation(); handleTreeAction(event, event.shiftKey); return; }
        if (key === 'ArrowRight' || key === 'ArrowLeft') {
            const visible = service.buildVisibleNodes();
            const index = service.getSelectedVisibleIndex(visible);
            const node = index >= 0 ? visible[index] : null;
            if (!node || node.entry.kind !== 'directory') return;
            const isOpen = service.expanded.has(node.entryKey);
            if ((key === 'ArrowRight' && !isOpen) || (key === 'ArrowLeft' && isOpen)) {
                event.preventDefault(); event.stopPropagation();
                service.toggleDirectory(node.entry, node.entryPath);
            }
        }
    }

    async function switchSource(nextMode) {
        if (nextMode === sourceMode) return;
        sourceMode = nextMode;
        service.setAccess(sourceMode === 'local' ? localFileAccess : workspaceFileAccess);
        prevVisible = null;
        prevRootHandle = null;
        toolbarRendered = false;
        workspaceUnsubscribe?.();
        workspaceUnsubscribe = null;
        if (sourceMode === 'workspace' && workspaceFileAccess) {
            workspaceUnsubscribe = workspaceFileAccess.subscribe?.(() => service.refresh());
            await service.openFolder();
        }
    }

    async function importWorkspaceFiles(input) {
        const files = Array.from(input.files || []);
        if (!files.length || !workspaceFileAccess?.importFiles) return;
        await workspaceFileAccess.importFiles(files);
        if (!service.rootHandle) await service.openFolder();
        else await service.refresh();
        input.value = '';
    }

    function createImportInput({ directory = false } = {}) {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.hidden = true;
        if (directory) {
            input.setAttribute('webkitdirectory', '');
            input.setAttribute('directory', '');
        }
        input.addEventListener('change', () => importWorkspaceFiles(input));
        root.append(input);
        return input;
    }

    const importFilesInput = workspaceFileAccess ? createImportInput() : null;
    const importFolderInput = workspaceFileAccess ? createImportInput({ directory: true }) : null;

    function renderToolbar() {
        clearChildren(toolbar);
        const canOpen = service.canOpenFolder();
        // Read selection at render time for initial disabled state only;
        // click handlers read fresh state from service.getSelectedEntry().
        const selectedNow = service.getSelectedEntry();
        const isFileNow = selectedNow?.entry?.kind === 'file';

        if (localSupported && workspaceFileAccess) {
            const source = document.createElement('select');
            source.className = 'csma-fe-btn csma-fe-source';
            source.setAttribute('aria-label', 'File source');
            for (const [value, label] of [['local', 'Local Project'], ['workspace', 'Workspace Files']]) {
                const option = document.createElement('option'); option.value = value; option.textContent = label; source.append(option);
            }
            source.value = sourceMode;
            source.addEventListener('change', () => switchSource(source.value));
            toolbar.append(source);
        }

        if (sourceMode === 'local') {
            toolbar.append(
                createButton('Open Folder', 'csma-fe-btn', async () => { pendingFilterFocus = true; await service.openFolder(); }, { disabled: service.loading || !canOpen, title: canOpen ? 'Grant a durable local directory handle' : 'Unavailable: this browser has no directory-handle API' }),
                createButton('Recents', 'csma-fe-btn', () => service.showRecents(), { disabled: service.loading || !canOpen, title: 'Recently opened folders' }),
            );
        } else {
            toolbar.append(
                createButton('Import Files', 'csma-fe-btn', () => importFilesInput?.click(), { disabled: service.loading }),
                createButton('Import Folder', 'csma-fe-btn', () => importFolderInput?.click(), { disabled: service.loading }),
            );
        }

        toolbar.append(
            createButton('↻', 'csma-fe-btn csma-fe-refresh', () => service.refresh(), { disabled: service.loading || !service.rootHandle, title: 'Refresh file tree (Ctrl+R)', 'aria-label': 'Refresh file tree' }),
            createButton('Open Tile', 'csma-fe-btn csma-fe-open-tile', () => {
                const s = service.getSelectedEntry();
                if (s?.entry?.kind === 'file') openFile(s.entry, s.path, false);
            }, { disabled: service.loading || !isFileNow, title: 'Open in the reusable preview tile (Enter)' }),
        );

        if (service.rootHandle || service.rootName) {
            const filterInput = document.createElement('input');
            filterInput.type = 'search';
            filterInput.className = 'csma-fe-filter';
            filterInput.placeholder = 'Filter files…';
            filterInput.value = service.filterQuery;
            filterInput.setAttribute('aria-label', 'Filter files by name');
            filterInput.addEventListener('input', () => {
                clearTimeout(filterDebounceTimer);
                filterDebounceTimer = setTimeout(() => {
                    service.setFilter(filterInput.value);
                }, 150);
            });
            filterInput.addEventListener('keydown', (e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                    clearTimeout(filterDebounceTimer);
                    filterInput.value = '';
                    service.clearFilter();
                    const tree = root.querySelector('.csma-fe-tree');
                    if (tree) tree.focus({ preventScroll: true });
                    else root.focus({ preventScroll: true });
                }
            });
            toolbar.append(filterInput);

            // Auto-focus filter when it first becomes visible
            if (pendingFilterFocus) {
                pendingFilterFocus = false;
                requestAnimationFrame(() => filterInput.focus());
            }
        }
    }

    function renderBreadcrumb() {
        clearChildren(breadcrumb);
        breadcrumb.appendChild(createButton(service.rootName || 'root', 'csma-fe-crumb', async () => { if (!service.rootHandle) return; service.path = []; service._notify(); }, { disabled: !service.rootHandle }));
        let acc = [];
        for (const segment of service.path) {
            const sep = document.createElement('span'); sep.textContent = '/'; sep.className = 'csma-fe-sep'; breadcrumb.appendChild(sep);
            acc = [...acc, segment]; const targetPath = [...acc]; const key = targetPath.join('/'); const handle = service._handlesByPath.get(key);
            breadcrumb.appendChild(createButton(segment, 'csma-fe-crumb', async () => { if (!handle) return; service.path = targetPath; service.expanded.add(key); await service._ensureDirectoryLoaded(handle, targetPath); service._notify(); }, { disabled: !handle }));
        }
    }

    function renderTree(parent) {
        if (!service.rootHandle) { renderEmpty(parent, 'No project folder open.'); return; }
        if (!service._childrenByPath.has('')) { renderEmpty(parent, 'Loading project tree…'); return; }
        // Capture focus anchor before destroying old tree
        const focusAnchor = service.selectedPath.join('/');
        const tree = document.createElement('div');
        tree.className = 'csma-fe-tree';
        tree.setAttribute('role', 'tree');
        tree.tabIndex = 0;
        tree.addEventListener('keydown', onTreeKeyDown);
        renderTreeRows(tree, [], 0);
        parent.appendChild(tree);
        // Restore focus by identity, not by activeElement (unreliable after DOM rebuild)
        if (focusAnchor) {
            const selRow = tree.querySelector(`.csma-fe-row[data-path="${focusAnchor}"]`);
            if (selRow && typeof selRow.focus === 'function') {
                selRow.focus({ preventScroll: true });
                if (typeof selRow.scrollIntoView === 'function') selRow.scrollIntoView({ block: 'nearest' });
            }
        }
        if (!focusAnchor || !tree.contains(document.activeElement)) {
            // No selection or the focused row wasn't found — focus the tree itself
            tree.focus({ preventScroll: true });
        }
    }

    function renderTreeRows(parentEl, dirPath, depth) {
        const key = dirPath.join('/');
        const kids = service._childrenByPath.get(key) || [];
        for (const entry of kids) {
            const entryPath = [...dirPath, entry.name];
            const entryKey = entryPath.join('/');
            const row = document.createElement('div');
            row.className = 'csma-fe-row';
            row.dataset.kind = entry.kind;
            row.dataset.path = entryKey;
            row.dataset.selected = String(service.selectedPath.length > 0 ? service.selectedPath.join('/') === entryKey : (service.selectedName === entry.name && service.path.join('/') === key));
            row.style.setProperty('--depth', String(depth));
            row.setAttribute('role', 'treeitem');
            row.tabIndex = -1;
            if (entry.kind === 'directory') {
                const isOpen = service.expanded.has(entryKey);
                const twisty = document.createElement('button');
                twisty.type = 'button'; twisty.className = 'csma-fe-twisty'; twisty.tabIndex = -1;
                twisty.setAttribute('aria-label', isOpen ? 'Collapse' : 'Expand');
                twisty.appendChild(chevronIcon(isOpen));
                twisty.addEventListener('click', (e) => { e.stopPropagation(); service.toggleDirectory(entry, entryPath); });
                row.appendChild(twisty);
            } else {
                const spacer = document.createElement('span'); spacer.className = 'csma-fe-twisty-spacer'; row.appendChild(spacer);
            }
            const iconWrap = document.createElement('span'); iconWrap.className = 'csma-fe-icon';
            iconWrap.appendChild(entry.kind === 'directory' ? folderIcon() : fileIcon()); row.appendChild(iconWrap);
            const label = document.createElement('span'); label.className = 'csma-fe-name'; label.textContent = entry.name; row.appendChild(label);
            const meta = document.createElement('span'); meta.className = 'csma-fe-meta'; meta.textContent = entry.kind === 'directory' ? 'dir' : formatSize(entry.size); row.appendChild(meta);
            row.addEventListener('click', () => { service.selectEntry(entry, dirPath); });
            row.addEventListener('dblclick', () => { if (entry.kind === 'directory') service.toggleDirectory(entry, entryPath); else openFile(entry, entryPath, true); });
            parentEl.appendChild(row);
            if (entry.kind === 'directory' && service.expanded.has(entryKey)) renderTreeRows(parentEl, entryPath, depth + 1);
        }
    }

    // -------------------------------------------------------------------
    // Granular tree update helpers (diff-based, avoids full rebuild)
    // -------------------------------------------------------------------

    function createRow(node) {
        const { entry, entryPath, entryKey, depth } = node;
        const row = document.createElement('div');
        row.className = 'csma-fe-row';
        row.dataset.kind = entry.kind;
        row.dataset.path = entryKey;
        row.dataset.selected = String(service.selectedPath.length > 0 ? service.selectedPath.join('/') === entryKey : (service.selectedName === entry.name && service.path.join('/') === pathKey(node.parentPath)));
        row.style.setProperty('--depth', String(depth));
        row.setAttribute('role', 'treeitem');
        row.tabIndex = -1;
        if (entry.kind === 'directory') {
            const isOpen = service.expanded.has(entryKey);
            const twisty = document.createElement('button');
            twisty.type = 'button'; twisty.className = 'csma-fe-twisty'; twisty.tabIndex = -1;
            twisty.setAttribute('aria-label', isOpen ? 'Collapse' : 'Expand');
            twisty.appendChild(chevronIcon(isOpen));
            twisty.addEventListener('click', (e) => { e.stopPropagation(); service.toggleDirectory(entry, entryPath); });
            row.appendChild(twisty);
        } else {
            const spacer = document.createElement('span'); spacer.className = 'csma-fe-twisty-spacer'; row.appendChild(spacer);
        }
        const iconWrap = document.createElement('span'); iconWrap.className = 'csma-fe-icon';
        iconWrap.appendChild(entry.kind === 'directory' ? folderIcon() : fileIcon()); row.appendChild(iconWrap);
        const label = document.createElement('span'); label.className = 'csma-fe-name'; label.textContent = entry.name; row.appendChild(label);
        const meta = document.createElement('span'); meta.className = 'csma-fe-meta'; meta.textContent = entry.kind === 'directory' ? 'dir' : formatSize(entry.size); row.appendChild(meta);
        row.addEventListener('click', () => { service.selectEntry(entry, node.parentPath); });
        row.addEventListener('dblclick', () => { if (entry.kind === 'directory') service.toggleDirectory(entry, entryPath); else openFile(entry, entryPath, true); });
        return row;
    }

    function updateRowAttrs(row, node) {
        const { entry, entryPath } = node;
        const isSelected = service.selectedPath.length > 0
            ? service.selectedPath.join('/') === entryPath.join('/')
            : (service.selectedName === entry.name && service.path.join('/') === pathKey(node.parentPath));
        row.dataset.selected = String(isSelected);
        const meta = row.querySelector('.csma-fe-meta');
        if (meta) {
            const newMeta = entry.kind === 'directory' ? 'dir' : formatSize(entry.size);
            if (meta.textContent !== newMeta) {
                meta.textContent = newMeta;
            }
        }
    }

    function restoreTreeFocus(tree) {
        const filterInput = root.querySelector('.csma-fe-filter');
        if (filterInput && document.activeElement === filterInput) return;
        const focusAnchor = service.selectedPath.join('/');
        if (focusAnchor) {
            const selRow = tree.querySelector(`.csma-fe-row[data-path="${focusAnchor}"]`);
            if (selRow && typeof selRow.focus === 'function') {
                selRow.focus({ preventScroll: true });
                if (typeof selRow.scrollIntoView === 'function') selRow.scrollIntoView({ block: 'nearest' });
                return;
            }
        }
        if (!focusAnchor || !tree.contains(document.activeElement)) {
            tree.focus({ preventScroll: true });
        }
    }

    function updateTree(parent, prevVisibleNodes, newVisible) {
        const tree = parent.querySelector('.csma-fe-tree');
        if (!tree) return;
        // Build map of existing DOM rows by data-path
        const oldMap = new Map();
        for (const row of tree.querySelectorAll('.csma-fe-row')) {
            if (row.dataset.path) oldMap.set(row.dataset.path, row);
        }
        const newKeySet = new Set(newVisible.map(n => n.entryKey));
        // Remove rows no longer visible
        for (const [key, row] of oldMap) {
            if (!newKeySet.has(key)) {
                row.remove();
                oldMap.delete(key);
            }
        }
        // Walk new visible nodes in reverse to insert before refNode
        let refNode = null;
        for (let i = newVisible.length - 1; i >= 0; i--) {
            const node = newVisible[i];
            let row = oldMap.get(node.entryKey);
            if (row) {
                oldMap.delete(node.entryKey);
                updateRowAttrs(row, node);
                if (row.nextSibling !== refNode) {
                    tree.insertBefore(row, refNode);
                }
            } else {
                row = createRow(node);
                tree.insertBefore(row, refNode);
            }
            refNode = row;
        }
        // Remove any stale rows that weren't matched
        for (const row of oldMap.values()) {
            row.remove();
        }
        restoreTreeFocus(tree);
    }

    function renderReopenState(parent) {
        const box = document.createElement('div'); box.className = 'csma-fe-empty';
        const msg = document.createElement('p'); msg.textContent = `${service.rootName || 'Folder'} — handle unavailable, click to reopen`; box.appendChild(msg);
        const btn = createButton('Reopen Folder', 'csma-fe-btn csma-fe-btn--primary csma-reopen-btn', () => service.openFolder());
        box.appendChild(btn);
        parent.appendChild(box);
        if (service.getRecentRows().length) renderRecents(parent);
    }

    function renderRecents(parent) {
        const panel = document.createElement('div'); panel.className = 'csma-fe-recents';
        const heading = document.createElement('div'); heading.className = 'csma-fe-recents-title'; heading.textContent = 'Recent project folders'; panel.appendChild(heading);
        const rows = service.getRecentRows();
        if (!rows.length) { renderEmpty(panel, 'No recent folders stored'); }
        else { for (const recent of rows) { panel.appendChild(createButton(`${recent.name || recent.id} · ${recent.kind || 'directory'}`, 'csma-fe-recent-row', () => service.openRecent(recent.id))); } }
        parent.appendChild(panel);
    }
    function renderUnsupported(parent) {
        const box = document.createElement('div'); box.className = 'csma-fe-empty';
        box.append(document.createElement('p'), document.createElement('p'));
        box.children[0].textContent = 'On-disk project access is unavailable in this browser.';
        box.children[1].textContent = 'Use Chrome/Chromium with File System Access (showDirectoryPicker).';
        parent.appendChild(box);
    }
    function renderEmpty(parent, message) {
        const el = document.createElement('div'); el.className = 'csma-fe-empty'; el.textContent = message; parent.appendChild(el);
    }

    let toolbarRendered = false, lastRootHandle = null, lastRootName = null;

    function render() {
        if (destroyed) return;
        rootLabel.textContent = service.rootName || 'No folder';
        const rootHandleChanged = service.rootHandle !== lastRootHandle;
        const rootNameChanged = service.rootName !== lastRootName;
        const rootNameAppeared = !lastRootName && service.rootName;
        const needsToolbar = !toolbarRendered || rootHandleChanged || rootNameChanged;
        if (rootNameAppeared && !service.rootHandle) {
            // Snapshot restore: rootName set but no handle — filter becomes visible, auto-focus
            pendingFilterFocus = true;
        }
        if (needsToolbar) { renderToolbar(); toolbarRendered = true; lastRootHandle = service.rootHandle; lastRootName = service.rootName; }
        if (!needsToolbar) {
            const sel = service.getSelectedEntry();
            const isFile = sel?.entry?.kind === 'file';
            const loading = service.loading;
            const otBtn = toolbar.querySelector('.csma-fe-open-tile');
            if (otBtn) otBtn.disabled = loading || !isFile;
        }
        renderBreadcrumb();
        const visible = service.buildVisibleNodes();
        const treeRootChanged = service.rootHandle !== prevRootHandle;
        const needsFullTreeRebuild = treeRootChanged || prevVisible === null;

        if (!service.canOpenFolder()) {
            clearChildren(contentEl);
            renderUnsupported(contentEl);
            prevVisible = null;
        } else if (service.rootName && !service.rootHandle && !service.loading) {
            clearChildren(contentEl);
            renderReopenState(contentEl);
            prevVisible = null;
        } else if (service.rootHandle) {
            if (needsFullTreeRebuild) {
                clearChildren(contentEl);
                renderTree(contentEl);
            } else {
                updateTree(contentEl, prevVisible, visible);
            }
        } else if (service.getRecentRows().length) {
            clearChildren(contentEl);
            renderRecents(contentEl);
            prevVisible = null;
        } else {
            clearChildren(contentEl);
            renderTree(contentEl);
            prevVisible = null;
        }

        prevVisible = visible;
        prevRootHandle = service.rootHandle;

        const sel = service.selectedName ? `${service.selectedKind}: ${service.selectedName}` : 'nothing selected';
        let statusText = service.loading ? 'Loading…' : (service.status || 'Ready');
        if (service.hasFilter()) {
            const counts = service.getFilterResultCount();
            if (counts.visible > 0) {
                statusText = `${counts.visible} matches / ${counts.total} entries`;
            } else {
                statusText = `No matches / ${counts.total} entries`;
            }
        }
        footer.textContent = `${statusText} · ${sel}`;
    }

    // Focus boundary: suppress tile-level arrow-key nav while tree or filter has focus
    let _focusActive = false;
    root.addEventListener('focusin', () => {
        if (!_focusActive) {
            _focusActive = true;
            const tileId = root.dataset.tileId;
            if (tileId) emitEvent('tile:keyboard-suppress-arrows', { tileId, active: true });
        }
    });
    root.addEventListener('focusout', () => {
        // Use microtask delay to check if focus truly left (a focusin on another
        // element within root may immediately follow the focusout on the old element)
        queueMicrotask(() => {
            if (_focusActive && !root.contains(root.ownerDocument?.activeElement)) {
                _focusActive = false;
                const tileId = root.dataset.tileId;
                if (tileId) emitEvent('tile:keyboard-suppress-arrows', { tileId, active: false });
            }
        });
    });

    const onWindowFocus = () => {
        clearTimeout(focusRefreshTimer);
        focusRefreshTimer = setTimeout(() => {
            if (!destroyed && service.rootHandle) service.refresh();
        }, 400);
    };
    window.addEventListener('focus', onWindowFocus);
    if (sourceMode === 'workspace' && workspaceFileAccess) {
        workspaceUnsubscribe = workspaceFileAccess.subscribe?.(() => service.refresh());
        queueMicrotask(() => service.openFolder());
    }

    render();

    return {
        el: root,
        update(data = {}) { service.setState(data); render(); },
        destroy() {
            destroyed = true;
            clearTimeout(focusRefreshTimer);
            window.removeEventListener('focus', onWindowFocus);
            workspaceUnsubscribe?.();
            unsubscribe(); service.revokeBlobUrls();
            service._destroyed = true; service._listeners.clear();
            clearChildren(root); if (root.parentNode) root.parentNode.removeChild(root);
        },
        focus() { const tree = root.querySelector('.csma-fe-tree'); if (tree) tree.focus({ preventScroll: true }); else root.focus({ preventScroll: true }); },
        getSelected() { return service.getSelectedEntry(); },
        getState() { return service.getState(); },
        getService() { return service; },
    };
}
