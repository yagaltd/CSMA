import { MediaService } from './services/MediaService.js';
import { MediaContracts } from './contracts/media-contracts.js';

export const manifest = {
    id: 'media',
    name: 'Media Module',
    version: '1.0.0',
    description: 'Photo, video, audio, and screen capture with image optimization',
    dependencies: [],
    services: ['media'],
    bundleSize: '+14KB',
    contracts: [
        // capture
        'INTENT_MEDIA_CAPTURE_PHOTO',
        'INTENT_MEDIA_CAPTURE_VIDEO_START',
        'INTENT_MEDIA_CAPTURE_VIDEO_STOP',
        'INTENT_MEDIA_CAPTURE_AUDIO_START',
        'INTENT_MEDIA_CAPTURE_AUDIO_STOP',
        'INTENT_MEDIA_CAPTURE_SCREEN_START',
        'INTENT_MEDIA_CAPTURE_SCREEN_STOP',
        'INTENT_MEDIA_CAPTURE_CANCEL',
        'MEDIA_CAPTURE_STARTED',
        'MEDIA_CAPTURE_COMPLETED',
        'MEDIA_CAPTURE_ERROR',
        // transform
        'INTENT_MEDIA_TRANSFORM',
        'INTENT_MEDIA_OPTIMIZE',
        'INTENT_MEDIA_RESIZE',
        'MEDIA_TRANSFORM_COMPLETED',
        'MEDIA_OPTIMIZE_COMPLETED',
        'MEDIA_RESIZE_COMPLETED',
        'MEDIA_TRANSFORM_ERROR',
        // deprecated aliases
        'INTENT_CAMERA_CAPTURE_PHOTO',
        'INTENT_CAMERA_CAPTURE_VIDEO_START',
        'INTENT_CAMERA_CAPTURE_VIDEO_STOP',
        'CAMERA_CAPTURE_COMPLETED',
        'CAMERA_CAPTURE_ERROR',
        'INTENT_MEDIA_CAPTURE_START',
        'INTENT_MEDIA_CAPTURE_STOP',
        'MEDIA_CAPTURE_STOPPED',
        'INTENT_IMAGE_OPTIMIZE',
        'IMAGE_OPTIMIZE_COMPLETED',
        'IMAGE_OPTIMIZE_ERROR'
    ]
};

export const services = {
    media: MediaService
};

export function createMedia(eventBus, options = {}) {
    const service = new MediaService(eventBus, options);
    service.init(options);
    return service;
}

export const contracts = MediaContracts;
