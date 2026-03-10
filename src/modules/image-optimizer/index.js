import { ImageOptimizerService } from './services/ImageOptimizerService.js';

export const manifest = {
    id: 'image-optimizer',
    name: 'Image Optimizer',
    version: '1.0.0',
    description: 'High-level image optimization powered by Media Transform',
    dependencies: ['mediaTransform'],
    services: ['imageOptimizer'],
    bundleSize: '+3KB',
    contracts: [
        'INTENT_IMAGE_OPTIMIZE',
        'IMAGE_OPTIMIZE_COMPLETED',
        'IMAGE_OPTIMIZE_ERROR'
    ]
};

export const services = {
    imageOptimizer: ImageOptimizerService
};

export function createImageOptimizer(eventBus, options = {}) {
    const service = new ImageOptimizerService(eventBus, options);
    service.init(options);
    return service;
}
