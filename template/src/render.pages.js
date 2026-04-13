export const RENDER_PAGES = [
  {
    id: 'auth-login',
    routePath: '/',
    viewId: 'ai-ui.login-form',
    title: 'Sign in',
    description: 'Use your work email and password to access your workspace.',
    canonicalUrl: 'https://example.com/',
    lang: 'en',
    htmlAttrs: {
      attrs: {
        lang: 'en'
      },
      classes: ['auth-page'],
      style: {}
    },
    bodyAttrs: {
      attrs: {
        'data-app-target': 'template'
      },
      classes: [],
      style: {}
    }
  }
];

export const STATIC_RENDER_PAGES = RENDER_PAGES;
