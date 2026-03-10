import { FileSystemService } from './services/FileSystem.js';

export const manifest = {
    id: 'file-system',
    name: 'Hybrid File System',
    version: '1.0.0',
    description: 'IndexedDB metadata + OPFS binary storage for large files',
    dependencies: [],
    services: ['fileSystem'],
    bundleSize: '+3KB',
    contracts: ['FILE_STORED', 'FILE_RETRIEVED', 'FILE_DELETED', 'FILE_SYSTEM_ERROR']
};

export const services = {
    fileSystem: FileSystemService
};

export function createFileSystem(eventBus, options = {}) {
    const service = new FileSystemService(eventBus, options);
    service.ready = service.init();
    return service;
}
