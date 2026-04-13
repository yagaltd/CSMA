import { AIUIComposerService } from './services/AIUIComposerService.js';

export const manifest = {
  id: 'ai-ui',
  name: 'AI UI Module',
  version: '1.0.0',
  description: 'Validates archetype-driven AI UI composition into registered CSMA views',
  dependencies: [],
  services: ['AIUIComposerService'],
  contracts: [],
  contributes: {
    views: [
      {
        id: 'ai-ui.login-form',
        title: 'AI UI Login Form',
        target: '#auth-panel',
        renderService: 'AIUIComposerService',
        renderMethod: 'renderLoginFormView',
        mode: 'replace',
        allowedTargets: ['#auth-panel', '#example-output', '#ai-output'],
        propsSchema: {
          eyebrow: 'string',
          headline: 'string',
          supportingText: 'string',
          title: 'string',
          description: 'string',
          tone: 'string',
          emailLabel: 'string',
          emailHelper: 'string',
          emailPlaceholder: 'string',
          passwordLabel: 'string',
          passwordHelper: 'string',
          passwordPlaceholder: 'string',
          submitLabel: 'string'
        },
        stateSchema: {
          tone: 'string'
        }
      },
      {
        id: 'ai-ui.contact-form',
        title: 'AI UI Contact Form',
        target: '#auth-panel',
        renderService: 'AIUIComposerService',
        renderMethod: 'renderContactFormView',
        mode: 'replace',
        allowedTargets: ['#auth-panel', '#example-output', '#ai-output'],
        propsSchema: {
          eyebrow: 'string',
          headline: 'string',
          supportingText: 'string',
          title: 'string',
          description: 'string',
          tone: 'string',
          nameLabel: 'string',
          nameHelper: 'string',
          namePlaceholder: 'string',
          emailLabel: 'string',
          emailHelper: 'string',
          emailPlaceholder: 'string',
          companyLabel: 'string',
          companyHelper: 'string',
          companyPlaceholder: 'string',
          submitLabel: 'string'
        },
        stateSchema: {
          tone: 'string'
        }
      }
    ]
  }
};

export const services = {
  AIUIComposerService
};
