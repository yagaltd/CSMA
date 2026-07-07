import './editor-builder.css';
import { createEditor } from './editor-builder.js';

export const manifest = {
    id: 'archetype-editor-builder',
    name: 'Editor Builder',
    version: '1.0.0',
    description: 'Form-based editor with field definitions, validation, and draft persistence',
    dependencies: [],
    services: [],
    contracts: [],
    contributes: { commands: [], navigation: [], panels: [], adapters: [], views: [] }
};

export { createEditor };
