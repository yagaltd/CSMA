import { ChartsService } from './services/ChartsService.js';
import { ChartsContracts } from './contracts/charts-contracts.js';

export const manifest = { id: 'charts', name: 'Charts', version: '1.0.0', description: 'KPI cards, chart adapter registry, formatting, and loading/error state', dependencies: [], services: ['charts'], contracts: Object.keys(ChartsContracts), contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] } };

export const services = { charts: ChartsService };
export const contracts = ChartsContracts;
export { ChartsService };
