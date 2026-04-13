import authShellArchetype from '../../../ui/archetypes/layouts/auth-shell.archetype.json';
import contactFormArchetype from '../../../ui/archetypes/content/contact-form.archetype.json';
import loginFormArchetype from '../../../ui/archetypes/content/login-form.archetype.json';

export const layoutArchetypes = new Map([
  ['auth-shell', authShellArchetype]
]);

export const contentArchetypes = new Map([
  ['contact-form', contactFormArchetype],
  ['login-form', loginFormArchetype]
]);
