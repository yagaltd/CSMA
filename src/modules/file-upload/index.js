import { FileUploadService, createFileUploadService } from './services/FileUploadService.js';
import { FileUploadContracts } from './contracts/file-upload-contracts.js';

export const manifest = {
    id: 'file-upload',
    name: 'File Upload',
    version: '1.0.0',
    description: 'Resumable sequential file uploads with checkpoint persistence',
    dependencies: ['sync-queue', 'network-status', 'file-system'],
    services: ['fileUpload'],
    bundleSize: '+6KB',
    contracts: [
        'INTENT_FILE_UPLOAD',
        'INTENT_FILE_UPLOAD_PAUSE',
        'INTENT_FILE_UPLOAD_RESUME',
        'INTENT_FILE_UPLOAD_CANCEL',
        'INTENT_FILE_UPLOAD_RETRY',
        'FILE_UPLOAD_STARTED',
        'FILE_UPLOAD_PROGRESS',
        'FILE_UPLOAD_COMPLETED',
        'FILE_UPLOAD_FAILED',
        'FILE_UPLOAD_PAUSED',
        'FILE_UPLOAD_RESUMED',
        'FILE_UPLOAD_CANCELLED',
        'FILE_UPLOAD_RETRIED',
        'FILE_REMOVED'
    ]
};

export const services = {
    fileUpload: FileUploadService
};

export const contracts = FileUploadContracts;

export { FileUploadService, createFileUploadService };

// Module-scoped UI — composite views, not framework primitives.
// Consumers import from the module barrel instead of reaching into ui/.
export { createFileUploadDropZone } from './ui/drop-zone.js';
export { createFileUploadList } from './ui/file-list.js';

