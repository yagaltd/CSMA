import './overlay-manager.css';
import { createOverlayManager } from './overlay-manager.js';

export const manifest = {
    id: 'archetype-overlay-manager',
    name: 'Overlay Manager',
    version: '1.0.0',
    description: 'Modal, popover, drawer, and lightbox management with stacking, focus trap, and Escape dismissal',
    dependencies: [],
    services: [],
    contracts: [],
    contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] }
};

export { createOverlayManager };
