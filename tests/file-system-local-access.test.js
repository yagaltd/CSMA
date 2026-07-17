// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { LocalFileAccessService } from '../src/modules/file-system/services/LocalFileAccess.js';
import { EventBus } from '../src/runtime/EventBus.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class MockEventBus {
    constructor() {
        this.publish = vi.fn();
    }
}

/**
 * Build a fake FileSystemFileHandle.
 * Each method is a vi.fn() so tests can inspect calls and override behaviour
 * without re-declaring the object.
 */
function makeFakeFileHandle(name = 'note.md', content = 'hello', type = 'text/markdown') {
    return {
        kind: 'file',
        name,
        getFile: vi.fn(async () => new File([content], name, { type })),
        queryPermission: vi.fn(async (opts) => {
            // Simulate a handle that always reports it's granted for read,
            // and also granted for readwrite (mutable file in granted dir).
            return 'granted';
        }),
        requestPermission: vi.fn(async () => 'granted'),
        createWritable: vi.fn(async () => {
            let closed = false;
            let aborted = false;
            return {
                write: vi.fn(async () => {}),
                close: vi.fn(async () => { closed = true; }),
                abort: vi.fn(async () => { aborted = true; }),
                _closed: () => closed,
                _aborted: () => aborted,
            };
        }),
    };
}

/**
 * Build a fake FileSystemDirectoryHandle with a given list of child entries.
 * Each entry is [name, handle] — order is preserved, so tests can assert
 * that sorting happens.
 */
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
 * A FileSystemFileHandle whose queryPermission returns 'denied' for
 * readwrite — used to test write-permission gating.
 */
function makeReadOnlyFileHandle(name = 'readonly.md') {
    const h = makeFakeFileHandle(name);
    h.queryPermission = vi.fn(async (opts) => {
        if (opts && opts.mode === 'readwrite') return 'prompt';
        return 'granted';
    });
    h.requestPermission = vi.fn(async () => 'prompt');
    return h;
}

/**
 * Install the minimal globals that make `isSupported()` return true.
 */
function installSupportedGlobals() {
    window.showOpenFilePicker = vi.fn();
    window.showDirectoryPicker = vi.fn();
}

function clearPickerGlobals() {
    delete window.showOpenFilePicker;
    delete window.showDirectoryPicker;
    delete window.showSaveFilePicker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LocalFileAccessService', () => {
    let eventBus;
    let service;

    beforeEach(() => {
        eventBus = new MockEventBus();
        service = new LocalFileAccessService(eventBus);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        clearPickerGlobals();
    });

    // =======================================================================
    // Capability detection
    // =======================================================================

    describe('isSupported', () => {
        it('returns false when showOpenFilePicker is missing', () => {
            window.showOpenFilePicker = undefined;
            window.showDirectoryPicker = vi.fn();

            expect(LocalFileAccessService.isSupported()).toBe(false);
        });

        it('returns false when showDirectoryPicker is missing', () => {
            window.showOpenFilePicker = vi.fn();
            window.showDirectoryPicker = undefined;

            expect(LocalFileAccessService.isSupported()).toBe(false);
        });

        it('returns true when both picker APIs are present', () => {
            installSupportedGlobals();

            expect(LocalFileAccessService.isSupported()).toBe(true);
        });

        it('instance method delegates to static', () => {
            installSupportedGlobals();
            expect(service.isSupported()).toBe(true);

            clearPickerGlobals();
            expect(service.isSupported()).toBe(false);
        });
    });

    describe('granular picker support', () => {
        it('allows pickFiles when only showOpenFilePicker exists', async () => {
            const handle = makeFakeFileHandle('open-only.txt');
            window.showOpenFilePicker = vi.fn().mockResolvedValue([handle]);
            window.showDirectoryPicker = undefined;

            const result = await service.pickFiles();

            expect(result[0].name).toBe('open-only.txt');
        });

        it('allows pickDirectory when only showDirectoryPicker exists', async () => {
            const handle = makeFakeDirectoryHandle('dir-only');
            window.showOpenFilePicker = undefined;
            window.showDirectoryPicker = vi.fn().mockResolvedValue(handle);

            const result = await service.pickDirectory();

            expect(result.name).toBe('dir-only');
        });
    });

    // =======================================================================
    // Picker wrappers
    // =======================================================================

    describe('pickFiles', () => {
        it('returns empty array when user cancels (AbortError)', async () => {
            installSupportedGlobals();
            const abort = new DOMException('The user aborted a request.', 'AbortError');
            window.showOpenFilePicker.mockRejectedValue(abort);

            const result = await service.pickFiles();

            expect(result).toEqual([]);
        });

        it('returns normalized entries on success', async () => {
            installSupportedGlobals();
            const fileHandle = makeFakeFileHandle('readme.md', '# Hello', 'text/markdown');
            window.showOpenFilePicker.mockResolvedValue([fileHandle]);

            const result = await service.pickFiles();

            expect(result).toHaveLength(1);
            const entry = result[0];
            expect(entry.id).toBe('file:readme.md');
            expect(entry.name).toBe('readme.md');
            expect(entry.kind).toBe('file');
            expect(entry.handle).toBe(fileHandle);
            expect(entry.path).toEqual(['readme.md']);
            expect(entry.permission).toBe('granted');
            expect(entry.writable).toBe(true);
            expect(entry.lastSeenAt).toBeGreaterThan(0);

            // Verify picker options forwarded
            expect(window.showOpenFilePicker).toHaveBeenCalledWith({});
        });

        it('forwards multiple and types to showOpenFilePicker', async () => {
            installSupportedGlobals();
            const handle = makeFakeFileHandle('img.png', '', 'image/png');
            window.showOpenFilePicker.mockResolvedValue([handle]);

            await service.pickFiles({
                multiple: true,
                types: [{ description: 'Images', accept: { 'image/png': ['.png'] } }],
            });

            expect(window.showOpenFilePicker).toHaveBeenCalledWith({
                multiple: true,
                types: [{ description: 'Images', accept: { 'image/png': ['.png'] } }],
            });
        });

        it('publishes LOCAL_FILE_PICKED on success', async () => {
            installSupportedGlobals();
            window.showOpenFilePicker.mockResolvedValue([
                makeFakeFileHandle('a.js', '', 'text/javascript'),
            ]);

            await service.pickFiles({
                types: [{ description: 'JS', accept: { 'text/javascript': ['.js'] } }],
            });

            expect(eventBus.publish).toHaveBeenCalledWith(
                'LOCAL_FILE_PICKED',
                expect.objectContaining({
                    count: 1,
                    types: ['text/javascript'],
                }),
            );
        });

        it('re-throws non-AbortError failures', async () => {
            installSupportedGlobals();
            const perm = new DOMException('Permission denied', 'NotAllowedError');
            window.showOpenFilePicker.mockRejectedValue(perm);

            await expect(service.pickFiles()).rejects.toThrow('Permission denied');
        });
    });

    describe('pickDirectory', () => {
        it('returns null when user cancels (AbortError)', async () => {
            installSupportedGlobals();
            window.showDirectoryPicker.mockRejectedValue(
                new DOMException('The user aborted a request.', 'AbortError'),
            );

            const result = await service.pickDirectory();

            expect(result).toBeNull();
        });

        it('returns normalized entry on success', async () => {
            installSupportedGlobals();
            const dirHandle = makeFakeDirectoryHandle('src');
            window.showDirectoryPicker.mockResolvedValue(dirHandle);

            const result = await service.pickDirectory();

            expect(result.id).toBe('directory:src');
            expect(result.name).toBe('src');
            expect(result.kind).toBe('directory');
            expect(result.handle).toBe(dirHandle);
            expect(result.path).toEqual(['src']);
            expect(result.permission).toBe('granted');
            // Directories are never writable
            expect(result.writable).toBe(false);

            expect(window.showDirectoryPicker).toHaveBeenCalledWith({ mode: 'read' });
        });

        it('respects readwrite mode option', async () => {
            installSupportedGlobals();
            window.showDirectoryPicker.mockResolvedValue(makeFakeDirectoryHandle('out'));

            await service.pickDirectory({ mode: 'readwrite' });

            expect(window.showDirectoryPicker).toHaveBeenCalledWith({ mode: 'readwrite' });
        });

        it('publishes LOCAL_DIRECTORY_PICKED on success', async () => {
            installSupportedGlobals();
            window.showDirectoryPicker.mockResolvedValue(makeFakeDirectoryHandle('data'));

            await service.pickDirectory();

            expect(eventBus.publish).toHaveBeenCalledWith(
                'LOCAL_DIRECTORY_PICKED',
                expect.objectContaining({
                    rootId: 'directory:data',
                    name: 'data',
                    permission: 'granted',
                }),
            );
        });
    });

    // =======================================================================
    // Permission management
    // =======================================================================

    describe('queryPermission', () => {
        it("returns 'granted' for a handle that reports granted", async () => {
            const handle = makeFakeFileHandle();

            const result = await service.queryPermission(handle, { mode: 'read' });

            expect(result).toBe('granted');
            expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
        });

        it("returns 'denied' for a handle without queryPermission", async () => {
            const result = await service.queryPermission({ kind: 'file', name: 'bare.md' });

            expect(result).toBe('denied');
        });

        it("returns 'denied' for null / undefined handle", async () => {
            expect(await service.queryPermission(null)).toBe('denied');
            expect(await service.queryPermission(undefined)).toBe('denied');
        });

        it("falls back to 'denied' when queryPermission throws", async () => {
            const handle = makeFakeFileHandle();
            handle.queryPermission.mockRejectedValue(new Error('boom'));

            const result = await service.queryPermission(handle);

            expect(result).toBe('denied');
        });

        it('defaults mode to read when not specified', async () => {
            const handle = makeFakeFileHandle();

            await service.queryPermission(handle);

            expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
        });
    });

    describe('requestPermission', () => {
        it("returns 'granted' when handle reports granted", async () => {
            const handle = makeFakeFileHandle();

            const result = await service.requestPermission(handle);

            expect(result).toBe('granted');
            expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'read' });
        });

        it("returns 'denied' for a handle without requestPermission", async () => {
            const result = await service.requestPermission({ kind: 'file', name: 'bare.md' });

            expect(result).toBe('denied');
        });

        it("falls back to 'denied' when requestPermission throws", async () => {
            const handle = makeFakeFileHandle();
            handle.requestPermission.mockRejectedValue(new Error('boom'));

            const result = await service.requestPermission(handle);

            expect(result).toBe('denied');
        });

        it('publishes LOCAL_PERMISSION_CHANGED on grant', async () => {
            const handle = makeFakeFileHandle('data.txt');
            handle.requestPermission.mockResolvedValue('granted');

            await service.requestPermission(handle, { mode: 'readwrite' });

            expect(eventBus.publish).toHaveBeenCalledWith(
                'LOCAL_PERMISSION_CHANGED',
                expect.objectContaining({
                    id: 'file:data.txt',
                    name: 'data.txt',
                    permission: 'granted',
                    mode: 'readwrite',
                }),
            );
        });
    });

    // =======================================================================
    // Directory listing
    // =======================================================================

    describe('listDirectory', () => {
        it('throws when handle is not a directory', async () => {
            await expect(service.listDirectory(makeFakeFileHandle())).rejects.toThrow(
                'listDirectory requires a directory handle',
            );
        });

        it('returns sorted entries with directories first', async () => {
            const zebraFile = makeFakeFileHandle('zebra.md');
            const bananaFile = makeFakeFileHandle('banana.md');
            const aardvarkDir = makeFakeDirectoryHandle('aardvark');

            const dirHandle = makeFakeDirectoryHandle('project', [
                ['zebra.md', zebraFile],
                ['aardvark', aardvarkDir],
                ['banana.md', bananaFile],
            ]);

            const result = await service.listDirectory(dirHandle);

            expect(result.rootId).toBe('directory:project');
            expect(result.path).toEqual([]);
            expect(result.truncated).toBe(false);
            expect(result.entries).toHaveLength(3);

            // Directories first, then alphabetical
            expect(result.entries[0].kind).toBe('directory');
            expect(result.entries[0].name).toBe('aardvark');
            expect(result.entries[1].kind).toBe('file');
            expect(result.entries[1].name).toBe('banana.md');
            expect(result.entries[2].kind).toBe('file');
            expect(result.entries[2].name).toBe('zebra.md');
        });

        it('respects maxEntries limit and sets truncated', async () => {
            const handles = [];
            for (let i = 0; i < 5; i++) {
                handles.push([`file-${i}.txt`, makeFakeFileHandle(`file-${i}.txt`)]);
            }
            const dirHandle = makeFakeDirectoryHandle('many', handles);

            const result = await service.listDirectory(dirHandle, { maxEntries: 2 });

            expect(result.entries).toHaveLength(2);
            expect(result.truncated).toBe(true);
        });

        it('respects the service-level maxEntriesPerDirectory when not overridden', async () => {
            const svc = new LocalFileAccessService(eventBus, { maxEntriesPerDirectory: 1 });
            const handles = [
                ['a.txt', makeFakeFileHandle('a.txt')],
                ['b.txt', makeFakeFileHandle('b.txt')],
            ];
            const dirHandle = makeFakeDirectoryHandle('two', handles);

            const result = await svc.listDirectory(dirHandle);

            expect(result.entries).toHaveLength(1);
            expect(result.truncated).toBe(true);
        });

        it('recurses into subdirectories respecting depth', async () => {
            const nestedFile = makeFakeFileHandle('nested.md');
            const subDir = makeFakeDirectoryHandle('sub', [['nested.md', nestedFile]]);
            const rootDir = makeFakeDirectoryHandle('root', [['sub', subDir]]);

            const result = await service.listDirectory(rootDir, { depth: 2 });

            // sub directory + nested file inside it
            expect(result.entries).toHaveLength(2);
            expect(result.entries[0].kind).toBe('directory');
            expect(result.entries[0].name).toBe('sub');
            expect(result.entries[1].kind).toBe('file');
            expect(result.entries[1].name).toBe('nested.md');
            expect(result.entries[1].path).toEqual(['sub']);
        });

        it('does not recurse beyond maxDepth from options', async () => {
            const deepFile = makeFakeFileHandle('deep.md');
            const level3 = makeFakeDirectoryHandle('level3', [['deep.md', deepFile]]);
            const level2 = makeFakeDirectoryHandle('level2', [['level3', level3]]);
            const level1 = makeFakeDirectoryHandle('level1', [['level2', level2]]);
            const rootDir = makeFakeDirectoryHandle('root', [['level1', level1]]);

            const svc = new LocalFileAccessService(eventBus, { maxDepth: 3 });
            const result = await svc.listDirectory(rootDir, { depth: 5 });

            // With maxDepth=3, should recurse root → level1 → level2 → level3 (stops before deep.md)
            expect(result.entries.length).toBeGreaterThanOrEqual(3);
            // deep.md should NOT appear because it's at depth 4 beyond maxDepth 3
            expect(result.entries.find(e => e.name === 'deep.md')).toBeUndefined();
        });

        it('publishes LOCAL_DIRECTORY_LISTED', async () => {
            const dirHandle = makeFakeDirectoryHandle('single', [
                ['only.txt', makeFakeFileHandle('only.txt')],
            ]);

            await service.listDirectory(dirHandle);

            expect(eventBus.publish).toHaveBeenCalledWith(
                'LOCAL_DIRECTORY_LISTED',
                expect.objectContaining({
                    rootId: 'directory:single',
                    count: 1,
                }),
            );
        });
    });

    // =======================================================================
    // File read/write
    // =======================================================================

    describe('readFile', () => {
        it('throws when handle is not a file', async () => {
            await expect(service.readFile(makeFakeDirectoryHandle('dir'))).rejects.toThrow(
                'readFile requires a file handle',
            );
        });

        it('returns file content and metadata', async () => {
            const handle = makeFakeFileHandle('greeting.txt', 'Hello, world!', 'text/plain');

            const result = await service.readFile(handle);

            expect(result.id).toBe('file:greeting.txt');
            expect(result.name).toBe('greeting.txt');
            expect(result.kind).toBe('file');
            expect(result.size).toBe(13);
            expect(result.mimeType).toBe('text/plain');
            expect(result.blob).toBeInstanceOf(Blob);

            // Verify the blob contains the right content
            const text = await result.blob.text();
            expect(text).toBe('Hello, world!');
        });

        it('defaults mimeType to application/octet-stream for empty type', async () => {
            const handle = makeFakeFileHandle('binary.bin', 'abc', '');

            const result = await service.readFile(handle);

            expect(result.mimeType).toBe('application/octet-stream');
        });

        it('publishes LOCAL_FILE_READ', async () => {
            const handle = makeFakeFileHandle('log.txt', 'line1\n', 'text/plain');

            await service.readFile(handle);

            expect(eventBus.publish).toHaveBeenCalledWith(
                'LOCAL_FILE_READ',
                expect.objectContaining({
                    id: 'file:log.txt',
                    name: 'log.txt',
                    size: 6,
                    mimeType: 'text/plain',
                }),
            );
        });

        it('re-throws when getFile fails', async () => {
            const handle = makeFakeFileHandle('bad.txt');
            handle.getFile.mockRejectedValue(new Error('disk error'));

            await expect(service.readFile(handle)).rejects.toThrow('disk error');
        });
    });

    describe('writeFile', () => {
        it('throws when handle is not a file', async () => {
            await expect(
                service.writeFile(makeFakeDirectoryHandle('dir'), 'content'),
            ).rejects.toThrow('writeFile requires a file handle');
        });

        it('writes string content and returns metadata', async () => {
            const handle = makeFakeFileHandle('output.txt');

            const result = await service.writeFile(handle, 'saved content');

            expect(result.id).toBe('file:output.txt');
            expect(result.name).toBe('output.txt');
            expect(result.kind).toBe('file');
            expect(result.size).toBe(13); // 'saved content'.length
            expect(result.writable).toBe(true);

            // Verify writable was created and written to
            expect(handle.createWritable).toHaveBeenCalled();
            const writable = await handle.createWritable.mock.results[0].value;
            expect(writable.write).toHaveBeenCalledWith('saved content');
        });

        it('writes Blob content', async () => {
            const handle = makeFakeFileHandle('blob-out.bin');
            const blob = new Blob(['binary data'], { type: 'application/octet-stream' });

            const result = await service.writeFile(handle, blob);

            expect(result.size).toBe(11);
            const writable = await handle.createWritable.mock.results[0].value;
            expect(writable.write).toHaveBeenCalledWith(blob);
        });

        it('publishes LOCAL_FILE_WRITTEN', async () => {
            const handle = makeFakeFileHandle('saved.txt');

            await service.writeFile(handle, 'data');

            expect(eventBus.publish).toHaveBeenCalledWith(
                'LOCAL_FILE_WRITTEN',
                expect.objectContaining({
                    id: 'file:saved.txt',
                    name: 'saved.txt',
                    size: 4,
                }),
            );
        });

        it('checks permission before writing and throws on denial', async () => {
            const handle = makeReadOnlyFileHandle('protected.txt');

            await expect(
                service.writeFile(handle, 'should not write'),
            ).rejects.toThrow('Write permission denied for "protected.txt"');

            // queryPermission was called for readwrite mode
            expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
            // requestPermission was also called because queryPermission returned 'prompt'
            expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
            // createWritable was never called — we failed before reaching it
            expect(handle.createWritable).not.toHaveBeenCalled();
        });

        it('proceeds with write when requestPermission elevates to granted', async () => {
            const handle = makeFakeFileHandle('elevated.txt');
            // queryPermission denies readwrite initially
            handle.queryPermission = vi.fn(async (opts) => {
                if (opts && opts.mode === 'readwrite') return 'prompt';
                return 'granted';
            });
            // requestPermission elevates to granted
            handle.requestPermission = vi.fn(async () => 'granted');

            const result = await service.writeFile(handle, 'ok');

            expect(result.id).toBe('file:elevated.txt');
            expect(handle.createWritable).toHaveBeenCalled();
        });

        it('aborts writable on write failure', async () => {
            const handle = makeFakeFileHandle('fail.txt');
            handle.createWritable = vi.fn(async () => ({
                write: vi.fn(async () => {
                    throw new Error('disk full');
                }),
                close: vi.fn(async () => {}),
                abort: vi.fn(async () => {}),
            }));

            await expect(service.writeFile(handle, 'data')).rejects.toThrow('disk full');

            // Verify abort was called, not close
            const writable = await handle.createWritable.mock.results[0].value;
            expect(writable.abort).toHaveBeenCalled();
            expect(writable.close).not.toHaveBeenCalled();
        });
    });

    // =======================================================================
    // Unsupported environment
    // =======================================================================

    describe('unsupported environment', () => {
        it('pickFiles throws with UNSUPPORTED code', async () => {
            await expect(service.pickFiles()).rejects.toMatchObject({
                message: expect.stringContaining('not supported'),
                code: 'UNSUPPORTED',
            });
        });

        it('pickDirectory throws with UNSUPPORTED code', async () => {
            await expect(service.pickDirectory()).rejects.toMatchObject({
                message: expect.stringContaining('not supported'),
                code: 'UNSUPPORTED',
            });
        });

        it('non-picker methods still work without picker APIs', async () => {
            // queryPermission, requestPermission, readFile, writeFile,
            // and listDirectory do NOT call _assertSupported
            const handle = makeFakeFileHandle('test.txt');

            expect(await service.queryPermission(handle)).toBe('granted');
            expect(await service.requestPermission(handle)).toBe('granted');

            const read = await service.readFile(handle);
            expect(read.name).toBe('test.txt');

            const write = await service.writeFile(handle, 'ok');
            expect(write.name).toBe('test.txt');
        });

        it('publishes error event with operation name', async () => {
            try {
                await service.pickFiles();
            } catch {
                // Expected
            }

            expect(eventBus.publish).toHaveBeenCalledWith(
                'LOCAL_FILE_ACCESS_ERROR',
                expect.objectContaining({
                    operation: 'pick-file',
                    error: expect.stringContaining('not supported'),
                }),
            );
        });
    });
    // =======================================================================
    // Save picker capability detection
    // =======================================================================

    describe('supportsSaveFilePicker', () => {
        it('returns false when showSaveFilePicker is missing', () => {
            window.showSaveFilePicker = undefined;

            expect(LocalFileAccessService.supportsSaveFilePicker()).toBe(false);
        });

        it('returns true when showSaveFilePicker is present', () => {
            window.showSaveFilePicker = vi.fn();

            expect(LocalFileAccessService.supportsSaveFilePicker()).toBe(true);
        });
    });

    // =======================================================================
    // Save picker
    // =======================================================================

    describe('pickSaveFile', () => {
        it('throws with UNSUPPORTED code when not available', async () => {
            // After beforeEach, showSaveFilePicker is not installed
            await expect(service.pickSaveFile()).rejects.toMatchObject({
                message: expect.stringContaining('not supported'),
                code: 'UNSUPPORTED',
            });
        });

        it('returns null on AbortError (user cancels)', async () => {
            window.showSaveFilePicker = vi.fn().mockRejectedValue(
                new DOMException('The user aborted a request.', 'AbortError'),
            );

            const result = await service.pickSaveFile();

            expect(result).toBeNull();
        });

        it('calls showSaveFilePicker with suggestedName and types', async () => {
            window.showSaveFilePicker = vi.fn().mockResolvedValue(
                makeFakeFileHandle('output.txt'),
            );

            await service.pickSaveFile({
                suggestedName: 'report.pdf',
                types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
            });

            expect(window.showSaveFilePicker).toHaveBeenCalledWith({
                suggestedName: 'report.pdf',
                types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
            });
        });

        it('forwards excludeAcceptAllOption when set', async () => {
            window.showSaveFilePicker = vi.fn().mockResolvedValue(
                makeFakeFileHandle('output.txt'),
            );

            await service.pickSaveFile({ excludeAcceptAllOption: true });

            expect(window.showSaveFilePicker).toHaveBeenCalledWith({
                excludeAcceptAllOption: true,
            });
        });

        it('publishes LOCAL_SAVE_FILE_PICKED on success', async () => {
            window.showSaveFilePicker = vi.fn().mockResolvedValue(
                makeFakeFileHandle('saved.txt'),
            );

            await service.pickSaveFile();

            expect(eventBus.publish).toHaveBeenCalledWith(
                'LOCAL_SAVE_FILE_PICKED',
                expect.objectContaining({
                    id: 'file:saved.txt',
                    name: 'saved.txt',
                    permission: 'granted',
                }),
            );
        });

        it('publishes error event on non-AbortError failure', async () => {
            window.showSaveFilePicker = vi.fn().mockRejectedValue(
                new DOMException('Permission denied', 'NotAllowedError'),
            );

            await expect(service.pickSaveFile()).rejects.toThrow('Permission denied');

            expect(eventBus.publish).toHaveBeenCalledWith(
                'LOCAL_FILE_ACCESS_ERROR',
                expect.objectContaining({
                    operation: 'pick-save-file',
                    error: expect.stringContaining('Permission denied'),
                }),
            );
        });
    });

    // =======================================================================
    // Recent handles
    // =======================================================================

    describe('recent handles', () => {
        let mockStore;
        let svc;

        beforeEach(() => {
            mockStore = {
                init: vi.fn().mockResolvedValue(undefined),
                save: vi.fn().mockImplementation(async (entry) => ({
                    ...entry,
                    lastSeenAt: Date.now(),
                    persisted: true,
                })),
                listRecent: vi.fn().mockResolvedValue([]),
                get: vi.fn().mockResolvedValue(null),
                remove: vi.fn().mockResolvedValue(undefined),
                clear: vi.fn().mockResolvedValue(undefined),
            };
            svc = new LocalFileAccessService(eventBus, {
                handleStore: mockStore,
            });
        });

        it('saveRecentHandle stores directory entry via handleStore', async () => {
            const dirHandle = makeFakeDirectoryHandle('my-project');
            const entry = {
                id: 'directory:my-project',
                kind: 'directory',
                name: 'my-project',
                handle: dirHandle,
            };

            await svc.saveRecentHandle(entry, {
                appId: 'my-app',
                tags: ['project', 'active'],
            });

            expect(mockStore.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'directory:my-project',
                    kind: 'directory',
                    name: 'my-project',
                    handle: dirHandle,
                    appId: 'my-app',
                    tags: ['project', 'active'],
                }),
            );
        });

        it('listRecentHandles returns entries sorted by lastSeenAt', async () => {
            const older = { id: 'older', name: 'older.txt', lastSeenAt: 100 };
            const newer = { id: 'newer', name: 'newer.txt', lastSeenAt: 200 };
            mockStore.listRecent.mockResolvedValue([newer, older]);

            const result = await svc.listRecentHandles(5);

            expect(mockStore.listRecent).toHaveBeenCalledWith(5);
            expect(result).toEqual([newer, older]);
            // Verify ordering: most recent (highest lastSeenAt) comes first
            expect(result[0].lastSeenAt).toBeGreaterThan(result[1].lastSeenAt);
        });

        it('getRecentHandle returns entry with permission and needsRegrant false', async () => {
            const handle = makeFakeFileHandle('doc.txt');
            const stored = {
                id: 'file:doc.txt',
                kind: 'file',
                name: 'doc.txt',
                handle,
            };
            mockStore.get.mockResolvedValue(stored);

            const result = await svc.getRecentHandle('file:doc.txt');

            expect(result.id).toBe('file:doc.txt');
            expect(result.permission).toBe('granted');
            expect(result.needsRegrant).toBe(false);
            expect(result.handle).toBe(handle);
        });

        it('getRecentHandle marks needsRegrant when permission is denied', async () => {
            const handle = makeFakeFileHandle('locked.txt');
            handle.queryPermission = vi.fn().mockResolvedValue('denied');
            const stored = {
                id: 'file:locked.txt',
                kind: 'file',
                name: 'locked.txt',
                handle,
            };
            mockStore.get.mockResolvedValue(stored);

            const result = await svc.getRecentHandle('file:locked.txt');

            expect(result.permission).toBe('denied');
            expect(result.needsRegrant).toBe(true);
        });

        it("getRecentHandle marks needsRegrant when entry has no handle", async () => {
            const stored = {
                id: 'file:missing.txt',
                kind: 'file',
                name: 'missing.txt',
                handle: null,
            };
            mockStore.get.mockResolvedValue(stored);

            const result = await svc.getRecentHandle('file:missing.txt');

            expect(result.permission).toBe('denied');
            expect(result.needsRegrant).toBe(true);
        });

        it('getRecentHandle returns null for unknown id', async () => {
            mockStore.get.mockResolvedValue(null);

            const result = await svc.getRecentHandle('nonexistent');

            expect(result).toBeNull();
        });

        it('removeRecentHandle removes entry from store', async () => {
            await svc.removeRecentHandle('file:stale.txt');

            expect(mockStore.remove).toHaveBeenCalledWith('file:stale.txt');
        });

        it('clearRecentHandles clears all entries', async () => {
            await svc.clearRecentHandles();

            expect(mockStore.clear).toHaveBeenCalled();
        });
    });
});
