// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMediaBrowser } from '../../src/modules/archetypes/media-browser/media-browser.js';

// Canonical serializer (deterministic — attributes sorted by name).
function serialize(node) {
  if (node.nodeType === 3) return { '#text': node.data };
  if (node.nodeType !== 1) return null;
  const attrs = {};
  for (const a of node.attributes) attrs[a.name] = a.value;
  const sorted = {};
  for (const k of Object.keys(attrs).sort()) sorted[k] = attrs[k];
  const kids = [];
  for (const c of node.childNodes) {
    if (c.nodeType === 3) { if (c.data.trim() || kids.length === 0) kids.push({ '#text': c.data }); }
    else if (c.nodeType === 1) kids.push(serialize(c));
  }
  return { t: node.tagName.toLowerCase(), a: sorted, c: kids.length ? kids : undefined };
}

const ITEMS = [
  { id: 'img1', name: 'photo.jpg', type: 'image', thumbnail: '/p.jpg', size: 1024, date: '2024-01-01' },
  { id: 'vid1', name: 'clip.mp4', type: 'video', size: 5e6, date: '2024-02-01' },
  { id: 'doc1', name: 'report.pdf', type: 'file', size: 500, date: '2024-03-01' }
];

function mountBrowser(overrides = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const browser = createMediaBrowser(container, vi.fn(), {
    items: ITEMS,
    selectable: true,
    multiSelect: true,
    emptyMessage: 'No media found',
    ...overrides
  });
  return { container, browser };
}

describe('media-browser — golden DOM (pre-Phase-3.1-C conversion)', () => {
  beforeEach(() => document.body.replaceChildren());

  it('root structure with role=region + aria-label', () => {
    const { container } = mountBrowser();
    const root = container.querySelector('.csma-media');
    expect(root.getAttribute('role')).toBe('region');
    expect(root.getAttribute('aria-label')).toBe('Media browser');
  });

  it('toolbar has search input + sort select', () => {
    const { container } = mountBrowser();
    const toolbar = container.querySelector('.csma-media__toolbar');
    expect(toolbar.querySelector('.csma-media__search')).toBeTruthy();
    expect(toolbar.querySelector('.csma-media__search').type).toBe('search');
    expect(toolbar.querySelector('.csma-media__search').placeholder).toBe('Search…');
    const sortSelect = toolbar.querySelector('.csma-media__sort');
    expect(sortSelect.tagName).toBe('SELECT');
    const opts = sortSelect.querySelectorAll('option');
    expect(opts).toHaveLength(3);
    expect(Array.from(opts).map(o => o.value)).toEqual(['name', 'date', 'size']);
  });

  it('grid has role=listbox + aria-multiselectable when multi', () => {
    const { container } = mountBrowser();
    const grid = container.querySelector('.csma-media__grid');
    expect(grid.getAttribute('role')).toBe('listbox');
    expect(grid.getAttribute('aria-multiselectable')).toBe('true');
  });

  it('image item renders thumbnail img with lazy loading', () => {
    const { container } = mountBrowser();
    const imgItem = container.querySelector('[data-item-id="img1"]');
    expect(imgItem.getAttribute('role')).toBe('option');
    expect(imgItem.tabIndex).toBe(0);
    const img = imgItem.querySelector('img.csma-media__thumbnail');
    expect(img.src).toContain('/p.jpg');
    expect(img.alt).toBe('photo.jpg');
    expect(img.loading).toBe('lazy');
    const name = imgItem.querySelector('.csma-media__name');
    expect(name.textContent).toBe('photo.jpg');
    // meta line present (size + date + type)
    const meta = imgItem.querySelector('.csma-media__meta');
    expect(meta).toBeTruthy();
    expect(meta.textContent).toContain('1 KB');
    expect(meta.textContent).toContain('image');
  });

  it('video item shows placeholder SVG icon (no thumbnail)', () => {
    const { container } = mountBrowser();
    const vidItem = container.querySelector('[data-item-id="vid1"]');
    const placeholder = vidItem.querySelector('.csma-media__thumbnail--placeholder');
    expect(placeholder).toBeTruthy();
    const svg = placeholder.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('fill')).toBe('none');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    // Video icon = polygon play triangle
    const polygon = svg.querySelector('polygon');
    expect(polygon).toBeTruthy();
    expect(polygon.getAttribute('points')).toBe('5 3 19 12 5 21 5 3');
    expect(metaContent(vidItem)).toContain('5.0 MB');
    expect(metaContent(vidItem)).toContain('video');
  });

  it('file item shows file icon path + polyline', () => {
    const { container } = mountBrowser();
    const docItem = container.querySelector('[data-item-id="doc1"]');
    const svg = docItem.querySelector('svg');
    const path = svg.querySelector('path');
    expect(path).toBeTruthy();
    expect(path.getAttribute('d')).toMatch(/^M14 2H6/);
    const polyline = svg.querySelector('polyline');
    expect(polyline.getAttribute('points')).toBe('14 2 14 8 20 8');
    expect(metaContent(docItem)).toContain('500 B');
    expect(metaContent(docItem)).toContain('file');
  });

  it('selection toggles aria-selected on item card', () => {
    const { container, browser } = mountBrowser();
    const item = container.querySelector('[data-item-id="img1"]');
    expect(item.getAttribute('aria-selected')).toBeNull();
    item.click();
    // renderGrid() re-renders after selection; re-query the updated item
    const updatedItem = container.querySelector('[data-item-id="img1"]');
    expect(updatedItem.getAttribute('aria-selected')).toBe('true');
    expect(browser.getSelected()).toEqual(['img1']);
    updatedItem.click();
    expect(browser.getSelected()).toEqual([]);
  });

  it('canonical DOM is byte-identical before/after Phase 3.1-C conversion', () => {
    const { container } = mountBrowser();
    const serialized = serialize(container.querySelector('.csma-media'));
    expect(serialized).toMatchInlineSnapshot(`
      {
        "a": {
          "aria-label": "Media browser",
          "class": "csma-media",
          "role": "region",
        },
        "c": [
          {
            "a": {
              "class": "csma-media__toolbar",
            },
            "c": [
              {
                "a": {
                  "class": "csma-media__search",
                  "placeholder": "Search…",
                  "type": "search",
                },
                "c": undefined,
                "t": "input",
              },
              {
                "a": {
                  "class": "csma-media__sort",
                },
                "c": [
                  {
                    "a": {
                      "value": "name",
                    },
                    "c": [
                      {
                        "#text": "Name",
                      },
                    ],
                    "t": "option",
                  },
                  {
                    "a": {
                      "value": "date",
                    },
                    "c": [
                      {
                        "#text": "Date",
                      },
                    ],
                    "t": "option",
                  },
                  {
                    "a": {
                      "value": "size",
                    },
                    "c": [
                      {
                        "#text": "Size",
                      },
                    ],
                    "t": "option",
                  },
                ],
                "t": "select",
              },
            ],
            "t": "div",
          },
          {
            "a": {
              "aria-multiselectable": "true",
              "class": "csma-media__grid",
              "role": "listbox",
            },
            "c": [
              {
                "a": {
                  "class": "csma-media__item",
                  "data-item-id": "vid1",
                  "role": "option",
                  "tabindex": "0",
                },
                "c": [
                  {
                    "a": {
                      "class": "csma-media__thumbnail csma-media__thumbnail--placeholder",
                    },
                    "c": [
                      {
                        "a": {
                          "aria-hidden": "true",
                          "fill": "none",
                          "focusable": "false",
                          "stroke": "currentColor",
                          "stroke-width": "1.5",
                          "viewBox": "0 0 24 24",
                        },
                        "c": [
                          {
                            "a": {
                              "points": "5 3 19 12 5 21 5 3",
                            },
                            "c": undefined,
                            "t": "polygon",
                          },
                        ],
                        "t": "svg",
                      },
                    ],
                    "t": "div",
                  },
                  {
                    "a": {
                      "class": "csma-media__info",
                    },
                    "c": [
                      {
                        "a": {
                          "class": "csma-media__name",
                        },
                        "c": [
                          {
                            "#text": "clip.mp4",
                          },
                        ],
                        "t": "div",
                      },
                      {
                        "a": {
                          "class": "csma-media__meta",
                        },
                        "c": [
                          {
                            "#text": "5.0 MB · 2024-02-01 · video",
                          },
                        ],
                        "t": "div",
                      },
                    ],
                    "t": "div",
                  },
                ],
                "t": "div",
              },
              {
                "a": {
                  "class": "csma-media__item",
                  "data-item-id": "img1",
                  "role": "option",
                  "tabindex": "0",
                },
                "c": [
                  {
                    "a": {
                      "alt": "photo.jpg",
                      "class": "csma-media__thumbnail",
                      "src": "/p.jpg",
                    },
                    "c": undefined,
                    "t": "img",
                  },
                  {
                    "a": {
                      "class": "csma-media__info",
                    },
                    "c": [
                      {
                        "a": {
                          "class": "csma-media__name",
                        },
                        "c": [
                          {
                            "#text": "photo.jpg",
                          },
                        ],
                        "t": "div",
                      },
                      {
                        "a": {
                          "class": "csma-media__meta",
                        },
                        "c": [
                          {
                            "#text": "1 KB · 2024-01-01 · image",
                          },
                        ],
                        "t": "div",
                      },
                    ],
                    "t": "div",
                  },
                ],
                "t": "div",
              },
              {
                "a": {
                  "class": "csma-media__item",
                  "data-item-id": "doc1",
                  "role": "option",
                  "tabindex": "0",
                },
                "c": [
                  {
                    "a": {
                      "class": "csma-media__thumbnail csma-media__thumbnail--placeholder",
                    },
                    "c": [
                      {
                        "a": {
                          "aria-hidden": "true",
                          "fill": "none",
                          "focusable": "false",
                          "stroke": "currentColor",
                          "stroke-width": "1.5",
                          "viewBox": "0 0 24 24",
                        },
                        "c": [
                          {
                            "a": {
                              "d": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
                            },
                            "c": undefined,
                            "t": "path",
                          },
                          {
                            "a": {
                              "points": "14 2 14 8 20 8",
                            },
                            "c": undefined,
                            "t": "polyline",
                          },
                        ],
                        "t": "svg",
                      },
                    ],
                    "t": "div",
                  },
                  {
                    "a": {
                      "class": "csma-media__info",
                    },
                    "c": [
                      {
                        "a": {
                          "class": "csma-media__name",
                        },
                        "c": [
                          {
                            "#text": "report.pdf",
                          },
                        ],
                        "t": "div",
                      },
                      {
                        "a": {
                          "class": "csma-media__meta",
                        },
                        "c": [
                          {
                            "#text": "500 B · 2024-03-01 · file",
                          },
                        ],
                        "t": "div",
                      },
                    ],
                    "t": "div",
                  },
                ],
                "t": "div",
              },
            ],
            "t": "div",
          },
          {
            "a": {
              "class": "csma-media__state",
              "data-state": "loading",
              "role": "status",
            },
            "c": [
              {
                "a": {
                  "class": "csma-media__spinner",
                },
                "c": undefined,
                "t": "div",
              },
              {
                "a": {
                  "class": "csma-media__state-message",
                },
                "c": [
                  {
                    "#text": "Loading…",
                  },
                ],
                "t": "span",
              },
            ],
            "t": "div",
          },
          {
            "a": {
              "class": "csma-media__state",
              "data-state": "empty",
              "role": "status",
            },
            "c": [
              {
                "a": {
                  "class": "csma-media__state-message",
                },
                "c": [
                  {
                    "#text": "No media found",
                  },
                ],
                "t": "span",
              },
            ],
            "t": "div",
          },
          {
            "a": {
              "class": "csma-media__state",
              "data-state": "error",
              "role": "status",
            },
            "c": [
              {
                "a": {
                  "class": "csma-media__state-message",
                },
                "c": [
                  {
                    "#text": "Failed to load",
                  },
                ],
                "t": "span",
              },
              {
                "a": {
                  "class": "csma-media__state-retry",
                },
                "c": [
                  {
                    "#text": "Retry",
                  },
                ],
                "t": "button",
              },
            ],
            "t": "div",
          },
        ],
        "t": "div",
      }
    `);
  });

  it('empty state shows message + all three state overlays exist', () => {
    const { container } = mountBrowser({ items: [] });
    const root = container.querySelector('.csma-media');
    expect(root.dataset.state).toBe('empty');
    const states = root.querySelectorAll('.csma-media__state');
    expect(states).toHaveLength(3);
    const emptyEl = root.querySelector('.csma-media__state[data-state="empty"]');
    expect(emptyEl.querySelector('.csma-media__state-message').textContent).toBe('No media found');
    const loadingEl = root.querySelector('.csma-media__state[data-state="loading"]');
    expect(loadingEl.querySelector('.csma-media__spinner')).toBeTruthy();
    const errorEl = root.querySelector('.csma-media__state[data-state="error"]');
    expect(errorEl.querySelector('.csma-media__state-retry').textContent).toBe('Retry');
  });

  it('search filters items by name (case-insensitive)', () => {
    const { container } = mountBrowser();
    const search = container.querySelector('.csma-media__search');
    search.value = 'PHOTO';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const items = container.querySelectorAll('.csma-media__item');
    expect(items).toHaveLength(1);
    expect(items[0].dataset.itemId).toBe('img1');
  });

  it('sort changes item order', () => {
    const { container } = mountBrowser();
    const sort = container.querySelector('.csma-media__sort');
    sort.value = 'size';
    sort.dispatchEvent(new Event('change', { bubbles: true }));
    const ids = Array.from(container.querySelectorAll('.csma-media__item')).map(el => el.dataset.itemId);
    // Ascending size: doc1(500) < img1(1024) < vid1(5e6)
    expect(ids).toEqual(['doc1', 'img1', 'vid1']);
  });

  it('update() replaces items + re-renders grid', () => {
    const { container, browser } = mountBrowser();
    browser.update([{ id: 'new', name: 'new.png', type: 'image', thumbnail: '/n.png' }]);
    const items = container.querySelectorAll('.csma-media__item');
    expect(items).toHaveLength(1);
    expect(items[0].dataset.itemId).toBe('new');
  });

  it('destroy removes root element', () => {
    const { container, browser } = mountBrowser();
    expect(container.querySelector('.csma-media')).toBeTruthy();
    browser.destroy();
    expect(container.querySelector('.csma-media')).toBeNull();
  });
});

function metaContent(itemEl) {
  const meta = itemEl.querySelector('.csma-media__meta');
  return meta ? meta.textContent : '';
}
