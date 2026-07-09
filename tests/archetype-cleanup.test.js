// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOverlayManager } from '../src/modules/archetypes/overlay-manager/overlay-manager.js';
import { createStatsDashboard } from '../src/modules/archetypes/stats-dashboard/stats-dashboard.js';
import { createViewer } from '../src/modules/archetypes/viewer/viewer.js';

function mount() {
  const container = document.createElement('section');
  document.body.appendChild(container);
  return container;
}

function renderViewer(data, options = {}) {
  const container = mount();
  const viewer = createViewer(container, vi.fn(), options);
  viewer.update(data);
  return {
    container,
    viewer,
    content: container.querySelector('.csma-viewer__content')
  };
}

describe('stats dashboard cleanup behavior', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('does not create an empty canvas placeholder when there are no charts', () => {
    const container = mount();

    createStatsDashboard(container, vi.fn(), {
      cards: [{ id: 'visitors', label: 'Visitors' }],
      charts: []
    });

    expect(container.querySelector('.csma-stats__chart-canvas')).toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('.csma-stats__charts').hasAttribute('hidden')).toBe(true);
  });

  it('updates visible card values from supplied data', () => {
    const container = mount();
    const dashboard = createStatsDashboard(container, vi.fn(), {
      cards: [{ id: 'visitors', label: 'Visitors' }]
    });

    dashboard.update({ visitors: { value: 1099 } });

    expect(container.querySelector('[data-card-id="visitors"] .csma-stats__card-value').textContent).toBe('1,099');
  });

  it('mounts the node returned by renderChart for configured charts', () => {
    const container = mount();
    const renderChart = vi.fn((chartDef, { container: chartContainer }) => {
      const node = document.createElement('output');
      node.className = 'custom-chart-node';
      node.textContent = `${chartDef.id} mounted in ${chartContainer.dataset.chartId}`;
      return node;
    });

    createStatsDashboard(container, vi.fn(), {
      cards: [],
      charts: [{ id: 'traffic', label: 'Traffic' }],
      renderChart
    });

    expect(renderChart).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-chart-id="traffic"] .custom-chart-node').textContent).toBe('traffic mounted in traffic');
    expect(container.querySelector('[data-chart-id="traffic"] .csma-stats__chart-summary')).toBeNull();
  });

  it('renders an accessible textual chart summary when no chart renderer is provided', () => {
    const container = mount();

    createStatsDashboard(container, vi.fn(), {
      cards: [],
      charts: [{ id: 'traffic', label: 'Traffic', description: 'Traffic over the last seven days' }]
    });

    expect(container.querySelector('[data-chart-id="traffic"] .csma-stats__chart-summary').textContent).toBe('Traffic over the last seven days');
    expect(container.querySelector('[data-chart-id="traffic"] canvas')).toBeNull();
  });
});

describe('overlay manager text-only content behavior', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('renders tag-like modal strings as literal text instead of DOM nodes', () => {
    const literal = '<img src=x onerror=alert(1)>';
    const manager = createOverlayManager(mount(), vi.fn());

    const { el } = manager.openModal(literal, { title: 'Unsafe content' });
    const body = el.querySelector('.csma-overlay-body');

    expect(body.textContent).toBe(literal);
    expect(body.querySelector('img')).toBeNull();
    expect(document.body.querySelector('img')).toBeNull();

    manager.destroy();
  });
});

describe('viewer cleanup sanitization behavior', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('removes href from markdown links that use a dangerous protocol', () => {
    const { content } = renderViewer('[Unsafe link](javascript:alert(1))', { markdown: true });
    const link = content.querySelector('a');

    expect(link.textContent).toBe('Unsafe link');
    expect(link.hasAttribute('href')).toBe(false);
    expect(content.textContent).toContain('Unsafe link');
  });

  it('removes scripts and event-handler attributes from HTML content', () => {
    const { content } = renderViewer(
      '<p onclick="alert(1)">Hello</p><script>window.__xss = true</script><img src="https://example.com/safe.png" alt="safe" onerror="alert(1)">',
      { markdown: false }
    );

    expect(content.querySelector('script')).toBeNull();
    expect(content.querySelector('p').hasAttribute('onclick')).toBe(false);
    expect(content.querySelector('img').getAttribute('src')).toBe('https://example.com/safe.png');
    expect(content.querySelector('img').hasAttribute('onerror')).toBe(false);
    expect(content.textContent).toContain('Hello');
  });

  it('sanitizes descendants when removing nested disallowed wrappers', () => {
    const { content } = renderViewer(
      '<custom-wrapper><nested-box><a href="javascript:alert(1)" onclick="alert(1)">Bad link</a><img src="javascript:alert(1)" onerror="alert(1)" alt="nested"><span onmouseover="alert(1)">Safe text</span></nested-box></custom-wrapper>',
      { markdown: false }
    );
    const link = content.querySelector('a');
    const image = content.querySelector('img');
    const span = content.querySelector('span');

    expect(content.querySelector('custom-wrapper')).toBeNull();
    expect(link.textContent).toBe('Bad link');
    expect(link.hasAttribute('href')).toBe(false);
    expect(link.hasAttribute('onclick')).toBe(false);
    expect(image.getAttribute('alt')).toBe('nested');
    expect(image.hasAttribute('src')).toBe(false);
    expect(image.hasAttribute('onerror')).toBe(false);
    expect(span.textContent).toBe('Safe text');
    expect(span.hasAttribute('onmouseover')).toBe(false);
  });

  it('preserves safe markdown headings, lists, and links', () => {
    const { content } = renderViewer('# Release notes\n- Added chart summaries\n[Docs](https://example.com/docs)', { markdown: true });
    const link = content.querySelector('a');

    expect(content.querySelector('h1').textContent).toBe('Release notes');
    expect(content.querySelector('li').textContent).toBe('Added chart summaries');
    expect(link.textContent).toBe('Docs');
    expect(link.getAttribute('href')).toBe('https://example.com/docs');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('renders plain text fields containing tag-like text without creating DOM nodes', () => {
    const literal = '<strong>literal only</strong><img src=x onerror=alert(1)>';
    const { content } = renderViewer({ text: literal });

    expect(content.textContent).toBe(literal);
    expect(content.querySelector('strong')).toBeNull();
    expect(content.querySelector('img')).toBeNull();
  });
});
