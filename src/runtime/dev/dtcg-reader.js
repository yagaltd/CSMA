/**
 * CSMA DTCG Token Reader & Renderer
 *
 * Reads design-tokens.json (DTCG format) and renders visual token
 * sections into target containers.
 *
 * Usage (ES module):
 *   import { renderTokens, fetchAndRender } from './dtcg-reader.js';
 *   fetchAndRender(containerMap);              // fetches + renders
 *   renderTokens(containerMap, tokensJson);    // renders pre-fetched tokens
 *
 * containerMap keys:
 *   spacing, radius, shadow, typography, motion, misc, colors
 */

/**
 * Get px value from token extensions or compute from rem.
 */
function getPx(token) {
  if (token.$extensions?.['com.csma.px']) return token.$extensions['com.csma.px'];
  const val = String(token.$value);
  const rem = parseFloat(val);
  if (val.includes('rem') && !isNaN(rem)) return Math.round(rem * 16);
  return null;
}

/**
 * Render spacing scale into container.
 */
function renderSpacing(container, tokens) {
  if (!tokens.primitives?.spacing) return false;
  let html = '';
  for (const [name, token] of Object.entries(tokens.primitives.spacing)) {
    const px = getPx(token);
    const desc = token.$description ? ` — ${token.$description}` : '';
    html += `<div class="dtcg-token-row">
      <code style="width:120px; font-size:var(--font-size-xs); flex-shrink:0;">--space-${name}</code>
      <div class="dtcg-bar" style="width:var(--space-${name});"></div>
      <span style="font-size:var(--font-size-xs); color:var(--foreground-muted); white-space:nowrap;">${px ? px + 'px' : token.$value}${desc}</span>
    </div>`;
  }
  container.innerHTML = html;
  return true;
}

/**
 * Render border radius scale into container.
 */
function renderRadius(container, tokens) {
  if (!tokens.primitives?.radius) return false;
  let html = '';
  for (const [name, token] of Object.entries(tokens.primitives.radius)) {
    html += `<div style="text-align:center;">
      <div style="width:3rem; height:3rem; background:var(--primary); border-radius:var(--radius-${name});"></div>
      <div class="dtcg-label">--radius-${name}</div>
      <div class="dtcg-meta">${token.$value}</div>
    </div>`;
  }
  container.innerHTML = html;
  return true;
}

/**
 * Render shadow scale into container.
 */
function renderShadow(container, tokens) {
  if (!tokens.primitives?.shadow) return false;
  let html = '';
  for (const [name, token] of Object.entries(tokens.primitives.shadow)) {
    const desc = token.$description || '';
    html += `<div style="padding:var(--space-lg); background:var(--surface); border-radius:var(--radius-lg); box-shadow:var(--shadow-${name});">
      <div class="dtcg-label">--shadow-${name}</div>
      ${desc ? `<div class="dtcg-meta" style="margin-top:var(--space-xs);">${desc}</div>` : ''}
    </div>`;
  }
  container.innerHTML = html;
  return true;
}

/**
 * Render typography tokens into container.
 */
function renderTypography(container, tokens) {
  if (!tokens.primitives?.typography) return false;
  const typo = tokens.primitives.typography;
  let html = '';

  // Font families
  if (typo.fontFamily) {
    html += `<p style="font-size:var(--font-size-xs); color:var(--foreground-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:var(--space-sm);">Font Families</p>`;
    html += `<div class="dtcg-row" style="margin-bottom:var(--space-lg);">`;
    for (const [name, token] of Object.entries(typo.fontFamily)) {
      html += `<div style="font-family:var(--font-${name}); padding:var(--space-sm) var(--space-md); background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md);">
        <div style="font-size:var(--font-size-sm);">--font-${name}</div>
        <div class="dtcg-meta" style="margin-top:var(--space-xs);">${token.$value}</div>
      </div>`;
    }
    html += `</div>`;
  }

  // Font sizes
  if (typo.fontSize) {
    html += `<p style="font-size:var(--font-size-xs); color:var(--foreground-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:var(--space-sm);">Font Sizes</p>`;
    html += `<div style="display:flex; flex-direction:column; gap:var(--space-xs); margin-bottom:var(--space-lg);">`;
    for (const [name, token] of Object.entries(typo.fontSize)) {
      const px = getPx(token);
      html += `<div class="dtcg-token-row">
        <code style="width:120px; font-size:var(--font-size-xs); flex-shrink:0;">--font-size-${name}</code>
        <span style="font-size:var(--font-size-${name}); line-height:1;">Aa</span>
        <span style="font-size:var(--font-size-xs); color:var(--foreground-muted);">${px ? px + 'px' : ''} ${token.$value}</span>
      </div>`;
    }
    html += `</div>`;
  }

  // Font weights
  if (typo.fontWeight) {
    html += `<p style="font-size:var(--font-size-xs); color:var(--foreground-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:var(--space-sm);">Font Weights</p>`;
    html += `<div class="dtcg-row" style="margin-bottom:var(--space-lg);">`;
    for (const [name, token] of Object.entries(typo.fontWeight)) {
      html += `<span style="font-weight:var(--font-weight-${name}); font-size:var(--font-size-lg);">${name} (${token.$value})</span>`;
    }
    html += `</div>`;
  }

  // Line heights
  if (typo.lineHeight) {
    html += `<p style="font-size:var(--font-size-xs); color:var(--foreground-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:var(--space-sm);">Line Heights</p>`;
    html += `<div class="dtcg-row">`;
    for (const [name, token] of Object.entries(typo.lineHeight)) {
      html += `<div style="padding:var(--space-sm); background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md);">
        <code style="font-size:var(--font-size-xs);">--line-height-${name}</code>
        <div style="line-height:var(--line-height-${name}); font-size:var(--font-size-sm); margin-top:var(--space-xs);">The quick brown fox</div>
      </div>`;
    }
    html += `</div>`;
  }

  container.innerHTML = html;
  return true;
}

/**
 * Render motion tokens into container.
 */
function renderMotion(container, tokens) {
  if (!tokens.primitives?.motion) return false;
  const motion = tokens.primitives.motion;
  let html = '';

  if (motion.duration) {
    html += `<p style="font-size:var(--font-size-xs); color:var(--foreground-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:var(--space-sm);">Durations</p>`;
    html += `<div class="dtcg-row" style="margin-bottom:var(--space-lg);">`;
    for (const [name, token] of Object.entries(motion.duration)) {
      const desc = token.$description ? ` (${token.$description})` : '';
      html += `<div style="padding:var(--space-sm) var(--space-md); background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md);">
        <code style="font-size:var(--font-size-xs);">--motion-duration-${name}</code>
        <div style="font-size:var(--font-size-sm); margin-top:var(--space-xs);">${token.$value}${desc}</div>
      </div>`;
    }
    html += `</div>`;
  }

  if (motion.easing) {
    html += `<p style="font-size:var(--font-size-xs); color:var(--foreground-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:var(--space-sm);">Easing</p>`;
    html += `<div class="dtcg-row">`;
    for (const [name, token] of Object.entries(motion.easing)) {
      const val = Array.isArray(token.$value) ? `cubic-bezier(${token.$value.join(', ')})` : token.$value;
      html += `<div style="padding:var(--space-sm) var(--space-md); background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md);">
        <code style="font-size:var(--font-size-xs);">--ease-${name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}</code>
        <div class="dtcg-meta" style="margin-top:var(--space-xs);">${val}</div>
      </div>`;
    }
    html += `</div>`;
  }

  container.innerHTML = html;
  return true;
}

/**
 * Render breakpoints + z-index into container.
 */
function renderMisc(container, tokens) {
  if (!tokens.primitives?.breakpoint && !tokens.primitives?.zIndex) return false;
  let html = '';

  if (tokens.primitives.breakpoint) {
    html += `<p style="font-size:var(--font-size-xs); color:var(--foreground-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:var(--space-sm);">Breakpoints</p>`;
    html += `<div class="dtcg-row" style="margin-bottom:var(--space-lg);">`;
    for (const [name, token] of Object.entries(tokens.primitives.breakpoint)) {
      html += `<div style="padding:var(--space-sm) var(--space-md); background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md);">
        <code style="font-size:var(--font-size-xs);">--breakpoint-${name}</code>
        <div style="font-size:var(--font-size-sm); margin-top:var(--space-xs);">${token.$value}</div>
      </div>`;
    }
    html += `</div>`;
  }

  if (tokens.primitives.zIndex) {
    html += `<p style="font-size:var(--font-size-xs); color:var(--foreground-muted); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:var(--space-sm);">Z-Index Layers</p>`;
    html += `<div class="dtcg-row">`;
    for (const [name, token] of Object.entries(tokens.primitives.zIndex)) {
      html += `<div style="padding:var(--space-sm) var(--space-md); background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md);">
        <code style="font-size:var(--font-size-xs);">--z-${name}</code>
        <div style="font-size:var(--font-size-sm); margin-top:var(--space-xs);">${token.$value}</div>
      </div>`;
    }
    html += `</div>`;
  }

  container.innerHTML = html;
  return true;
}

/**
 * Render color swatches into container.
 */
function renderColors(container, tokens) {
  if (!tokens.themes?.light?.colors) return false;
  let html = '<div class="dtcg-swatch-grid">';
  for (const [name, token] of Object.entries(tokens.themes.light.colors)) {
    const desc = token.$description || '';
    const cssName = '--' + name.replace(/([A-Z])/g, '-$1').toLowerCase();
    html += `<div class="dtcg-swatch-item">
      <div class="dtcg-swatch" style="background:var(${cssName});"></div>
      <div class="dtcg-label">${cssName}</div>
      <div class="dtcg-meta">${token.$value}</div>
      ${desc ? `<div style="font-size:10px; color:var(--foreground-muted);">${desc}</div>` : ''}
    </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
  return true;
}

// Section renderer map
const renderers = {
  spacing: renderSpacing,
  radius: renderRadius,
  shadow: renderShadow,
  typography: renderTypography,
  motion: renderMotion,
  misc: renderMisc,
  colors: renderColors,
};

/**
 * Render all token sections using the provided container map and tokens JSON.
 *
 * @param {Object} containerMap - { spacing: Element, radius: Element, ... }
 * @param {Object} tokens - Parsed design-tokens.json
 * @returns {Object} results - { spacing: true, radius: false, ... }
 */
export function renderTokens(containerMap, tokens) {
  const results = {};
  for (const [key, renderer] of Object.entries(renderers)) {
    const container = containerMap[key];
    if (container) {
      results[key] = renderer(container, tokens);
    }
  }
  return results;
}

/**
 * Fetch design-tokens.json and render into containers.
 *
 * @param {Object} containerMap - { spacing: Element, radius: Element, ... }
 * @param {string} [url='design-tokens.json'] - URL to fetch tokens from
 * @returns {Promise<{tokens: Object, results: Object}|null>}
 */
export async function fetchAndRender(containerMap, url = 'design-tokens.json') {
  let tokens;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    tokens = await resp.json();
  } catch (e) {
    console.warn('DTCG reader: could not fetch', url, ':', e.message);
    return null;
  }

  const results = renderTokens(containerMap, tokens);
  return { tokens, results };
}
