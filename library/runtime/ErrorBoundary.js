export class ErrorBoundary {
    constructor({ devMode = import.meta.env.DEV } = {}) {
        this.devMode = devMode;
        this.timers = new Set();
    }

    isCriticalError(error) {
        const message = error?.message || error?.reason?.message || String(error?.reason || '');
        const criticalPatterns = [
            'Cannot read',
            'Cannot set',
            'undefined is not',
            'null is not',
            'Failed to fetch'
        ];
        return criticalPatterns.some((pattern) => message.includes(pattern));
    }

    handleError(error) {
        const existingBoundary = document.querySelector('.error-boundary');
        if (existingBoundary) {
            return;
        }

        const boundary = document.createElement('div');
        boundary.className = 'error-boundary';

        const content = document.createElement('div');
        content.className = 'error-boundary-content';

        const heading = document.createElement('h2');
        heading.textContent = 'Something went wrong';
        content.appendChild(heading);

        const messageEl = document.createElement('p');
        messageEl.className = 'error-message';
        messageEl.textContent = this.sanitizeError(error?.message || error?.reason?.message || 'Unknown error');
        content.appendChild(messageEl);

        if (this.devMode) {
            const stack = document.createElement('pre');
            stack.className = 'error-stack';
            stack.textContent = error?.error?.stack || error?.reason?.stack || 'No stack trace';
            content.appendChild(stack);
        }

        const actions = document.createElement('div');
        actions.className = 'error-actions';

        const reloadBtn = document.createElement('button');
        reloadBtn.type = 'button';
        reloadBtn.textContent = 'Reload page';

        const dismissBtn = document.createElement('button');
        dismissBtn.type = 'button';
        dismissBtn.textContent = 'Dismiss';

        let autoRemoveTimer = null;
        const removeBoundary = () => {
            if (autoRemoveTimer) {
                clearTimeout(autoRemoveTimer);
                this.timers.delete(autoRemoveTimer);
                autoRemoveTimer = null;
            }
            boundary.remove();
        };

        reloadBtn.addEventListener('click', () => {
            removeBoundary();
            window.location.reload();
        });
        dismissBtn.addEventListener('click', removeBoundary);

        actions.append(reloadBtn, dismissBtn);
        content.appendChild(actions);
        boundary.appendChild(content);
        document.body.appendChild(boundary);
        this.injectStyles();

        if (!this.isCriticalError(error)) {
            autoRemoveTimer = setTimeout(() => {
                this.timers.delete(autoRemoveTimer);
                boundary.remove();
                autoRemoveTimer = null;
            }, 10000);
            this.timers.add(autoRemoveTimer);
        }
    }

    sanitizeError(message) {
        if (!this.devMode) {
            return String(message)
                .replace(/https?:\/\/[^\s]+/g, '[URL]')
                .replace(/file:\/\/[^\s]+/g, '[FILE]');
        }
        return message;
    }

    injectStyles() {
        if (document.getElementById('error-boundary-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'error-boundary-styles';
        style.textContent = `
            .error-boundary {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000000;
            }
            .error-boundary-content {
                background: #1e1e1e;
                color: #d4d4d4;
                padding: 32px;
                border-radius: 8px;
                max-width: 600px;
                border: 2px solid #f48771;
            }
            .error-boundary-content h2 {
                color: #f48771;
                margin-top: 0;
            }
            .error-message {
                background: #2d2d30;
                padding: 12px;
                border-radius: 4px;
                font-family: monospace;
            }
            .error-stack {
                background: #1e1e1e;
                padding: 12px;
                border-radius: 4px;
                overflow-x: auto;
                max-height: 200px;
                font-size: 11px;
            }
            .error-actions {
                display: flex;
                gap: 12px;
                margin-top: 20px;
            }
            .error-actions button {
                padding: 8px 16px;
                background: #007acc;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }
            .error-actions button:hover {
                background: #005a9e;
            }
            .error-actions button:last-child {
                background: #3e3e42;
            }
            .error-actions button:last-child:hover {
                background: #505053;
            }
        `;
        document.head.appendChild(style);
    }

    destroy() {
        this.timers.forEach((timerId) => clearTimeout(timerId));
        this.timers.clear();
        document.querySelectorAll('.error-boundary').forEach((boundary) => boundary.remove());
    }
}
