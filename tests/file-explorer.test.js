// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { FileExplorerService } from '../src/modules/file-explorer/services/FileExplorerService.js';
import { FileExplorerContracts } from '../src/modules/file-explorer/contracts/file-explorer-contracts.js';
import { createFileExplorer } from '../src/modules/file-explorer/ui/file-explorer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class MockEventBus {
    constructor() {
        this.published = vi.fn();
    }
    publish(name, payload) {
        this.published(name, payload);
    }
}

function makeFakeFileHandle(name = 'note.md', content = 'hello world', type = 'text/markdown') {
    return {
        kind: 'file',
        name,
        getFile: vi.fn(async () => new File([content], name, { type })),
        queryPermission: vi.fn(async () => 'granted'),
        requestPermission: vi.fn(async () => 'granted'),
    };
}

function makeFakeImageHandle(name = 'photo.png') {
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    return {
        kind: 'file',
        name,
        getFile: vi.fn(async () => new File([blob], name, { type: 'image/png' })),
        queryPermission: vi.fn(async () => 'granted'),
        requestPermission: vi.fn(async () => 'granted'),
    };
}

function makeFakeDirectoryHandle(name = 'project', entries = []) {
    return {
        kind: 'directory',
        name,
        entries: vi.fn(async function* () {
            for (const [childName, handle] of entries) {
                yield [childName, handle];
            }
        }),
        queryPermission: vi.fn(async () => 'granted'),
        requestPermission: vi.fn(async () => 'granted'),
    };
}

/**
 * Build a fake LocalFileAccessService that supports directory picking.
 */
function makeSupportedLocalAccess(rootHandle = null, listing = null) {
    const handle = rootHandle || makeFakeDirectoryHandle('project', [
        ['src', makeFakeDirectoryHandle('src', [
            ['main.js', makeFakeFileHandle('main.js', 'console.log(1)', 'text/javascript')],
        ])],
        ['notes.txt', makeFakeFileHandle('notes.txt', 'hello', 'text/plain')],
    ]);

    const rootEntry = {
        id: 'directory:project',
        name: 'project',
        kind: 'directory',
        handle,
        permission: 'granted',
    };

    const local = {
        constructor: { supportsDirectoryPicker: () => true },
        pickDirectory: vi.fn(async () => rootEntry),
        saveRecentHandle: vi.fn(async () => {}),
        listDirectory: vi.fn(async (dirHandle) => {
            if (listing) return listing;
            // Enumerate children from the passed handle, not just root
            const entries = [];
            const target = dirHandle || handle;
            for await (const [name, childHandle] of target.entries()) {
                entries.push({
                    id: `${childHandle.kind}:${name}`,
                    name,
                    kind: childHandle.kind,
                    handle: childHandle,
                    size: childHandle.kind === 'file' ? 100 : null,
                    mimeType: childHandle.kind === 'file' ? 'text/plain' : '',
                });
            }
            return { rootId: 'directory:project', path: [], entries, truncated: false };
        }),
        readFile: vi.fn(async (fileHandle) => {
            const file = await fileHandle.getFile();
            return {
                id: `file:${fileHandle.name}`,
                name: fileHandle.name,
                kind: 'file',
                size: file.size,
                mimeType: file.type || 'application/octet-stream',
                blob: file,
            };
        }),
        listRecentHandles: vi.fn(async () => []),
        getRecentHandle: vi.fn(async () => null),
        removeRecentHandle: vi.fn(async () => {}),
    };

    return { local, rootEntry, rootHandle: handle };
}

function flushMicrotasks(ticks = 10) {
    let p = Promise.resolve();
    for (let i = 0; i < ticks; i++) {
        p = p.then(() => Promise.resolve());
    }
    return p;
}

// ---------------------------------------------------------------------------
// Service Tests
// ---------------------------------------------------------------------------

describe('FileExplorerService', () => {
    let service;
    let localAccess;

    beforeEach(() => {
        const { local } = makeSupportedLocalAccess();
        localAccess = local;
        service = new FileExplorerService(localAccess, { eventBus: new MockEventBus() });
    });

    afterEach(() => {
        service.destroy();
        vi.restoreAllMocks();
    });

    // =======================================================================
    // Capability detection
    // =======================================================================

    describe('canOpenFolder / pickerMode', () => {
        it('returns fsa when local has pickDirectory and supportsDirectoryPicker', () => {
            expect(service.pickerMode()).toBe('fsa');
            expect(service.canOpenFolder()).toBe(true);
        });

        it('returns none when local has no pickDirectory', () => {
            service.local = {};
            expect(service.pickerMode()).toBe('none');
            expect(service.canOpenFolder()).toBe(false);
        });

        it('returns none when supportsDirectoryPicker is false', () => {
            service.local = {
                pickDirectory: vi.fn(),
                constructor: { supportsDirectoryPicker: () => false },
            };
            expect(service.pickerMode()).toBe('none');
        });
    });

    // =======================================================================
    // openFolder
    // =======================================================================

    describe('openFolder', () => {
        it('opens a folder, stores recent, and loads root listing', async () => {
            const entry = await service.openFolder();

            expect(entry).not.toBeNull();
            expect(localAccess.pickDirectory).toHaveBeenCalledWith({ mode: 'read' });
            expect(localAccess.saveRecentHandle).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'directory:project' }),
                { appId: 'file-explorer', tags: ['root', 'project'] },
            );
            expect(service.rootName).toBe('project');
            expect(service.rootId).toBe('directory:project');
            expect(service._childrenByPath.has('')).toBe(true);
            expect(service._childrenByPath.get('')).toHaveLength(2);
        });

        it('returns null when user cancels pickDirectory', async () => {
            localAccess.pickDirectory = vi.fn(async () => null);
            const result = await service.openFolder();
            expect(result).toBeNull();
            expect(service.rootHandle).toBeNull();
        });

        it('returns null when canOpenFolder is false', async () => {
            service.local = {};
            const result = await service.openFolder();
            expect(result).toBeNull();
        });
    });

    // =======================================================================
    // toggleDirectory (expand / collapse with selection stickiness)
    // =======================================================================

    describe('toggleDirectory', () => {
        it('expands a directory and loads children', async () => {
            await service.openFolder();
            const srcEntry = service._childrenByPath.get('').find((e) => e.name === 'src');

            await service.toggleDirectory(srcEntry, ['src']);

            expect(service.expanded.has('src')).toBe(true);
            expect(service._childrenByPath.has('src')).toBe(true);
            expect(service._childrenByPath.get('src')).toHaveLength(1);
        });

        it('keeps selection on the folder being expanded', async () => {
            await service.openFolder();
            const srcEntry = service._childrenByPath.get('').find((e) => e.name === 'src');

            await service.toggleDirectory(srcEntry, ['src']);

            expect(service.selectedName).toBe('src');
            expect(service.selectedKind).toBe('directory');
            expect(service.selectedPath).toEqual(['src']);
        });

        it('collapses an expanded directory', async () => {
            await service.openFolder();
            const srcEntry = service._childrenByPath.get('').find((e) => e.name === 'src');

            await service.toggleDirectory(srcEntry, ['src']);
            expect(service.expanded.has('src')).toBe(true);

            await service.toggleDirectory(srcEntry, ['src']);
            expect(service.expanded.has('src')).toBe(false);
        });
    });

    // =======================================================================
    // buildVisibleNodes / moveSelection / getSelectedVisibleIndex
    // =======================================================================

    describe('buildVisibleNodes', () => {
        it('returns flat list of visible entries at root', async () => {
            await service.openFolder();
            const nodes = service.buildVisibleNodes();
            expect(nodes).toHaveLength(2);
            expect(nodes[0].entry.name).toBe('src');
            expect(nodes[1].entry.name).toBe('notes.txt');
        });

        it('includes children of expanded directories', async () => {
            await service.openFolder();
            const srcEntry = service._childrenByPath.get('').find((e) => e.name === 'src');
            await service.toggleDirectory(srcEntry, ['src']);

            const nodes = service.buildVisibleNodes();
            expect(nodes).toHaveLength(3);
            expect(nodes[0].entry.name).toBe('src');
            expect(nodes[1].entry.name).toBe('main.js');
            expect(nodes[2].entry.name).toBe('notes.txt');
        });
    });

    describe('moveSelection', () => {
        it('moves selection down through visible nodes', async () => {
            await service.openFolder();
            service.selectEntry(
                service._childrenByPath.get('')[0],
                [],
            );

            service.moveSelection(1);

            expect(service.selectedName).toBe('notes.txt');
        });

        it('moves selection into expanded directory children', async () => {
            await service.openFolder();
            const srcEntry = service._childrenByPath.get('').find((e) => e.name === 'src');
            await service.toggleDirectory(srcEntry, ['src']);

            // Selection is on src after expand; move down should enter children
            service.moveSelection(1);

            expect(service.selectedName).toBe('main.js');
        });

        it('clamps at last visible node', async () => {
            await service.openFolder();
            const nodes = service.buildVisibleNodes();
            service.selectEntry(nodes[nodes.length - 1].entry, nodes[nodes.length - 1].parentPath);

            service.moveSelection(1);

            const newNodes = service.buildVisibleNodes();
            expect(service.selectedName).toBe(newNodes[newNodes.length - 1].entry.name);
        });
    });

    // =======================================================================
    // selectEntry / getSelectedEntry
    // =======================================================================

    describe('selectEntry', () => {
        it('sets selection with full path identity', async () => {
            await service.openFolder();
            const entry = service._childrenByPath.get('').find((e) => e.name === 'notes.txt');

            service.selectEntry(entry, []);

            expect(service.selectedName).toBe('notes.txt');
            expect(service.selectedKind).toBe('file');
            expect(service.selectedPath).toEqual(['notes.txt']);
        });
    });

    describe('getSelectedEntry', () => {
        it('returns null when nothing is selected', async () => {
            await service.openFolder();
            expect(service.getSelectedEntry()).toBeNull();
        });

        it('returns the selected entry and path', async () => {
            await service.openFolder();
            const entry = service._childrenByPath.get('').find((e) => e.name === 'src');
            service.selectEntry(entry, []);

            const result = service.getSelectedEntry();
            expect(result).not.toBeNull();
            expect(result.entry.name).toBe('src');
            expect(result.path).toEqual(['src']);
        });
    });

    // =======================================================================
    // readFilePreview
    // =======================================================================

    describe('readFilePreview', () => {
        it('reads text files and returns text content', async () => {
            await service.openFolder();
            const notesEntry = service._childrenByPath.get('').find((e) => e.name === 'notes.txt');

            const payload = await service.readFilePreview(notesEntry, ['notes.txt']);

            expect(payload.fileName).toBe('notes.txt');
            expect(payload.text).toBe('hello');
            expect(payload.truncated).toBe(false);
            expect(payload.blobUrl).toBeNull();
        });

        it('truncates text longer than maxPreviewChars', async () => {
            const longContent = 'x'.repeat(300_000);
            const fileHandle = makeFakeFileHandle('big.txt', longContent, 'text/plain');
            service.local.readFile = vi.fn(async () => ({
                id: 'file:big.txt',
                name: 'big.txt',
                kind: 'file',
                size: longContent.length,
                mimeType: 'text/plain',
                blob: new Blob([longContent], { type: 'text/plain' }),
            }));

            const entry = { name: 'big.txt', kind: 'file', id: 'file:big.txt', handle: fileHandle };
            const payload = await service.readFilePreview(entry, ['big.txt']);

            expect(payload.truncated).toBe(true);
            expect(payload.text.length).toBe(250_000);
        });

        it('returns blobUrl for image files', async () => {
            const imgHandle = makeFakeImageHandle('photo.png');
            service.local.readFile = vi.fn(async () => {
                const file = await imgHandle.getFile();
                return {
                    id: 'file:photo.png',
                    name: 'photo.png',
                    kind: 'file',
                    size: file.size,
                    mimeType: 'image/png',
                    blob: file,
                };
            });

            const entry = { name: 'photo.png', kind: 'file', id: 'file:photo.png', handle: imgHandle };
            const payload = await service.readFilePreview(entry, ['photo.png']);

            expect(payload.text).toBeNull();
            expect(payload.blobUrl).toBeTruthy();
            expect(payload.mimeType).toBe('image/png');

            // Cleanup
            if (payload.blobUrl) URL.revokeObjectURL(payload.blobUrl);
        });
    });

    // =======================================================================
    // State serialization
    // =======================================================================

    describe('getState / setState', () => {
        it('produces JSON-safe state', async () => {
            await service.openFolder();
            const state = service.getState();

            expect(() => JSON.stringify(state)).not.toThrow();
            expect(state.rootId).toBe('directory:project');
            expect(state.rootName).toBe('project');
            expect(Array.isArray(state.expanded)).toBe(true);
            expect(Array.isArray(state.path)).toBe(true);
        });

        it('round-trips through setState', async () => {
            await service.openFolder();
            const srcEntry = service._childrenByPath.get('').find((e) => e.name === 'src');
            await service.toggleDirectory(srcEntry, ['src']);

            const state = service.getState();
            service.destroy();

            const newService = new FileExplorerService(localAccess);
            newService.setState(state);

            expect(newService.rootId).toBe('directory:project');
            expect(newService.rootName).toBe('project');
            expect(newService.expanded.has('src')).toBe(true);
        });
    });

    // =======================================================================
    // onChange observable
    // =======================================================================

    describe('onChange', () => {
        it('notifies listeners on state changes', async () => {
            const listener = vi.fn();
            service.onChange(listener);

            await service.openFolder();

            expect(listener).toHaveBeenCalled();
        });

        it('returns unsubscribe function', () => {
            const listener = vi.fn();
            const unsubscribe = service.onChange(listener);

            expect(typeof unsubscribe).toBe('function');
            unsubscribe();
        });
    });

    // =======================================================================
    // Recents
    // =======================================================================

    describe('showRecents', () => {
        it('loads recent handles from localFileAccess', async () => {
            localAccess.listRecentHandles = vi.fn(async () => [
                { id: 'dir:foo', name: 'foo', kind: 'directory' },
            ]);

            const rows = await service.showRecents();

            expect(rows).toHaveLength(1);
            expect(rows[0].name).toBe('foo');
            expect(service.recentIds).toContain('dir:foo');
        });

        it('returns empty when pickerMode is not fsa', async () => {
            service.local = {};
            const rows = await service.showRecents();
            expect(rows).toEqual([]);
        });
    });
});

// ---------------------------------------------------------------------------
// UI Component Tests
// ---------------------------------------------------------------------------

describe('createFileExplorer (UI)', () => {
    let container;
    let localAccess;
    let overlayManager;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        const { local } = makeSupportedLocalAccess();
        localAccess = local;

        overlayManager = {
            openModal: vi.fn(() => ({ close: vi.fn() })),
        };
    });

    afterEach(() => {
        container.remove();
        vi.restoreAllMocks();
    });

    it('renders toolbar with Open Folder button', () => {
        createFileExplorer(container, null, { localFileAccess: localAccess });

        const buttons = container.querySelectorAll('button');
        const labels = [...buttons].map((b) => b.textContent);
        expect(labels).toContain('Open Folder');
    });

    it('renders unsupported message when FSA is unavailable', () => {
        createFileExplorer(container, null, { localFileAccess: {} });

        expect(container.textContent).toMatch(/unavailable/i);
    });

    it('opens a folder and renders tree rows on Open Folder click', async () => {
        createFileExplorer(container, null, { localFileAccess: localAccess });

        const openBtn = [...container.querySelectorAll('button')]
            .find((b) => b.textContent === 'Open Folder');
        openBtn.click();
        await flushMicrotasks(20);

        const rows = container.querySelectorAll('.csma-fe-row');
        expect(rows.length).toBe(2);
        const names = [...rows].map((r) => r.querySelector('.csma-fe-name').textContent);
        expect(names).toContain('src');
        expect(names).toContain('notes.txt');
    });

    it('supports keyboard ArrowDown to move selection', async () => {
        createFileExplorer(container, null, { localFileAccess: localAccess });

        const openBtn = [...container.querySelectorAll('button')]
            .find((b) => b.textContent === 'Open Folder');
        openBtn.click();
        await flushMicrotasks(20);

        const tree = container.querySelector('.csma-fe-tree');
        tree.focus();

        tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushMicrotasks();

        const selectedRow = container.querySelector('.csma-fe-row[data-selected="true"]');
        expect(selectedRow).toBeTruthy();
        expect(selectedRow.querySelector('.csma-fe-name').textContent).toBe('src');
    });

    it('keeps selection on folder after expand via ArrowRight', async () => {
        createFileExplorer(container, null, { localFileAccess: localAccess });

        const openBtn = [...container.querySelectorAll('button')]
            .find((b) => b.textContent === 'Open Folder');
        openBtn.click();
        await flushMicrotasks(20);

        const tree = container.querySelector('.csma-fe-tree');
        tree.focus();

        // Select src
        tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushMicrotasks();

        // Expand
        tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await flushMicrotasks(20);

        const selectedRow = container.querySelector('.csma-fe-row[data-selected="true"]');
        expect(selectedRow).toBeTruthy();
        expect(selectedRow.querySelector('.csma-fe-name').textContent).toBe('src');
    });

    it('ArrowDown after expand enters children', async () => {
        createFileExplorer(container, null, { localFileAccess: localAccess });

        const openBtn = [...container.querySelectorAll('button')]
            .find((b) => b.textContent === 'Open Folder');
        openBtn.click();
        await flushMicrotasks(20);

        const tree = container.querySelector('.csma-fe-tree');
        tree.focus();

        // Select src
        tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushMicrotasks();

        // Expand
        tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        await flushMicrotasks(20);

        // Re-query tree after expand (render rebuilds DOM)
        const treeAfter = container.querySelector('.csma-fe-tree');
        // Move down — should select main.js
        treeAfter.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        const selectedRow = container.querySelector('.csma-fe-row[data-selected="true"]');
        expect(selectedRow).toBeTruthy();
        expect(selectedRow.querySelector('.csma-fe-name').textContent).toBe('main.js');
    });

    it('calls onFileOpen when Open Tile button is clicked', async () => {
        const onFileOpen = vi.fn();
        createFileExplorer(container, null, {
            localFileAccess: localAccess,
            onFileOpen,
        });

        const openBtn = [...container.querySelectorAll('button')]
            .find((b) => b.textContent === 'Open Folder');
        openBtn.click();
        await flushMicrotasks(20);

        // Select notes.txt (second row) — each ArrowDown triggers render,
        // so re-query the tree element after each dispatch.
        const tree = container.querySelector('.csma-fe-tree');
        tree.focus();
        tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushMicrotasks();
        const tree2 = container.querySelector('.csma-fe-tree');
        tree2.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushMicrotasks();
        // Click Open Tile
        const openTileBtn = [...container.querySelectorAll('button')]
            .find((b) => b.textContent === 'Open Tile');
        openTileBtn.click();
        await flushMicrotasks(10);

        expect(onFileOpen).toHaveBeenCalled();
        expect(onFileOpen.mock.calls[0][0].name).toBe('notes.txt');
    });

    it('Enter key triggers onFileOpen callback', async () => {
        const onFileOpen = vi.fn();
        createFileExplorer(container, null, {
            localFileAccess: localAccess,
            onFileOpen,
        });

        const openBtn = [...container.querySelectorAll('button')]
            .find((b) => b.textContent === 'Open Folder');
        openBtn.click();
        await flushMicrotasks(20);

        // Select notes.txt
        const tree = container.querySelector('.csma-fe-tree');
        tree.focus();
        tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushMicrotasks();
        tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await flushMicrotasks();

        // Enter on file triggers openFile -> onFileOpen
        tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await flushMicrotasks(10);

        expect(onFileOpen).toHaveBeenCalled();
    });

    it('destroy removes DOM and cleans up', async () => {
        const explorer = createFileExplorer(container, null, {
            localFileAccess: localAccess,
        });

        await explorer.destroy();

        expect(container.children.length).toBe(0);
    });

    it('getState returns JSON-safe serializable state', async () => {
        const explorer = createFileExplorer(container, null, {
            localFileAccess: localAccess,
        });

        const openBtn = [...container.querySelectorAll('button')]
            .find((b) => b.textContent === 'Open Folder');
        openBtn.click();
        await flushMicrotasks(20);

        const state = explorer.getState();
        expect(() => JSON.stringify(state)).not.toThrow();
        expect(state.rootName).toBe('project');
    });
});

// ---------------------------------------------------------------------------
// Contract Tests
// ---------------------------------------------------------------------------

describe('FileExplorerContracts', () => {
    it('defines all expected contract names', () => {
        const names = Object.keys(FileExplorerContracts);
        expect(names).toContain('DIRECTORY_OPENED');
        expect(names).toContain('DIRECTORY_EXPANDED');
        expect(names).toContain('DIRECTORY_COLLAPSED');
        expect(names).toContain('SELECTION_CHANGED');
        expect(names).toContain('FILE_OPENED');
        expect(names).toContain('FILE_EXPLORER_ERROR');
    });

    it('all contracts have version, type, and owner', () => {
        for (const [name, contract] of Object.entries(FileExplorerContracts)) {
            expect(contract.version).toBeDefined();
            expect(contract.type).toBeDefined();
            expect(contract.owner).toBe('file-explorer');
            expect(contract.description).toBeDefined();
        }
    });
});
