import '../file-explorer/file-explorer.css';
import { createFileExplorer } from './ui/file-explorer.js';
import { FileExplorerService } from './services/FileExplorerService.js';
import { FileExplorerContracts } from './contracts/file-explorer-contracts.js';

export const manifest = {
    id: 'file-explorer',
    name: 'File Explorer',
    version: '1.0.0',
    description: 'FSA directory tree with lazy expand, keyboard navigation, Quick Look, and preview',
    dependencies: ['file-system'],
    services: [],
    bundleSize: '+8KB',
    contracts: [
        'DIRECTORY_OPENED',
        'DIRECTORY_EXPANDED',
        'DIRECTORY_COLLAPSED',
        'SELECTION_CHANGED',
        'FILE_OPENED',
        'FILE_EXPLORER_ERROR',
    ],
    contributes: {
        commands: [],
        navigation: [],
        panels: [],
        adapters: [],
        views: [],
    },
};

export const contracts = FileExplorerContracts;

export { createFileExplorer, FileExplorerService, FileExplorerContracts };

// Convenience re-exports for service-level helpers
export { formatSize, sortEntries, normalizeEntry, isTexty } from './services/FileExplorerService.js';
