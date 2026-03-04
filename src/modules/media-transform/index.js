import { MediaTransformService } from './services/MediaTransformService.js';

export const manifest = {
    name: 'Media Transform',
    version: '1.0.0',
    description: 'Client-side media conversions using canvas/Web APIs',
    dependencies: [],
    bundleSize: '+5KB',
    contracts: [
        'INTENT_MEDIA_TRANSFORM',
        'MEDIA_TRANSFORM_COMPLETED',
        'MEDIA_TRANSFORM_ERROR'
    ]
};

export const services = {
    mediaTransform: MediaTransformService
};

export function createMediaTransform(eventBus, options = {}) {
    const service = new MediaTransformService(eventBus, options);
    service.init(options);
    return service;
}
