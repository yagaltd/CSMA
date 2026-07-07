import './viewer.css';
import { createViewer } from './viewer.js';

export const manifest = {
    id: 'archetype-viewer',
    name: 'Viewer',
    version: '1.0.0',
    description: 'Content viewer with loading, empty, and error states. Supports fetch-and-render and markdown.',
    dependencies: [],
    services: [],
    contracts: [],
    contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] }
};

export { createViewer };
