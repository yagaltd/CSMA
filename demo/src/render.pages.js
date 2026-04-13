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
        'data-app-target': 'demo'
      },
      classes: [],
      style: {}
    },
    props: {
      headline: 'Welcome back',
      supportingText: 'Sign in to continue into your workspace.',
      submitLabel: 'Sign in'
    }
  },
  {
    id: 'contact-page',
    routePath: '/contact',
    viewId: 'ai-ui.contact-form',
    title: 'Contact',
    description: 'Share your details and the right person will follow up.',
    canonicalUrl: 'https://example.com/contact',
    lang: 'en',
    htmlAttrs: {
      attrs: {
        lang: 'en'
      },
      classes: ['contact-page'],
      style: {}
    },
    bodyAttrs: {
      attrs: {
        'data-app-target': 'demo'
      },
      classes: [],
      style: {}
    },
    props: {
      headline: 'Talk to us',
      supportingText: 'The same shared render contract can drive a static export.',
      submitLabel: 'Request contact'
    }
  }
];

export const STATIC_RENDER_PAGES = RENDER_PAGES;
