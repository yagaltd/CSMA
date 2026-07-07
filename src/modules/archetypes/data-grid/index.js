import './data-grid.css';
import { createDataGrid } from './data-grid.js';

export const manifest = {
    id: 'archetype-data-grid',
    name: 'Data Grid',
    version: '1.0.0',
    description: 'Sortable, resizable, selectable data table with virtual scrolling and token-driven theming',
    dependencies: [],
    services: [],
    contracts: [],
    contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] }
};

export { createDataGrid };
