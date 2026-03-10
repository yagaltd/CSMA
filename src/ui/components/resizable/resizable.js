/**
 * CSMA Resizable Component
 * Panels with draggable resize handles using EventBus
 * 
 * Contracts: INTENT_RESIZE_PANEL, RESIZE_CHANGED, PANEL_COLLAPSED
 */

/**
 * Initialize Resizable system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initResizableSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Resizable] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const resizableContainers = document.querySelectorAll('.resizable');

    resizableContainers.forEach(container => {
        const cleanup = initResizable(container, eventBus);
        cleanups.push(cleanup);
    });

    const unsubscribe = eventBus.subscribe('INTENT_RESIZE_PANEL', (payload) => {
        const container = document.getElementById(payload.containerId);
        if (container) {
            const panel = container.querySelectorAll('.resizable-panel')[payload.panelIndex];
            if (panel) {
                setPanelSize(panel, payload.size, container.dataset.orientation);
            }
        }
    });

    return () => {
        unsubscribe();
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single resizable container
 */
function initResizable(container, eventBus) {
    const eventHandlers = [];
    const handles = container.querySelectorAll('.resizable-handle');
    const panels = container.querySelectorAll('.resizable-panel');
    const orientation = container.dataset.orientation || 'horizontal';

    handles.forEach((handle, index) => {
        const dragOverlay = document.createElement('div');
        dragOverlay.className = 'resizable-drag-overlay';
        dragOverlay.style.display = 'none';

        let isDragging = false;
        let startPos = 0;
        let startSizes = [];

        const startDrag = (e) => {
            e.preventDefault();
            isDragging = true;
            handle.dataset.active = 'true';

            // Get current sizes
            startSizes = Array.from(panels).map(panel => {
                if (orientation === 'horizontal') {
                    return panel.offsetWidth;
                } else {
                    return panel.offsetHeight;
                }
            });

            // Starting position
            startPos = orientation === 'horizontal' ? e.clientX : e.clientY;

            // Show overlay to capture events
            dragOverlay.style.display = 'block';
            dragOverlay.style.cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';
            document.body.appendChild(dragOverlay);

            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchmove', onDrag, { passive: false });
            document.addEventListener('touchend', stopDrag);
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const clientPos = orientation === 'horizontal' 
                ? (e.clientX || e.touches?.[0]?.clientX)
                : (e.clientY || e.touches?.[0]?.clientY);

            const delta = clientPos - startPos;

            // Get panels on either side of handle
            const prevPanel = panels[index];
            const nextPanel = panels[index + 1];

            if (!prevPanel || !nextPanel) return;

            // Calculate new sizes
            const minSize = 50; // Minimum panel size
            const newPrevSize = Math.max(minSize, startSizes[index] + delta);
            const newNextSize = Math.max(minSize, startSizes[index + 1] - delta);

            // Check if resize is valid
            if (startSizes[index] + startSizes[index + 1] < newPrevSize + newNextSize) return;

            // Apply sizes
            if (orientation === 'horizontal') {
                prevPanel.style.flex = `0 0 ${newPrevSize}px`;
                nextPanel.style.flex = `0 0 ${newNextSize}px`;
            } else {
                prevPanel.style.flex = `0 0 ${newPrevSize}px`;
                nextPanel.style.flex = `0 0 ${newNextSize}px`;
            }

            // Publish live update
            eventBus.publish('RESIZE_CHANGING', {
                containerId: container.id,
                sizes: [newPrevSize, newNextSize],
                handleIndex: index,
                timestamp: Date.now()
            });
        };

        const stopDrag = () => {
            if (!isDragging) return;
            isDragging = false;
            handle.dataset.active = 'false';

            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchmove', onDrag);
            document.removeEventListener('touchend', stopDrag);

            if (dragOverlay.parentNode) {
                dragOverlay.parentNode.removeChild(dragOverlay);
            }

            // Publish final sizes
            const sizes = Array.from(panels).map(panel => {
                return orientation === 'horizontal' ? panel.offsetWidth : panel.offsetHeight;
            });

            eventBus.publish('RESIZE_CHANGED', {
                containerId: container.id,
                sizes,
                handleIndex: index,
                timestamp: Date.now()
            });

            // Auto-save if enabled
            if (container.dataset.autoSave === 'true') {
                saveSizes(container, sizes);
            }
        };

        handle.addEventListener('mousedown', startDrag);
        handle.addEventListener('touchstart', startDrag, { passive: false });
        eventHandlers.push({ element: handle, event: 'mousedown', handler: startDrag });
        eventHandlers.push({ element: handle, event: 'touchstart', handler: startDrag });

        // Add keyboard support for handles
        handle.tabIndex = 0;
        handle.setAttribute('role', 'slider');
        handle.setAttribute('aria-orientation', orientation);

        const handleKeyDown = (e) => {
            const step = parseInt(handle.dataset.step) || 10;
            const minSize = parseInt(handle.dataset.minSize) || 50;
            const maxSize = parseInt(handle.dataset.maxSize) || Infinity;
            const snapPoints = handle.dataset.snapPoints
                ? handle.dataset.snapPoints.split(',').map(s => parseInt(s.trim()))
                : [];

            let delta = 0;

            if (orientation === 'horizontal') {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                    delta = step;
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                    delta = -step;
                } else if (e.key === 'Home') {
                    delta = -Infinity;
                } else if (e.key === 'End') {
                    delta = Infinity;
                } else if (e.key === 'PageUp') {
                    delta = step * 5;
                } else if (e.key === 'PageDown') {
                    delta = -step * 5;
                } else {
                    return;
                }
            } else {
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                    delta = step;
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                    delta = -step;
                } else if (e.key === 'Home') {
                    delta = -Infinity;
                } else if (e.key === 'End') {
                    delta = Infinity;
                } else if (e.key === 'PageDown') {
                    delta = step * 5;
                } else if (e.key === 'PageUp') {
                    delta = -step * 5;
                } else {
                    return;
                }
            }

            e.preventDefault();

            // Get panels on either side of handle
            const prevPanel = panels[index];
            const nextPanel = panels[index + 1];
            if (!prevPanel || !nextPanel) return;

            const currentPrevSize = orientation === 'horizontal' ? prevPanel.offsetWidth : prevPanel.offsetHeight;
            const currentNextSize = orientation === 'horizontal' ? nextPanel.offsetWidth : nextPanel.offsetHeight;

            let newPrevSize = currentPrevSize + delta;
            let newNextSize = currentNextSize - delta;

            // Apply min/max constraints
            newPrevSize = Math.max(minSize, Math.min(maxSize, newPrevSize));
            newNextSize = Math.max(minSize, Math.min(maxSize, newNextSize));

            // Snap to snap points if defined
            if (snapPoints.length > 0) {
                snapPoints.forEach(point => {
                    if (Math.abs(newPrevSize - point) < step) {
                        newPrevSize = point;
                        newNextSize = currentPrevSize + currentNextSize - point;
                    }
                });
            }

            // Apply sizes
            if (orientation === 'horizontal') {
                prevPanel.style.flex = `0 0 ${newPrevSize}px`;
                nextPanel.style.flex = `0 0 ${newNextSize}px`;
            } else {
                prevPanel.style.flex = `0 0 ${newPrevSize}px`;
                nextPanel.style.flex = `0 0 ${newNextSize}px`;
            }

            // Update ARIA
            handle.setAttribute('aria-valuenow', newPrevSize);
            handle.setAttribute('aria-valuemin', minSize);
            handle.setAttribute('aria-valuemax', maxSize);

            // Publish change
            eventBus.publish('RESIZE_CHANGED', {
                containerId: container.id,
                sizes: [newPrevSize, newNextSize],
                handleIndex: index,
                timestamp: Date.now()
            });
        };

        handle.addEventListener('keydown', handleKeyDown);
        eventHandlers.push({ element: handle, event: 'keydown', handler: handleKeyDown });

        // Update ARIA for initial state
        const prevPanel = panels[index];
        if (prevPanel) {
            const initialSize = orientation === 'horizontal' ? prevPanel.offsetWidth : prevPanel.offsetHeight;
            handle.setAttribute('aria-valuenow', initialSize);
            handle.setAttribute('aria-valuemin', parseInt(handle.dataset.minSize) || 50);
            handle.setAttribute('aria-valuemax', parseInt(handle.dataset.maxSize) || Infinity);
        }
    });

    // Initialize collapse buttons
    panels.forEach((panel, index) => {
        if (panel.dataset.collapsible !== 'true') return;

        const collapseBtn = panel.querySelector('.resizable-panel-collapse-btn');
        if (!collapseBtn) return;

        const handleClick = () => {
            const isCollapsed = panel.dataset.collapsed === 'true';
            panel.dataset.collapsed = isCollapsed ? 'false' : 'true';

            if (!isCollapsed) {
                // Store current size before collapsing
                panel.dataset.prevSize = orientation === 'horizontal' 
                    ? panel.offsetWidth 
                    : panel.offsetHeight;
                
                if (orientation === 'horizontal') {
                    panel.style.flex = '0 0 0px';
                } else {
                    panel.style.flex = '0 0 0px';
                }
            } else {
                // Restore previous size
                const prevSize = parseInt(panel.dataset.prevSize) || 200;
                panel.style.flex = `0 0 ${prevSize}px`;
            }

            eventBus.publish('PANEL_COLLAPSED', {
                containerId: container.id,
                panelIndex: index,
                collapsed: !isCollapsed,
                timestamp: Date.now()
            });
        };

        collapseBtn.addEventListener('click', handleClick);
        eventHandlers.push({ element: collapseBtn, event: 'click', handler: handleClick });
    });

    // Restore saved sizes
    if (container.dataset.autoSave === 'true') {
        restoreSizes(container, panels, orientation);
    }

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Set panel size programmatically
 */
function setPanelSize(panel, size, orientation) {
    const sizeValue = typeof size === 'string' ? size : `${size}px`;
    panel.style.flex = `0 0 ${sizeValue}`;
}

/**
 * Save sizes to localStorage
 */
function saveSizes(container, sizes) {
    const key = `resizable-${container.id || 'default'}`;
    try {
        localStorage.setItem(key, JSON.stringify(sizes));
        
        // Show save indicator
        container.dataset.saving = 'true';
        setTimeout(() => {
            container.dataset.saving = 'false';
        }, 1000);
    } catch (e) {
        console.warn('[Resizable] Failed to save sizes:', e);
    }
}

/**
 * Restore sizes from localStorage
 */
function restoreSizes(container, panels, orientation) {
    const key = `resizable-${container.id || 'default'}`;
    try {
        const saved = localStorage.getItem(key);
        if (saved) {
            const sizes = JSON.parse(saved);
            sizes.forEach((size, index) => {
                if (panels[index]) {
                    panels[index].style.flex = `0 0 ${size}px`;
                }
            });
        }
    } catch (e) {
        console.warn('[Resizable] Failed to restore sizes:', e);
    }
}
