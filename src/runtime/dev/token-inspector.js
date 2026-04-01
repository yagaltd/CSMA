/**
 * CSMA Token Inspector
 * Dev tool to inspect design tokens on any element
 * 
 * Usage:
 * 1. Click "Inspect Tokens" button in toolbar
 * 2. Hover elements - they highlight green with selector shown
 * 3. Click element - popover shows its CSS tokens
 * 4. Press Escape or click X to close
 */

(function() {
  // State
  let isActive = false;
  let highlightOverlay = null;
  let selectorTooltip = null;
  let inspectorPopover = null;
  let highlightedElement = null;

  // Create toolbar button
  function createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'token-inspector-toolbar';
    toolbar.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999;
      display: flex;
      gap: 8px;
      align-items: center;
    `;
    
    const button = document.createElement('button');
    button.id = 'token-inspector-toggle';
    button.textContent = 'Inspect Tokens';
    button.style.cssText = `
      background: var(--primary, #000);
      color: var(--primary-foreground, #fff);
      border: none;
      padding: 8px 16px;
      border-radius: var(--radius-md, 6px);
      font-size: 13px;
      font-family: var(--font-family-base, system-ui, sans-serif);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: opacity 0.15s;
    `;
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 16v-4"></path>
        <path d="M12 8h.01"></path>
      </svg>
      Inspect Tokens
    `;
    
    button.addEventListener('click', toggleInspector);
    toolbar.appendChild(button);
    document.body.appendChild(toolbar);
    
    return button;
  }

  // Create highlight overlay
  function createHighlightOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'token-inspector-highlight';
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 9998;
      border: 2px solid #22c55e;
      border-radius: 4px;
      background: rgba(34, 197, 94, 0.08);
      display: none;
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  // Create selector tooltip
  function createSelectorTooltip() {
    const tooltip = document.createElement('div');
    tooltip.id = 'token-inspector-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      z-index: 9999;
      background: #1f2937;
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 11px;
      pointer-events: none;
      white-space: nowrap;
      display: none;
    `;
    document.body.appendChild(tooltip);
    return tooltip;
  }

  // Create inspector popover
  function createPopover() {
    const popover = document.createElement('div');
    popover.id = 'token-inspector-popover';
    popover.style.cssText = `
      position: fixed;
      z-index: 10000;
      background: var(--surface, #fff);
      border: 1px solid var(--border, #e5e7eb);
      border-radius: var(--radius-lg, 8px);
      box-shadow: var(--shadow-xl, 0 20px 25px -5px rgba(0,0,0,0.1));
      padding: 16px;
      max-width: 360px;
      max-height: 400px;
      font-family: var(--font-family-base, system-ui, sans-serif);
      font-size: 13px;
      color: var(--foreground, #111);
      display: none;
      overflow-y: auto;
    `;
    popover.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <div style="font-size: 11px; color: var(--foreground-muted, #6b7280); text-transform: uppercase; letter-spacing: 0.05em;">Element</div>
          <div class="inspector-selector" style="font-family: monospace; font-size: 12px; color: var(--primary, #3b82f6); margin-top: 2px;"></div>
        </div>
        <button class="inspector-close" style="background: none; border: none; cursor: pointer; font-size: 20px; color: var(--foreground-muted, #6b7280); padding: 0; line-height: 1;">×</button>
      </div>
      <div style="border-top: 1px solid var(--border, #e5e7eb); margin: -4px -16px 12px; padding: 0 16px;"></div>
      <div style="font-size: 11px; color: var(--foreground-muted, #6b7280); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Design Tokens</div>
      <div class="inspector-tokens" style="max-height: 250px; overflow-y: auto;"></div>
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border, #e5e7eb);">
        <button class="inspector-copy" style="width: 100%; background: var(--primary, #000); color: var(--primary-foreground, #fff); border: none; padding: 8px 16px; border-radius: var(--radius-md, 6px); cursor: pointer; font-size: 12px; font-weight: 500;">Copy CSS Variables</button>
      </div>
    `;
    document.body.appendChild(popover);
    
    // Wire up close button
    popover.querySelector('.inspector-close').addEventListener('click', hidePopover);
    popover.querySelector('.inspector-copy').addEventListener('click', copyCSS);
    
    return popover;
  }

  // Get element selector
  function getSelector(element) {
    if (!element || element === document.body || element === document.documentElement) {
      return 'body';
    }
    
    const tag = element.tagName.toLowerCase();
    
    // Try ID first
    if (element.id) {
      return `#${element.id}`;
    }
    
    // Get classes
    const classes = element.className && typeof element.className === 'string' 
      ? element.className.split(' ').filter(c => c && !c.startsWith('proto-')).slice(0, 2)
      : [];
    
    // Get data attributes
    const dataAttrs = [];
    if (element.dataset?.variant) dataAttrs.push(`[variant="${element.dataset.variant}"]`);
    if (element.dataset?.size) dataAttrs.push(`[size="${element.dataset.size}"]`);
    
    // Build selector
    let selector = tag;
    if (classes.length > 0) {
      selector += '.' + classes.join('.');
    }
    if (dataAttrs.length > 0) {
      selector += dataAttrs.join('');
    }
    
    return selector;
  }

  // Get CSS custom properties for an element
  function getTokenProperties(element) {
    if (!element) return [];
    
    const computed = getComputedStyle(element);
    const tokens = [];
    
    // Token prefixes we care about
    const prefixes = [
      '--space-', '--font-', '--line-height-', '--radius-', '--shadow-',
      '--motion-', '--ease-', '--transition-', 
      '--button-', '--input-', '--card-', '--dialog-', '--navbar-', '--badge-',
      '--background', '--foreground', '--surface', '--border', '--primary',
      '--secondary', '--accent', '--destructive', '--success', '--warning', '--info',
      '--muted', '--overlay', '--ring', '--text'
    ];
    
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      if (prop.startsWith('--')) {
        const matches = prefixes.some(p => prop.startsWith(p));
        if (matches) {
          const value = computed.getPropertyValue(prop).trim();
          if (value && value !== 'none' && value !== '') {
            tokens.push({ property: prop, value });
          }
        }
      }
    }
    
    return tokens.sort((a, b) => a.property.localeCompare(b.property));
  }

  // Convert rem to px
  function toPx(value) {
    if (value.endsWith('rem')) {
      return `${Math.round(parseFloat(value) * 16)}px`;
    }
    return null;
  }

  // Render tokens in popover
  function renderTokens(tokens) {
    const container = inspectorPopover.querySelector('.inspector-tokens');
    
    if (tokens.length === 0) {
      container.innerHTML = '<div style="color: var(--foreground-muted, #6b7280); font-style: italic; padding: 8px 0;">No design tokens found</div>';
      return;
    }
    
    container.innerHTML = tokens.map(({ property, value }) => {
      const px = toPx(value);
      const pxDisplay = px ? `<span style="color: var(--foreground-muted, #6b7280); font-size: 11px;"> (${px})</span>` : '';
      return `
        <div style="padding: 6px 0; border-bottom: 1px solid var(--border, #e5e7eb);">
          <div style="font-family: monospace; font-size: 11px; color: var(--primary, #3b82f6);">${property}</div>
          <div style="font-size: 13px; margin-top: 2px; color: var(--foreground, #111);">${value}${pxDisplay}</div>
        </div>
      `;
    }).join('');
  }

  // Position popover above element
  function positionPopover(element) {
    const rect = element.getBoundingClientRect();
    const popoverHeight = 400; // max-height
    
    let top = rect.top - popoverHeight - 12;
    let left = rect.left;
    
    // If not enough space above, show below
    if (top < 10) {
      top = rect.bottom + 12;
    }
    
    // Keep within viewport
    left = Math.max(10, Math.min(left, window.innerWidth - 370));
    top = Math.max(10, Math.min(top, window.innerHeight - popoverHeight - 10));
    
    inspectorPopover.style.top = `${top}px`;
    inspectorPopover.style.left = `${left}px`;
  }

  // Show popover
  function showPopover(element) {
    if (!inspectorPopover) {
      inspectorPopover = createPopover();
    }
    
    highlightedElement = element;
    
    // Update selector display
    const selector = getSelector(element);
    inspectorPopover.querySelector('.inspector-selector').textContent = selector;
    
    // Get and render tokens
    const tokens = getTokenProperties(element);
    renderTokens(tokens);
    
    // Position and show
    positionPopover(element);
    inspectorPopover.style.display = 'block';
  }

  // Hide popover
  function hidePopover() {
    if (inspectorPopover) {
      inspectorPopover.style.display = 'none';
    }
    highlightedElement = null;
  }

  // Copy CSS
  function copyCSS() {
    if (!highlightedElement) return;
    
    const tokens = getTokenProperties(highlightedElement);
    const selector = getSelector(highlightedElement);
    
    const css = tokens
      .map(({ property, value }) => `${property}: ${value};`)
      .join('\n');
    
    const full = `/* ${selector} */\n${css}`;
    
    navigator.clipboard.writeText(full).then(() => {
      const btn = inspectorPopover.querySelector('.inspector-copy');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy CSS Variables', 1200);
    });
  }

  // Highlight element
  function highlightElement(element) {
    if (!highlightOverlay) {
      highlightOverlay = createHighlightOverlay();
    }
    if (!selectorTooltip) {
      selectorTooltip = createSelectorTooltip();
    }
    
    const rect = element.getBoundingClientRect();
    const selector = getSelector(element);
    
    // Position highlight overlay
    highlightOverlay.style.top = `${rect.top}px`;
    highlightOverlay.style.left = `${rect.left}px`;
    highlightOverlay.style.width = `${rect.width}px`;
    highlightOverlay.style.height = `${rect.height}px`;
    highlightOverlay.style.display = 'block';
    
    // Position selector tooltip above
    selectorTooltip.textContent = selector;
    selectorTooltip.style.top = `${rect.top - 28}px`;
    selectorTooltip.style.left = `${rect.left}px`;
    selectorTooltip.style.display = 'block';
    
    highlightedElement = element;
  }

  // Clear highlight
  function clearHighlight() {
    if (highlightOverlay) {
      highlightOverlay.style.display = 'none';
    }
    if (selectorTooltip) {
      selectorTooltip.style.display = 'none';
    }
    highlightedElement = null;
  }

  // Toggle inspector
  function toggleInspector() {
    isActive = !isActive;
    
    const button = document.getElementById('token-inspector-toggle');
    
    if (isActive) {
      button.style.background = '#22c55e';
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
        Stop Inspecting
      `;
      document.body.style.cursor = 'crosshair';
    } else {
      button.style.background = '';
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
        Inspect Tokens
      `;
      document.body.style.cursor = '';
      clearHighlight();
      hidePopover();
    }
  }

  // Handle mouseover
  function handleMouseOver(e) {
    if (!isActive) return;
    
    // Ignore toolbar and popover
    if (e.target.closest('#token-inspector-toolbar') || 
        e.target.closest('#token-inspector-popover') ||
        e.target.closest('#token-inspector-highlight')) {
      return;
    }
    
    // Don't highlight html/body
    if (e.target === document.body || e.target === document.documentElement) {
      clearHighlight();
      return;
    }
    
    highlightElement(e.target);
  }

  // Handle click
  function handleClick(e) {
    if (!isActive) return;
    
    // Ignore clicks on toolbar/popover
    if (e.target.closest('#token-inspector-toolbar') || 
        e.target.closest('#token-inspector-popover')) {
      return;
    }
    
    // Ignore if clicking on html/body
    if (e.target === document.body || e.target === document.documentElement) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    showPopover(e.target);
  }

  // Handle escape
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (inspectorPopover && inspectorPopover.style.display === 'block') {
        hidePopover();
      } else if (isActive) {
        toggleInspector();
      }
    }
  }

  // Initialize
  function init() {
    // Only on localhost or with ?inspect=true
    const isDev = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.search.includes('inspect=true');
    
    if (!isDev) return;
    
    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    
    createToolbar();
    
    // Add event listeners
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown);
    
    console.log('✨ Token Inspector ready. Click "Inspect Tokens" to activate.');
  }

  init();
})();