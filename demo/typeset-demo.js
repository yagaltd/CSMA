/**
 * Typeset Demo — interactive rhythm controls.
 *
 * Type II component: reads/writes CSS custom properties on the prose container.
 * No EventBus needed for this demo (single-element, no cross-component state).
 *
 * Sliders change rhythm in real time. Preset buttons set all three controls.
 * Font switcher overrides --ts-font-body / --ts-font-heading. Theme switcher
 * toggles the root [data-theme] attribute so tokens flip and typeset follows.
 */

export function initTypesetDemo() {
  const prose = document.querySelector('[data-ts-prose]');
  if (!prose) return () => {};

  const controls = {
    size:    document.querySelector('[data-ts-control="size"]'),
    leading: document.querySelector('[data-ts-control="leading"]'),
    flow:    document.querySelector('[data-ts-control="flow"]'),
    presets: document.querySelectorAll('[data-ts-preset]'),
    font:    document.querySelector('[data-ts-control="font"]'),
    theme:   document.querySelector('[data-ts-control="theme"]'),
  };

  const outputs = {
    size:    document.querySelector('[data-ts-output="size"]'),
    leading: document.querySelector('[data-ts-output="leading"]'),
    flow:    document.querySelector('[data-ts-output="flow"]'),
  };

  const PRESETS = {
    docs:    { size: 15, leading: 1.75, flow: 1.25 },
    blog:    { size: 16, leading: 1.6,  flow: 1.3 },
    chat:    { size: 14, leading: 1.5,  flow: 0.9 },
    slides:  { size: 18, leading: 1.3,  flow: 1 },
  };

  function apply(prop, value, unit = '') {
    prose.style.setProperty(prop, value + unit);
  }

  function syncSliders(size, leading, flow) {
    controls.size.value = size;
    controls.leading.value = leading;
    controls.flow.value = flow;
    outputs.size.textContent = size;
    outputs.leading.textContent = leading;
    outputs.flow.textContent = flow;
  }

  // Read initial values from computed style so the sliders reflect the
  // preset class currently applied to the prose container.
  const style = getComputedStyle(prose);
  syncSliders(
    parseFloat(style.getPropertyValue('--ts-size')),
    parseFloat(style.getPropertyValue('--ts-leading')),
    parseFloat(style.getPropertyValue('--ts-flow'))
  );

  // Slider handlers — instant reflow
  controls.size.addEventListener('input', () => {
    const v = controls.size.value;
    apply('--ts-size', v, 'px');
    outputs.size.textContent = v;
  });

  controls.leading.addEventListener('input', () => {
    const v = controls.leading.value;
    apply('--ts-leading', v);
    outputs.leading.textContent = v;
  });

  controls.flow.addEventListener('input', () => {
    const v = controls.flow.value;
    apply('--ts-flow', v, 'em');
    outputs.flow.textContent = v;
  });

  // Preset buttons — set all three controls at once
  controls.presets.forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = PRESETS[btn.dataset.tsPreset];
      if (!p) return;
      apply('--ts-size', p.size, 'px');
      apply('--ts-leading', p.leading);
      apply('--ts-flow', p.flow, 'em');
      syncSliders(p.size, p.leading, p.flow);
    });
  });

  // Font switcher
  controls.font?.addEventListener('change', () => {
    prose.style.setProperty('--ts-font-body', controls.font.value);
    prose.style.setProperty('--ts-font-heading', controls.font.value);
  });

  // Theme switcher — toggles root attribute, tokens flip, typeset follows
  controls.theme?.addEventListener('change', () => {
    document.documentElement.dataset.theme = controls.theme.value;
  });

  // All listeners are attached to elements owned by the demo DOM tree.
  // When the tree is removed, listeners go with it — no explicit teardown.
  return () => {};
}

// Auto-init when loaded as a standalone demo
if (document.querySelector('[data-ts-prose]')) {
  initTypesetDemo();
}
