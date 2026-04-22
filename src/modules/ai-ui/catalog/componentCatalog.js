/**
 * CSMA Component Catalog
 *
 * A discoverable index of available UI primitives and example compositions.
 * Agents and developers can import this to understand what building blocks
 * exist in the system.
 *
 * This is a plain JS object — not an archetype registry or schema validator.
 */

export const componentCatalog = {
  badge: {
    path: 'src/ui/components/badge',
    type: 'I',
    files: ['badge.css'],
    description: 'Small status indicator or label.',
    props: ['variant', 'tone', 'size'],
    variants: ['soft-primary', 'soft-success', 'soft-warning', 'soft-danger', 'soft-info']
  },
  button: {
    path: 'src/ui/components/button',
    type: 'I',
    files: ['button.css'],
    description: 'Interactive button with multiple variants.',
    props: ['variant', 'tone', 'size', 'shape'],
    variants: ['default', 'primary', 'secondary', 'ghost', 'destructive']
  },
  toast: {
    path: 'src/ui/components/toast',
    type: 'II',
    files: ['toast.css', 'toast.js'],
    description: 'EventBus-driven notification toast.',
    props: ['type', 'title', 'description', 'duration'],
    runtimeDependencies: ['EventBus'],
    init: 'initToastSystem(eventBus)'
  },
  card: {
    path: 'src/ui/components/card',
    type: 'I',
    files: ['card.css'],
    description: 'Content container with header, body, and footer slots.',
    props: ['tone'],
    slots: ['body', 'footer']
  },
  field: {
    path: 'src/ui/components/field',
    type: 'I',
    files: ['field.css'],
    description: 'Form field wrapper with label, control, and helper text.',
    props: ['label', 'helper', 'error', 'required'],
    slots: ['control']
  },
  input: {
    path: 'src/ui/components/input',
    type: 'I',
    files: ['input.css'],
    description: 'Text input with states.',
    props: ['type', 'placeholder', 'state', 'autocomplete']
  },
  'theme-toggle': {
    path: 'src/ui/components/theme-toggle',
    type: 'I',
    files: ['theme-toggle.css'],
    description: 'Theme switcher button (light / dark / contrast).',
    props: ['label', 'theme']
  }
};

/**
 * Get a flat list of component IDs.
 */
export function listComponents() {
  return Object.keys(componentCatalog);
}

/**
 * Get only Type II (JS-backed) components.
 */
export function listTypeIIComponents() {
  return Object.entries(componentCatalog)
    .filter(([, def]) => def.type === 'II')
    .map(([id]) => id);
}

/**
 * Get components that require a specific runtime dependency.
 */
export function componentsRequiring(dependency) {
  return Object.entries(componentCatalog)
    .filter(([, def]) => (def.runtimeDependencies || []).includes(dependency))
    .map(([id]) => id);
}
