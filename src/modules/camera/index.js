import { CameraService } from './services/CameraService.js';

export const manifest = {
    name: 'Camera Module',
    version: '1.0.0',
    description: 'Photo and video capture with File System persistence',
    dependencies: ['fileSystem'],
    bundleSize: '+5KB',
    contracts: [
        'INTENT_CAMERA_CAPTURE_PHOTO',
        'INTENT_CAMERA_CAPTURE_VIDEO_START',
        'INTENT_CAMERA_CAPTURE_VIDEO_STOP',
        'CAMERA_CAPTURE_COMPLETED',
        'CAMERA_CAPTURE_ERROR'
    ]
};

export const services = {
    camera: CameraService
};

export function createCamera(eventBus, options = {}) {
    const service = new CameraService(eventBus, options);
    service.init(options);
    return service;
}
