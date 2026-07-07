import './nav-tabs.css';
import { createNavTabs } from './nav-tabs.js';

export const manifest = {
    id: 'archetype-nav-tabs',
    name: 'Nav Tabs',
    version: '1.0.0',
    description: 'Horizontal tab bar with overflow handling for workspace switching, view toggling, and filter navigation',
    dependencies: [],
    services: [],
    contracts: [],
    contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] }
};

export { createNavTabs };
