import { AbTestingService } from './services/AbTestingService.js';
import { AbTestingContracts } from './contracts/ab-testing-contracts.js';

export const manifest = { id: 'ab-testing', name: 'A/B Testing', version: '1.0.0', description: 'Experiment variant state, data attributes, analytics labels, and explicitly configured local assignment', dependencies: [], services: ['abTesting'], contracts: Object.keys(AbTestingContracts), contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] } };

export const services = { abTesting: AbTestingService };
export const contracts = AbTestingContracts;
export { AbTestingService };
