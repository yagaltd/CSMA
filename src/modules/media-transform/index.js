import { MediaTransformService } from './services/MediaTransformService.js';

export const manifest = {
    id: 'media-transform',
    name: 'Media Transform',
    version: '1.0.0',
    description: 'Client-side media conversions using canvas/Web APIs',
    dependencies: [],
    services: ['mediaTransform'],
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
