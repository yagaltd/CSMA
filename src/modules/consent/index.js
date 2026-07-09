import { ConsentService } from './services/ConsentService.js';
import { ConsentContracts } from './contracts/consent-contracts.js';

export const manifest = {
    id: 'consent',
    name: 'Consent Module',
    version: '1.0.0',
    description: 'Generic consent preferences for optional app capabilities',
    dependencies: [],
    services: ['consent'],
    contracts: [
        'INTENT_CONSENT_ACCEPT_ALL',
        'INTENT_CONSENT_REJECT_OPTIONAL',
        'INTENT_CONSENT_UPDATE',
        'CONSENT_UPDATED',
        'CONSENT_ACKNOWLEDGED',
        'CONSENT_RESET',
        'ANALYTICS_CONSENT_UPDATED'
    ],
    contributes: {
        commands: [],
        navigation: [],
        panels: [],
        adapters: [],
        views: []
    }
};

export const services = {
    consent: ConsentService
};

export const contracts = ConsentContracts;

// Module-scoped UI — composite view, not a framework primitive.
// Consumers import from the module barrel instead of reaching into ui/.
export { initConsentUI } from './ui/consent-ui.js';
