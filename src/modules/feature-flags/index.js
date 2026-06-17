import { FeatureFlagsService } from './services/FeatureFlagsService.js';
import { FeatureFlagsContracts } from './contracts/feature-flags-contracts.js';

export const manifest = {
    id: 'feature-flags',
    name: 'Feature Flags',
    version: '1.0.0',
    description: 'Client feature flag cache and UI state toggles',
    dependencies: [],
    services: ['featureFlags'],
    contracts: Object.keys(FeatureFlagsContracts),
    contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] }
};

export const services = { featureFlags: FeatureFlagsService };
export const contracts = FeatureFlagsContracts;
export { FeatureFlagsService };
