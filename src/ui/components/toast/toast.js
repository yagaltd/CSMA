/**
 * CSMA Toast Component
 * Secure notification system using EventBus
 * 
 * ECCA Metadata:
 * - Version: 2.0.0
 * - Type: component
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Security: Uses textContent instead of innerHTML for user content
 * Contracts: INTENT_TOAST_SHOW, TOAST_SHOWN, TOAST_DISMISSED
 */

let toastCounter = 0;

// SVG icons (static, safe content)
const toastIcons = {
  default: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>',
  success: '<svg viewBox="0 0 20 20" fill="#15803d"><path d="M16.707 5.293a1 1 0 010 1.414l-7.364 7.364a1 1 0 01-1.414 0L3.293 9.435a1 1 0 111.414-1.414l3.222 3.222 6.657-6.657a1 1 0 011.414 0z"/></svg>',
  error: '<svg viewBox="0 0 20 20" fill="#dc2626"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
  warning: '<svg viewBox="0 0 20 20" fill="#a16207"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>'
};

/**
 * Initialize Toast system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initToastSystem(eventBus) {
  if (!eventBus) {
    console.warn('[Toast] EventBus not provided, Toast system not initialized');
    return () => { };
  }

  console.log('[Toast] Initializing CSMA Toast system...');

  // Subscribe to toast show intents
  const unsubscribe = eventBus.subscribe('INTENT_TOAST_SHOW', (payload) => {
    try {
      const toastId = showToast({
        type: payload.type || 'default',
        title: payload.title || '',
        description: payload.description || '',
        duration: payload.duration !== undefined ? payload.duration : 3000
      });

      // Publish toast shown event
      eventBus.publish('TOAST_SHOWN', {
        toastId,
        type: payload.type || 'default',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('[Toast] Failed to show toast:', error);
    }
  });

  console.log('[Toast] Toast system initialized ✓');

  // Return cleanup function
  return () => {
    unsubscribe();
    console.log('[Toast] Toast system cleaned up');
  };
}

/**
 * Show a toast notification (internal function)
 * @param {Object} options - Toast options
 * @param {string} options.type - default|success|error|warning
 * @param {string} options.title - Toast title
 * @param {string} options.description - Toast description
 * @param {number} options.duration - Auto-dismiss duration in ms
 * @returns {string} Toast ID
 */
function showToast({ type = 'default', title = '', description = '', duration = 3000 }) {
  const container = document.getElementById('toastContainer') || createToastContainer();
  const id = `toast-${++toastCounter}`;

  // ✅ Create toast element safely
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.dataset.toastId = id;
  toast.dataset.state = 'open';

  // Create structure safely (no innerHTML with user data!)
  const iconDiv = document.createElement('div');
  iconDiv.className = 'toast-icon';
  // ✅ SAFE: Static SVG icons only
  iconDiv.innerHTML = toastIcons[type] || toastIcons.default;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'toast-content';

  const titleDiv = document.createElement('div');
  titleDiv.className = 'toast-title';
  // ✅ SAFE: Use textContent for user-provided title
  titleDiv.textContent = title;

  const descDiv = document.createElement('div');
  descDiv.className = 'toast-description';
  // ✅ SAFE: Use textContent for user-provided description
  descDiv.textContent = description;

  contentDiv.appendChild(titleDiv);
  contentDiv.appendChild(descDiv);

  const closeButton = document.createElement('button');
  closeButton.className = 'toast-close';
  closeButton.setAttribute('aria-label', 'Close toast');
  closeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.5 3.5L3.5 12.5M3.5 3.5l9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
    `;

  // Assemble toast
  toast.appendChild(iconDiv);
  toast.appendChild(contentDiv);
  toast.appendChild(closeButton);

  // Close button handler
  closeButton.addEventListener('click', () => dismissToast(id));

  container.appendChild(toast);

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }

  return id;
}

/**
 * Dismiss a toast by ID
 */
function dismissToast(id) {
  const toast = document.querySelector(`[data-toast-id="${id}"]`);
  if (toast) {
    toast.dataset.state = 'closed';
    setTimeout(() => toast.remove(), 300);
  }
}

/**
 * Create toast container if it doesn't exist
 */
function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toastContainer';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// Export for component initialization
export { showToast, dismissToast };

