import { MediaCaptureService } from './services/MediaCaptureService.js';

export const manifest = {
    name: 'Media Capture',
    version: '1.0.0',
    description: 'Audio recording via MediaRecorder with File System integration',
    dependencies: ['fileSystem'],
    bundleSize: '+4KB',
    contracts: [
        'INTENT_MEDIA_CAPTURE_START',
        'INTENT_MEDIA_CAPTURE_STOP',
        'INTENT_MEDIA_CAPTURE_CANCEL',
        'MEDIA_CAPTURE_STARTED',
        'MEDIA_CAPTURE_STOPPED',
        'MEDIA_CAPTURE_ERROR'
    ]
};

export const services = {
    mediaCapture: MediaCaptureService
};

export function createMediaCapture(eventBus, options = {}) {
    const service = new MediaCaptureService(eventBus, options);
    service.init(options);
    return service;
}
