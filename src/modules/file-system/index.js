import { FileSystemService } from './services/FileSystem.js';
import { LocalFileAccessService } from './services/LocalFileAccess.js';
import { FileHandleStore } from './services/FileHandleStore.js';
import { FileSystemContracts } from './contracts/file-system-contracts.js';

export const manifest = {
    id: 'file-system',
    name: 'Hybrid File System',
    version: '1.0.0',
    description: 'Managed OPFS storage + browser File System Access API for user-granted local files',
    dependencies: [],
    services: ['fileSystem', 'localFileAccess'],
    bundleSize: '+6KB',
    contracts: Object.keys(FileSystemContracts)
};

export const services = {
    fileSystem: FileSystemService,
    localFileAccess: LocalFileAccessService
};

export function createFileSystem(eventBus, options = {}) {
    const service = new FileSystemService(eventBus, options);
    service.ready = service.init();
    return service;
}

export function createLocalFileAccess(eventBus, options = {}) {
    return new LocalFileAccessService(eventBus, options);
}

export { FileHandleStore };
export const contracts = FileSystemContracts;
