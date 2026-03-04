import { FormManagementService } from './services/FormManagementService.js';

export const manifest = {
    name: 'Form Management',
    version: '1.0.0',
    description: 'Form state, validation, and auto-save orchestration',
    dependencies: [],
    bundleSize: '+8KB',
    contracts: [
        'INTENT_FORM_REGISTER',
        'INTENT_FORM_UPDATE_FIELD',
        'INTENT_FORM_SUBMIT',
        'INTENT_FORM_RESET',
        'FORM_STATE_CHANGED',
        'FORM_FIELD_UPDATED',
        'FORM_SUBMITTED',
        'FORM_ERROR'
    ]
};

export const services = {
    formManager: FormManagementService
};

export function createFormManagement(eventBus, options = {}) {
    const service = new FormManagementService(eventBus, options);
    service.init(options);
    return service;
}
