import { AIUIComposerService } from './services/AIUIComposerService.js';

export const manifest = {
  id: 'ai-ui',
  name: 'AI UI Module',
  version: '1.0.0',
  description: 'Component catalog and UI composition helpers for CSMA',
  dependencies: [],
  services: ['AIUIComposerService'],
  contracts: [],
  contributes: {
    views: []
  }
};

export const services = {
  AIUIComposerService
};
