import { AuthUIService, createAuthUIService } from './services/AuthUIService.js';

export const manifest = {
  id: 'auth-ui',
  name: 'Auth UI Module',
  version: '1.0.0',
  description: 'Module-scoped authentication UI patterns backed by auth and form-management',
  dependencies: ['auth', 'form-management'],
  services: ['authUI'],
  contracts: [],
  aiUi: {
    components: [
      {
        id: 'auth-ui.panel',
        alias: 'auth-panel',
        title: 'Auth Panel',
        category: 'Auth',
        preferred: true,
        summary: 'Module-scoped account flow panel for login, registration, recovery, verification, and status',
        propsSchema: {
          view: 'string'
        },
        slots: {
          default: {
            selector: ':root',
            allowedChildren: []
          }
        },
        allowedChildren: [],
        behavior: {
          role: 'pattern',
          events: ['submit', 'click'],
          targetActions: [
            'login',
            'register',
            'forgot-password',
            'reset-password',
            'verify-email',
            'resend-verification',
            'oauth',
            'logout'
          ],
          intentMap: {},
          eventTargetSelector: '[data-auth-ui-panel]'
        },
        style: {
          surfaceAware: true,
          supportsVariant: false,
          supportsSize: false,
          supportsTone: false
        },
        textTargets: {
          title: ['.auth-ui-panel__title'],
          description: ['.auth-ui-panel__message'],
          label: ['button', 'label']
        },
        render: {
          kind: 'module-pattern',
          service: 'authUI',
          mount: 'mount'
        }
      }
    ]
  }
};

export const services = {
  authUI: AuthUIService
};

export { AuthUIService, createAuthUIService };
