import './media-browser.css';
import { createMediaBrowser } from './media-browser.js';

export const manifest = {
    id: 'archetype-media-browser',
    name: 'Media Browser',
    version: '1.0.0',
    description: 'Thumbnail grid with search, filter, and sort for image, video, and file browsing',
    dependencies: [],
    services: [],
    contracts: [],
    contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] }
};

export { createMediaBrowser };
