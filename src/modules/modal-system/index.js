import { ModalService } from './services/ModalService.js';

export const manifest = {
    id: 'modal-system',
    name: 'Modal System',
    version: '1.0.0',
    description: 'Global modal stack controller',
    dependencies: [],
    services: ['modal'],
    bundleSize: '+4KB',
    contracts: [
        'INTENT_MODAL_OPEN',
        'INTENT_MODAL_CLOSE',
        'INTENT_MODAL_CLOSE_ALL',
        'MODAL_STACK_UPDATED',
        'MODAL_ERROR'
    ]
};

export const services = {
    modal: ModalService
};

export function createModalSystem(eventBus, options = {}) {
    const service = new ModalService(eventBus, options);
    service.init(options);
    return service;
}
