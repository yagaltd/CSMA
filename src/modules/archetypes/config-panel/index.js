import './config-panel.css';
import { createConfigPanel } from './config-panel.js';

export const manifest = {
    id: 'archetype-config-panel',
    name: 'Config Panel',
    version: '1.0.0',
    description: 'Toggle cards, sliders, color pickers, and select dropdowns for settings and configuration UIs',
    dependencies: [],
    services: [],
    contracts: [],
    contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] }
};

export { createConfigPanel };
