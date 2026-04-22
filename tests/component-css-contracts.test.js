import { describe, expect, it } from 'vitest';
import { validateInteractiveComponentCss } from '../src/ui/validation/componentCssContracts.js';

describe('validateInteractiveComponentCss', () => {
  it('fails interactive CSS that omits focus-visible state', () => {
    const findings = validateInteractiveComponentCss({
      aiUi: {
        render: { kind: 'button' },
        behavior: { role: 'trigger', events: ['click'] }
      }
    }, '.button { color: var(--foreground); } .button[disabled] { opacity: .5; }', 'src/ui/components/demo/demo.css');

    expect(findings).toEqual([
      expect.objectContaining({
        file: 'src/ui/components/demo/demo.css',
        message: 'Interactive components must define :focus-visible styles.'
      })
    ]);
  });
});
