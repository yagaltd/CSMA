import './stats-dashboard.css';
import { createStatsDashboard } from './stats-dashboard.js';

export const manifest = {
    id: 'archetype-stats-dashboard',
    name: 'Stats Dashboard',
    version: '1.0.0',
    description: 'Responsive stat cards in an auto-grid with declarative metric definitions and optional charts',
    dependencies: [],
    services: [],
    contracts: [],
    contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] }
};

export { createStatsDashboard };
