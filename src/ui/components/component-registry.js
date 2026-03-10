/**
 * CSMA Component Registry
 * Central registry of all components with previews and code snippets
 */

export const componentRegistry = [
    // ============================================
    // CSS-Only Components
    // ============================================
    {
        id: 'badge',
        name: 'Badge',
        category: 'CSS-Only',
        type: 'css',
        description: 'Inline labels for status, categories, and counts',
        preview: `
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <span class="badge">Default</span>
                <span class="badge" data-variant="primary">Primary</span>
                <span class="badge" data-variant="success">Success</span>
                <span class="badge" data-variant="warning">Warning</span>
                <span class="badge" data-variant="danger">Danger</span>
            </div>
        `,
        html: `<span class="badge">Default</span>
<span class="badge" data-variant="primary">Primary</span>
<span class="badge" data-variant="success">Success</span>
<span class="badge" data-variant="warning">Warning</span>
<span class="badge" data-variant="danger">Danger</span>`,
        css: null
    },
    {
        id: 'card',
        name: 'Card',
        category: 'CSS-Only',
        type: 'css',
        description: 'Container for grouping related content',
        preview: `
            <div class="card" style="width: 280px;">
                <div class="card-content">
                    <h3 class="card-title">Card Title</h3>
                    <p class="card-text">This is a basic card component with content.</p>
                </div>
                <div class="card-actions">
                    <button class="button" data-variant="primary">Action</button>
                </div>
            </div>
        `,
        html: `<div class="card">
    <div class="card-content">
        <h3 class="card-title">Card Title</h3>
        <p class="card-text">Card description text.</p>
    </div>
    <div class="card-actions">
        <button class="button" data-variant="primary">Action</button>
    </div>
</div>`,
        css: null
    },
    {
        id: 'separator',
        name: 'Separator',
        category: 'CSS-Only',
        type: 'css',
        description: 'Visual dividers for separating content',
        preview: `
            <div style="width: 200px;">
                <p>Content above</p>
                <div class="separator"></div>
                <p>Content below</p>
            </div>
        `,
        html: `<div class="separator"></div>
<div class="separator" data-orientation="vertical" style="height: 2rem;"></div>`,
        css: null
    },
    {
        id: 'avatar',
        name: 'Avatar',
        category: 'CSS-Only',
        type: 'css',
        description: 'User profile images with fallback initials',
        preview: `
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <div class="avatar">
                    <img src="https://i.pravatar.cc/40" alt="User">
                </div>
                <div class="avatar" data-size="lg">
                    <span class="avatar-fallback">JD</span>
                </div>
            </div>
        `,
        html: `<div class="avatar">
    <img src="user.jpg" alt="User Name">
</div>

<div class="avatar">
    <span class="avatar-fallback">JD</span>
</div>

<div class="avatar" data-size="lg">
    <span class="avatar-fallback">JD</span>
</div>`,
        css: null
    },
    {
        id: 'skeleton',
        name: 'Skeleton',
        category: 'CSS-Only',
        type: 'css',
        description: 'Loading placeholders with shimmer animation',
        demoPath: '/src/ui/components/skeleton/skeleton.demo.html',
        preview: `
            <div style="width: 250px;">
                <div class="skeleton" style="height: 125px; border-radius: 0.5rem;"></div>
                <div class="skeleton" style="height: 1rem; margin-top: 0.5rem; width: 80%;"></div>
                <div class="skeleton" style="height: 1rem; margin-top: 0.25rem; width: 60%;"></div>
            </div>
        `,
        html: `<div class="skeleton" style="height: 100px;"></div>
<div class="skeleton" style="height: 1rem; width: 80%;"></div>`,
        css: null
    },
    {
        id: 'alert',
        name: 'Alert',
        category: 'CSS-Only',
        type: 'css',
        description: 'Contextual feedback messages',
        preview: `
            <div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
                <div class="alert" data-variant="info">This is an info alert</div>
                <div class="alert" data-variant="success">This is a success alert</div>
                <div class="alert" data-variant="warning">This is a warning alert</div>
                <div class="alert" data-variant="danger">This is a danger alert</div>
            </div>
        `,
        html: `<div class="alert" data-variant="info">Info message</div>
<div class="alert" data-variant="success">Success message</div>
<div class="alert" data-variant="warning">Warning message</div>
<div class="alert" data-variant="danger">Error message</div>`,
        css: null
    },
    {
        id: 'scroll-area',
        name: 'Scroll Area',
        category: 'CSS-Only',
        type: 'css',
        description: 'Customizable scrollable containers',
        preview: `
            <div class="scroll-area" data-scrollbar="hover" style="width: min(100%, 18rem); height: 11rem; border: 1px solid var(--fx-color-border); border-radius: var(--fx-radius-md);">
                <div class="scroll-area-viewport">
                    <div class="scroll-area-content" style="padding: 1rem;">
                        <p style="margin-top: 0;">Scroll inside this panel to review layered notes.</p>
                        <p>Intent published</p>
                        <p>Contract validated</p>
                        <p>CSS state applied</p>
                        <p>UI rerendered</p>
                        <p>Hot reload cleanup</p>
                        <p>Explorer search rebound</p>
                        <p style="margin-bottom: 0;">This viewport is the real scroll target.</p>
                    </div>
                </div>
            </div>
        `,
        html: `<div class="scroll-area" data-scrollbar="hover" style="height: 200px;">
    <div class="scroll-area-viewport">
        <div class="scroll-area-content">
            <!-- Content here -->
        </div>
    </div>
</div>`,
        css: null
    },
    {
        id: 'aspect-ratio',
        name: 'Aspect Ratio',
        category: 'CSS-Only',
        type: 'css',
        description: 'Container that maintains a fixed width/height ratio',
        preview: `
            <div style="width: 200px;">
                <div class="aspect-ratio" data-ratio="16/9" style="background: var(--fx-color-bg-muted); border-radius: var(--fx-radius-md);">
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--fx-color-fg-muted);">16:9</div>
                </div>
            </div>
        `,
        html: `<div class="aspect-ratio" data-ratio="16/9">
    <img src="image.jpg" alt="Description">
</div>

<div class="aspect-ratio" data-ratio="4/3">
    <video src="video.mp4"></video>
</div>`,
        css: null
    },
    {
        id: 'number-field',
        name: 'Number Field',
        category: 'Form',
        type: 'js',
        description: 'Form input for numbers with increment/decrement controls',
        preview: `
            <div class="number-field" data-number-field data-min="0" data-max="100" data-value="0">
                <input type="number" class="number-field-input" data-number-field-input value="0" min="0" max="100">
                <div class="number-field-spinner">
                    <button class="number-field-btn" data-action="increment">▲</button>
                    <button class="number-field-btn" data-action="decrement">▼</button>
                </div>
            </div>
        `,
        html: `<div class="number-field" data-number-field data-min="0" data-max="100" data-value="0">
    <input type="number" class="number-field-input" data-number-field-input value="0">
    <div class="number-field-spinner">
        <button class="number-field-btn" data-action="increment">▲</button>
        <button class="number-field-btn" data-action="decrement">▼</button>
    </div>
</div>`,
        css: null
    },
    {
        id: 'pin-input',
        name: 'Pin Input',
        category: 'Form',
        type: 'js',
        description: 'OTP-style separate digit input boxes',
        preview: `
            <div class="pin-input" data-pin-input data-length="4">
                <div class="pin-input-slot">
                    <input type="text" class="pin-input-field" data-pin-input-field maxlength="1">
                </div>
                <div class="pin-input-slot">
                    <input type="text" class="pin-input-field" data-pin-input-field maxlength="1">
                </div>
                <div class="pin-input-slot">
                    <input type="text" class="pin-input-field" data-pin-input-field maxlength="1">
                </div>
                <div class="pin-input-slot">
                    <input type="text" class="pin-input-field" data-pin-input-field maxlength="1">
                </div>
            </div>
        `,
        html: `<div class="pin-input" data-pin-input data-length="4">
    <div class="pin-input-slot">
        <input type="text" class="pin-input-field" data-pin-input-field maxlength="1">
    </div>
    <!-- Repeat for each digit -->
</div>`,
        css: null
    },

    // ============================================
    // Form Components
    // ============================================
    {
        id: 'input',
        name: 'Input',
        category: 'Form',
        type: 'js',
        description: 'Text inputs with validation and icons',
        demoPath: '/src/ui/components/input/input.demo.html',
        preview: `
            <div style="display: flex; flex-direction: column; gap: 0.75rem; width: min(100%, 22rem);">
                <div class="input-group" data-size="md" data-state="default" data-input-group>
                    <label class="input-label" for="explorer-input-default">Workspace name</label>
                    <div class="input-wrapper">
                        <input type="text" id="explorer-input-default" class="input" data-input placeholder="CSMA Explorer">
                    </div>
                    <p class="input-helper">Names can be changed later.</p>
                </div>
                <div class="input-group" data-size="md" data-state="error" data-input-group>
                    <label class="input-label" for="explorer-input-error">Username</label>
                    <div class="input-wrapper">
                        <input type="text" id="explorer-input-error" class="input" data-input placeholder="Choose a username" value="admin">
                    </div>
                    <p class="input-helper">Use 3-24 lowercase characters.</p>
                    <p class="input-error" role="alert">Username is already taken.</p>
                </div>
            </div>
        `,
        html: `<div class="input-group" data-size="md" data-state="default" data-input-group>
    <label class="input-label" for="workspace-name">Workspace name</label>
    <div class="input-wrapper">
        <input type="text" id="workspace-name" class="input" data-input placeholder="Enter text">
    </div>
    <p class="input-helper">Names can be changed later.</p>
</div>
<div class="input-group" data-size="md" data-state="error" data-input-group>
    <label class="input-label" for="username">Username</label>
    <div class="input-wrapper">
        <input type="text" id="username" class="input" data-input placeholder="Choose a username" value="admin">
    </div>
    <p class="input-helper">Use 3-24 lowercase characters.</p>
    <p class="input-error" role="alert">Username is already taken.</p>
</div>`,
        css: null
    },
    {
        id: 'textarea',
        name: 'Textarea',
        category: 'Form',
        type: 'js',
        description: 'Multi-line text with character count',
        preview: `
            <div class="textarea-group" data-textarea-group>
                <textarea class="textarea" data-textarea placeholder="Enter your message..." rows="3" style="width: 100%;"></textarea>
            </div>
        `,
        html: `<div class="textarea-group" data-textarea-group>
    <textarea class="textarea" data-textarea placeholder="Enter message..." rows="4"></textarea>
</div>`,
        css: null
    },
    {
        id: 'select',
        name: 'Select',
        category: 'Form',
        type: 'js',
        description: 'Dropdown selection with option groups',
        demoPath: '/src/ui/components/select/select.demo.html',
        preview: `
            <div style="display: flex; flex-direction: column; gap: 0.75rem; width: min(100%, 22rem);">
                <div class="select-group" data-state="default">
                    <label for="explorer-select-country" class="select-label">Country</label>
                    <div class="select-wrapper" data-select>
                        <select id="explorer-select-country" class="select">
                            <option value="">Select a country...</option>
                            <option value="us">United States</option>
                            <option value="de">Germany</option>
                            <option value="jp">Japan</option>
                        </select>
                        <span class="select-arrow">▼</span>
                    </div>
                    <p class="select-helper">Used for localization defaults.</p>
                </div>
                <div class="select-group" data-state="error">
                    <label for="explorer-select-required" class="select-label">Environment</label>
                    <div class="select-wrapper" data-select>
                        <select id="explorer-select-required" class="select">
                            <option value="">Choose an environment...</option>
                            <option value="dev">Development</option>
                            <option value="prod">Production</option>
                        </select>
                        <span class="select-arrow">▼</span>
                    </div>
                    <p class="select-error" role="alert">Please choose an environment.</p>
                </div>
            </div>
        `,
        html: `<div class="select-group" data-state="default">
    <label for="country" class="select-label">Country</label>
    <div class="select-wrapper" data-select>
        <select id="country" class="select">
            <option value="">Select a country...</option>
            <option value="us">United States</option>
            <option value="de">Germany</option>
            <option value="jp">Japan</option>
        </select>
        <span class="select-arrow">▼</span>
    </div>
    <p class="select-helper">Used for localization defaults.</p>
</div>
<div class="select-group" data-state="error">
    <label for="environment" class="select-label">Environment</label>
    <div class="select-wrapper" data-select>
        <select id="environment" class="select">
            <option value="">Choose an environment...</option>
            <option value="dev">Development</option>
            <option value="prod">Production</option>
        </select>
        <span class="select-arrow">▼</span>
    </div>
    <p class="select-error" role="alert">Please choose an environment.</p>
</div>`,
        css: null
    },
    {
        id: 'checkbox',
        name: 'Checkbox',
        category: 'Form',
        type: 'js',
        description: 'Multiple choice selections',
        demoPath: '/src/ui/components/checkbox/checkbox.demo.html',
        preview: `
            <div class="checkbox-group" data-checkbox-group style="display: flex; flex-direction: column; gap: 0.5rem;">
                <div class="checkbox-item" data-state="unchecked">
                    <input type="checkbox" class="checkbox-input" id="explorer-checkbox-1">
                    <div class="checkbox-box"></div>
                    <label for="explorer-checkbox-1" class="checkbox-label">Email notifications</label>
                </div>
                <div class="checkbox-item" data-state="checked">
                    <input type="checkbox" class="checkbox-input" id="explorer-checkbox-2" checked>
                    <div class="checkbox-box"></div>
                    <label for="explorer-checkbox-2" class="checkbox-label">Security alerts</label>
                </div>
            </div>
        `,
        html: `<div class="checkbox-group" data-checkbox-group>
    <div class="checkbox-item" data-state="unchecked">
        <input type="checkbox" class="checkbox-input" id="notifications">
        <div class="checkbox-box"></div>
        <label for="notifications" class="checkbox-label">Email notifications</label>
    </div>
    <div class="checkbox-item" data-state="checked">
        <input type="checkbox" class="checkbox-input" id="security" checked>
        <div class="checkbox-box"></div>
        <label for="security" class="checkbox-label">Security alerts</label>
    </div>
</div>`,
        css: null
    },
    {
        id: 'radio',
        name: 'Radio',
        category: 'Form',
        type: 'js',
        description: 'Single choice from options',
        demoPath: '/src/ui/components/radio/radio.demo.html',
        preview: `
            <div class="radio-group" data-radio-group style="display: flex; flex-direction: column; gap: 0.5rem;">
                <div class="radio-item" data-state="unchecked" data-value="free">
                    <input type="radio" class="radio-input" name="explorer-plan" id="explorer-radio-1">
                    <div class="radio-circle"></div>
                    <label for="explorer-radio-1" class="radio-label">Free plan</label>
                </div>
                <div class="radio-item" data-state="checked" data-value="pro">
                    <input type="radio" class="radio-input" name="explorer-plan" id="explorer-radio-2" checked>
                    <div class="radio-circle"></div>
                    <label for="explorer-radio-2" class="radio-label">Pro plan</label>
                </div>
            </div>
        `,
        html: `<div class="radio-group" data-radio-group>
    <div class="radio-item" data-state="unchecked" data-value="free">
        <input type="radio" class="radio-input" name="plan" id="plan-free">
        <div class="radio-circle"></div>
        <label for="plan-free" class="radio-label">Free plan</label>
    </div>
    <div class="radio-item" data-state="checked" data-value="pro">
        <input type="radio" class="radio-input" name="plan" id="plan-pro" checked>
        <div class="radio-circle"></div>
        <label for="plan-pro" class="radio-label">Pro plan</label>
    </div>
</div>`,
        css: null
    },
    {
        id: 'switch',
        name: 'Switch',
        category: 'Form',
        type: 'js',
        description: 'Toggle on/off controls',
        demoPath: '/src/ui/components/switch/switch.demo.html',
        preview: `
            <div style="display: flex; flex-direction: column; gap: 0.75rem; width: min(100%, 18rem);">
                <div class="switch-group" data-state="unchecked" data-size="md" role="switch" aria-checked="false" tabindex="0">
                    <input type="checkbox" class="switch-input" id="explorer-switch-1">
                    <div class="switch-track">
                        <div class="switch-thumb"></div>
                    </div>
                    <label for="explorer-switch-1" class="switch-label">Team notifications</label>
                </div>
                <div class="switch-group" data-state="checked" data-size="md" role="switch" aria-checked="true" tabindex="0">
                    <input type="checkbox" class="switch-input" id="explorer-switch-2" checked>
                    <div class="switch-track">
                        <div class="switch-thumb"></div>
                    </div>
                    <label for="explorer-switch-2" class="switch-label">Dark mode</label>
                </div>
            </div>
        `,
        html: `<div class="switch-group" data-state="unchecked" data-size="md" role="switch" aria-checked="false" tabindex="0">
    <input type="checkbox" class="switch-input" id="notifications-switch">
    <div class="switch-track">
        <div class="switch-thumb"></div>
    </div>
    <label for="notifications-switch" class="switch-label">Team notifications</label>
</div>
<div class="switch-group" data-state="checked" data-size="md" role="switch" aria-checked="true" tabindex="0">
    <input type="checkbox" class="switch-input" id="theme-switch" checked>
    <div class="switch-track">
        <div class="switch-thumb"></div>
    </div>
    <label for="theme-switch" class="switch-label">Dark mode</label>
</div>`,
        css: null
    },
    {
        id: 'toggle-group',
        name: 'Toggle Group',
        category: 'Form',
        type: 'js',
        description: 'Group of mutually exclusive toggle buttons',
        preview: `
            <div class="toggle-group" data-type="single">
                <button class="toggle-group-item" data-value="left" data-state="on">Left</button>
                <button class="toggle-group-item" data-value="center">Center</button>
                <button class="toggle-group-item" data-value="right">Right</button>
            </div>
        `,
        html: `<div class="toggle-group" data-type="single">
    <button class="toggle-group-item" data-value="left">Left</button>
    <button class="toggle-group-item" data-value="center">Center</button>
    <button class="toggle-group-item" data-value="right">Right</button>
</div>`,
        css: null
    },
    {
        id: 'combobox',
        name: 'Combobox',
        category: 'Form',
        type: 'js',
        description: 'Input with autocomplete dropdown',
        demoPath: null,
        preview: `
            <div class="combobox" style="width: min(100%, 16rem);">
                <div class="combobox-trigger">
                    <input type="text" class="combobox-input" placeholder="Search frameworks...">
                    <svg class="combobox-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <div class="combobox-content" data-state="closed">
                    <div class="combobox-item" data-value="csma" data-selected="true">CSMA</div>
                    <div class="combobox-item" data-value="vite">Vite</div>
                    <div class="combobox-item" data-value="astro">Astro</div>
                    <div class="combobox-empty" hidden>No matching framework.</div>
                </div>
            </div>
        `,
        html: `<div class="combobox">
    <div class="combobox-trigger">
        <input type="text" class="combobox-input" placeholder="Search frameworks...">
        <svg class="combobox-icon">...</svg>
    </div>
    <div class="combobox-content" data-state="closed">
        <div class="combobox-item" data-value="csma" data-selected="true">CSMA</div>
        <div class="combobox-item" data-value="vite">Vite</div>
        <div class="combobox-item" data-value="astro">Astro</div>
        <div class="combobox-empty" hidden>No matching framework.</div>
    </div>
</div>`,
        css: null
    },
    {
        id: 'datepicker',
        name: 'Datepicker',
        category: 'Form',
        type: 'js',
        description: 'Calendar date selection with keyboard support',
        demoPath: '/src/ui/components/datepicker/datepicker.demo.html',
        preview: `
            <div class="datepicker" data-datepicker data-mode="single" style="width: min(100%, 18rem);">
                <label class="datepicker-label" for="explorer-datepicker">Meeting date</label>
                <div class="datepicker-field-wrapper">
                    <input id="explorer-datepicker" class="datepicker-field" type="text" placeholder="dd/mm/yyyy" data-datepicker-field aria-label="Choose meeting date">
                    <img class="datepicker-icon" src="../../ui/icons/calendar.svg" alt="" aria-hidden="true">
                </div>
                <div class="datepicker-modal" data-datepicker-modal aria-hidden="true">
                    <div class="datepicker-panel" data-datepicker-panel role="dialog" aria-modal="true" aria-label="Select a date">
                        <div class="datepicker-header">
                            <button type="button" class="datepicker-nav" data-action="prev" aria-label="Previous month">‹</button>
                            <p class="datepicker-month" data-datepicker-month></p>
                            <button type="button" class="datepicker-nav" data-action="next" aria-label="Next month">›</button>
                        </div>
                        <div class="datepicker-weekdays" data-datepicker-weekdays></div>
                        <div class="datepicker-grid" data-datepicker-grid role="grid"></div>
                        <div class="datepicker-footer">
                            <button type="button" class="datepicker-link" data-action="today">Today</button>
                            <p class="datepicker-display" data-datepicker-display>Use arrows + Enter to pick a date.</p>
                        </div>
                    </div>
                </div>
            </div>
        `,
        html: `<div class="datepicker" data-datepicker data-mode="single">
    <label class="datepicker-label" for="meeting-date">Meeting date</label>
    <div class="datepicker-field-wrapper">
        <input id="meeting-date" class="datepicker-field" type="text" placeholder="dd/mm/yyyy" data-datepicker-field aria-label="Choose meeting date">
        <img class="datepicker-icon" src="../../ui/icons/calendar.svg" alt="" aria-hidden="true">
    </div>
    <div class="datepicker-modal" data-datepicker-modal aria-hidden="true">
        <div class="datepicker-panel" data-datepicker-panel role="dialog" aria-modal="true" aria-label="Select a date">
            <div class="datepicker-header">
                <button type="button" class="datepicker-nav" data-action="prev" aria-label="Previous month">‹</button>
                <p class="datepicker-month" data-datepicker-month></p>
                <button type="button" class="datepicker-nav" data-action="next" aria-label="Next month">›</button>
            </div>
            <div class="datepicker-weekdays" data-datepicker-weekdays></div>
            <div class="datepicker-grid" data-datepicker-grid role="grid"></div>
            <div class="datepicker-footer">
                <button type="button" class="datepicker-link" data-action="today">Today</button>
                <p class="datepicker-display" data-datepicker-display>Use arrows + Enter to pick a date.</p>
            </div>
        </div>
    </div>
</div>`,
        css: null
    },
    {
        id: 'date-range-picker',
        name: 'Date Range Picker',
        category: 'Form',
        type: 'js',
        description: 'Calendar for selecting date ranges',
        demoPath: null,
        preview: `
            <div class="date-range-picker">
                <div class="date-range-trigger" style="width: min(100%, 18rem);">
                    <span class="date-range-trigger-value date-range-trigger-placeholder">Select date range</span>
                    <svg class="date-range-trigger-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                </div>
                <div class="date-range-content" data-state="closed">
                    <div style="display: flex;">
                        <div class="date-range-presets">
                            <button type="button" class="date-range-preset" data-range="today">Today</button>
                            <button type="button" class="date-range-preset" data-range="last7">Last 7 days</button>
                            <button type="button" class="date-range-preset" data-range="thisMonth">This month</button>
                        </div>
                        <div class="date-range-calendars">
                            <div class="date-range-calendar">
                                <div class="date-range-calendar-header">
                                    <div class="date-range-calendar-nav">
                                        <button type="button" class="date-range-calendar-nav-btn" data-dir="prev" aria-label="Previous month">‹</button>
                                    </div>
                                    <div class="date-range-calendar-title"></div>
                                    <div class="date-range-calendar-nav"></div>
                                </div>
                                <div class="date-range-calendar-grid"></div>
                            </div>
                            <div class="date-range-calendar">
                                <div class="date-range-calendar-header">
                                    <div class="date-range-calendar-nav"></div>
                                    <div class="date-range-calendar-title"></div>
                                    <div class="date-range-calendar-nav">
                                        <button type="button" class="date-range-calendar-nav-btn" data-dir="next" aria-label="Next month">›</button>
                                    </div>
                                </div>
                                <div class="date-range-calendar-grid"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `,
        html: `<div class="date-range-picker">
    <div class="date-range-trigger">
        <span class="date-range-trigger-value">Select range</span>
        <svg class="date-range-trigger-icon">...</svg>
    </div>
    <div class="date-range-content" data-state="closed">
        <div style="display: flex;">
            <div class="date-range-presets">
                <button type="button" class="date-range-preset" data-range="today">Today</button>
                <button type="button" class="date-range-preset" data-range="last7">Last 7 days</button>
                <button type="button" class="date-range-preset" data-range="thisMonth">This month</button>
            </div>
            <div class="date-range-calendars">
                <div class="date-range-calendar">
                    <div class="date-range-calendar-header">
                        <div class="date-range-calendar-nav">
                            <button type="button" class="date-range-calendar-nav-btn" data-dir="prev" aria-label="Previous month">‹</button>
                        </div>
                        <div class="date-range-calendar-title"></div>
                        <div class="date-range-calendar-nav"></div>
                    </div>
                    <div class="date-range-calendar-grid"></div>
                </div>
                <div class="date-range-calendar">
                    <div class="date-range-calendar-header">
                        <div class="date-range-calendar-nav"></div>
                        <div class="date-range-calendar-title"></div>
                        <div class="date-range-calendar-nav">
                            <button type="button" class="date-range-calendar-nav-btn" data-dir="next" aria-label="Next month">›</button>
                        </div>
                    </div>
                    <div class="date-range-calendar-grid"></div>
                </div>
            </div>
        </div>
    </div>
</div>`,
        css: null
    },
    {
        id: 'slider',
        name: 'Slider',
        category: 'Form',
        type: 'js',
        description: 'Range input controls with keyboard support',
        demoPath: '/src/ui/components/slider/slider.demo.html',
        preview: `
            <div style="width: min(100%, 18rem);">
                <div class="slider-labels">
                    <span>Runtime budget</span>
                    <span class="slider-value">48%</span>
                </div>
                <div class="slider" data-slider data-min="0" data-max="100" data-value="48" data-percentage="48" style="width: 100%;">
                    <div class="slider-track">
                        <div class="slider-fill" data-slider-fill style="width: 48%;"></div>
                        <div class="slider-thumb" data-slider-thumb style="left: 48%;"></div>
                    </div>
                </div>
            </div>
        `,
        html: `<div class="slider-labels">
    <span>Runtime budget</span>
    <span class="slider-value">48%</span>
</div>
<div class="slider" data-slider data-min="0" data-max="100" data-value="48" data-percentage="48">
    <div class="slider-track">
        <div class="slider-fill" data-slider-fill></div>
        <div class="slider-thumb" data-slider-thumb></div>
    </div>
</div>`,
        css: null
    },
    {
        id: 'slider-range',
        name: 'Slider Range',
        category: 'Form',
        type: 'js',
        description: 'Dual-handle slider for min/max range',
        preview: `
            <div class="slider-range" data-slider-range style="width: 200px;">
                <div class="slider-range-track" data-slider-range-track>
                    <div class="slider-range-fill" data-slider-range-fill style="left: 20%; width: 40%;"></div>
                    <div class="slider-range-thumb" data-slider-range-thumb data-handle="min" style="left: 20%;"></div>
                    <div class="slider-range-thumb" data-slider-range-thumb data-handle="max" style="left: 60%;"></div>
                </div>
            </div>
        `,
        html: `<div class="slider-range" data-slider-range data-min="0" data-max="100" data-value-min="20" data-value-max="60">
    <div class="slider-range-track" data-slider-range-track>
        <div class="slider-range-fill" data-slider-range-fill></div>
        <div class="slider-range-thumb" data-slider-range-thumb data-handle="min"></div>
        <div class="slider-range-thumb" data-slider-range-thumb data-handle="max"></div>
    </div>
</div>`,
        css: null
    },

    // ============================================
    // Interactive Components
    // ============================================
    {
        id: 'button',
        name: 'Button',
        category: 'Interactive',
        type: 'css',
        description: 'Interactive button elements with variants',
        demoPath: '/src/ui/components/button/button.demo.html',
        preview: `
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button class="button">Default</button>
                <button class="button" data-variant="primary">Primary</button>
                <button class="button" data-variant="secondary">Secondary</button>
                <button class="button" data-variant="ghost">Ghost</button>
                <button class="button" data-variant="destructive">Destructive</button>
            </div>
        `,
        html: `<button class="button">Default</button>
<button class="button" data-variant="primary">Primary</button>
<button class="button" data-variant="secondary">Secondary</button>
<button class="button" data-variant="ghost">Ghost</button>
<button class="button" data-variant="destructive">Destructive</button>`,
        css: null
    },
    {
        id: 'toast',
        name: 'Toast',
        category: 'Interactive',
        type: 'js',
        description: 'Notification messages that auto-dismiss',
        preview: `
            <div style="display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center;">
                <button class="button" data-variant="primary" data-intent-event="INTENT_TOAST_SHOW" data-intent-type="success" data-intent-title="Deployment succeeded" data-intent-description="The runtime bootstrap completed without contract violations." data-intent-duration="2800">
                    Show success toast
                </button>
                <button class="button" data-variant="destructive" data-intent-event="INTENT_TOAST_SHOW" data-intent-type="error" data-intent-title="Deployment failed" data-intent-description="The latest publish was rejected by validation." data-intent-duration="3200">
                    Show error toast
                </button>
            </div>
        `,
        html: `<!-- Toasts are created dynamically via EventBus -->
eventBus.publish('INTENT_TOAST_SHOW', {
    type: 'success',
    title: 'Deployment succeeded',
    description: 'The runtime bootstrap completed without contract violations.',
    duration: 2800,
    timestamp: Date.now()
});`,
        css: null
    },
    {
        id: 'tabs',
        name: 'Tabs',
        category: 'Interactive',
        type: 'js',
        description: 'Tabbed navigation with keyboard support',
        preview: `
            <div class="tabs" data-tabs style="width: 300px;">
                <div class="tabs-list">
                    <button class="tabs-trigger" data-state="active">Tab 1</button>
                    <button class="tabs-trigger">Tab 2</button>
                    <button class="tabs-trigger">Tab 3</button>
                </div>
            </div>
        `,
        html: `<div class="tabs" data-tabs>
    <div class="tabs-list">
        <button class="tabs-trigger" data-state="active">Tab 1</button>
        <button class="tabs-trigger">Tab 2</button>
        <button class="tabs-trigger">Tab 3</button>
    </div>
    <div class="tabs-content" data-state="active">Content 1</div>
    <div class="tabs-content">Content 2</div>
</div>`,
        css: null
    },
    {
        id: 'accordion',
        name: 'Accordion',
        category: 'Interactive',
        type: 'js',
        description: 'Collapsible content sections',
        demoPath: '/src/ui/components/accordion/accordion.demo.html',
        preview: `
            <div class="accordion" data-accordion style="width: min(100%, 24rem);">
                <div class="accordion-item" data-state="open">
                    <h3 class="accordion-header">
                        <button class="accordion-trigger" aria-expanded="true" aria-controls="explorer-accordion-1">
                            <span>Explorer lifecycle</span>
                            <svg class="accordion-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </h3>
                    <div class="accordion-content" id="explorer-accordion-1">
                        <div class="accordion-content-wrapper">
                            Cleanup runs before rerender so dropdowns, dialogs, and observers do not duplicate.
                        </div>
                    </div>
                </div>
                <div class="accordion-item" data-state="closed">
                    <h3 class="accordion-header">
                        <button class="accordion-trigger" aria-expanded="false" aria-controls="explorer-accordion-2">
                            <span>Intent bridge</span>
                            <svg class="accordion-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </h3>
                    <div class="accordion-content" id="explorer-accordion-2">
                        <div class="accordion-content-wrapper">
                            Explorer-only buttons publish real intents instead of relying on inline handlers.
                        </div>
                    </div>
                </div>
                <div class="accordion-item" data-state="closed">
                    <h3 class="accordion-header">
                        <button class="accordion-trigger" aria-expanded="false" aria-controls="explorer-accordion-3">
                            <span>Canonical demos</span>
                            <svg class="accordion-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                    </h3>
                    <div class="accordion-content" id="explorer-accordion-3">
                        <div class="accordion-content-wrapper">
                            Standalone demos stay as the isolated source of truth for each component contract.
                        </div>
                    </div>
                </div>
            </div>
        `,
        html: `<div class="accordion" data-accordion>
    <div class="accordion-item" data-state="open">
        <h3 class="accordion-header">
            <button class="accordion-trigger" aria-expanded="true" aria-controls="accordion-panel-1">
                <span>Explorer lifecycle</span>
                <svg class="accordion-icon">...</svg>
            </button>
        </h3>
        <div class="accordion-content" id="accordion-panel-1">
            <div class="accordion-content-wrapper">
                Cleanup runs before rerender so dropdowns, dialogs, and observers do not duplicate.
            </div>
        </div>
    </div>
    <div class="accordion-item" data-state="closed">
        <h3 class="accordion-header">
            <button class="accordion-trigger" aria-expanded="false" aria-controls="accordion-panel-2">
                <span>Intent bridge</span>
                <svg class="accordion-icon">...</svg>
            </button>
        </h3>
        <div class="accordion-content" id="accordion-panel-2">
            <div class="accordion-content-wrapper">
                Explorer-only buttons publish real intents instead of relying on inline handlers.
            </div>
        </div>
    </div>
</div>`,
        css: null
    },
    {
        id: 'collapsible',
        name: 'Collapsible',
        category: 'Interactive',
        type: 'js',
        description: 'Simple collapsible content areas',
        preview: `
            <div style="display: flex; flex-direction: column; gap: 0.75rem; width: min(100%, 22rem);">
                <div class="collapsible" id="explorer-collapsible-1" data-default-state="open">
                    <button class="collapsible-trigger">
                        <span>Runtime snapshot details</span>
                        <svg class="accordion-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    <div class="collapsible-content">
                        <div class="collapsible-inner">
                            Render time, init time, and lifecycle counts are exposed without turning the page into a profiler.
                        </div>
                    </div>
                </div>
                <div class="collapsible" id="explorer-collapsible-2">
                    <button class="collapsible-trigger">
                        <span>Shipping checklist</span>
                        <svg class="collapsible-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    <div class="collapsible-content">
                        <div class="collapsible-inner">
                            Search rerenders, component cleanup, and demo parity all need to pass before this explorer is considered stable.
                        </div>
                    </div>
                </div>
            </div>
        `,
        html: `<div class="collapsible" data-default-state="open">
    <button class="collapsible-trigger">
        <span>Runtime snapshot details</span>
        <svg class="collapsible-icon">...</svg>
    </button>
    <div class="collapsible-content">
        <div class="collapsible-inner">
            Render time, init time, and lifecycle counts are exposed without turning the page into a profiler.
        </div>
    </div>
</div>`,
        css: null
    },
    {
        id: 'progress',
        name: 'Progress',
        category: 'Interactive',
        type: 'js',
        description: 'Progress bars with animations',
        preview: `
            <div style="display: flex; flex-direction: column; gap: 0.75rem; width: min(100%, 20rem);">
                <div class="progress-label">
                    <span>Explorer parity</span>
                    <span class="progress-percentage">36%</span>
                </div>
                <div class="progress-container progress-success" id="explorer-progress" style="--progress-value: 36%;">
                    <div class="progress-bar" data-progress-bar aria-valuemin="0" aria-valuemax="100" aria-valuenow="36"></div>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="button" data-size="sm" data-variant="secondary" data-intent-event="INTENT_PROGRESS_UPDATE" data-intent-progress-id="explorer-progress" data-intent-percentage="36">
                        36%
                    </button>
                    <button class="button" data-size="sm" data-variant="secondary" data-intent-event="INTENT_PROGRESS_UPDATE" data-intent-progress-id="explorer-progress" data-intent-percentage="72">
                        72%
                    </button>
                    <button class="button" data-size="sm" data-variant="primary" data-intent-event="INTENT_PROGRESS_UPDATE" data-intent-progress-id="explorer-progress" data-intent-percentage="100">
                        Complete
                    </button>
                </div>
            </div>
        `,
        html: `<div class="progress-label">
    <span>Explorer parity</span>
    <span class="progress-percentage">36%</span>
</div>
<div class="progress-container progress-success" id="explorer-progress" style="--progress-value: 36%;">
    <div class="progress-bar" data-progress-bar aria-valuemin="0" aria-valuemax="100" aria-valuenow="36"></div>
</div>`,
        css: null
    },
    {
        id: 'calendar',
        name: 'Calendar',
        category: 'Interactive',
        type: 'js',
        description: 'Calendar component for date selection',
        demoPath: null,
        preview: `
            <div class="calendar" data-selected="2026-03-10">
                <div class="calendar-header">
                    <div class="calendar-nav">
                        <button type="button" class="calendar-nav-btn" data-action="prev" aria-label="Previous month">‹</button>
                    </div>
                    <div class="calendar-month-year">
                        <select class="calendar-month-select" aria-label="Month">
                            <option value="0">January</option>
                            <option value="1">February</option>
                            <option value="2">March</option>
                            <option value="3">April</option>
                            <option value="4">May</option>
                            <option value="5">June</option>
                            <option value="6">July</option>
                            <option value="7">August</option>
                            <option value="8">September</option>
                            <option value="9">October</option>
                            <option value="10">November</option>
                            <option value="11">December</option>
                        </select>
                        <select class="calendar-year-select" aria-label="Year">
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                        </select>
                    </div>
                    <div class="calendar-nav">
                        <button type="button" class="calendar-nav-btn" data-action="next" aria-label="Next month">›</button>
                    </div>
                </div>
                <div class="calendar-grid">
                    <div class="calendar-weekdays">
                        <span class="calendar-weekday">Sun</span>
                        <span class="calendar-weekday">Mon</span>
                        <span class="calendar-weekday">Tue</span>
                        <span class="calendar-weekday">Wed</span>
                        <span class="calendar-weekday">Thu</span>
                        <span class="calendar-weekday">Fri</span>
                        <span class="calendar-weekday">Sat</span>
                    </div>
                </div>
                <div class="calendar-footer">
                    <button type="button" class="calendar-today-btn">Today</button>
                    <span style="font-size: var(--fx-font-size-xs); color: var(--fx-color-fg-muted);">Keyboard-ready date selection</span>
                </div>
            </div>
        `,
        html: `<div class="calendar">
    <div class="calendar-header">
        <div class="calendar-nav">
            <button type="button" class="calendar-nav-btn" data-action="prev" aria-label="Previous month">‹</button>
        </div>
        <div class="calendar-month-year">
            <select class="calendar-month-select" aria-label="Month">...</select>
            <select class="calendar-year-select" aria-label="Year">...</select>
        </div>
        <div class="calendar-nav">
            <button type="button" class="calendar-nav-btn" data-action="next" aria-label="Next month">›</button>
        </div>
    </div>
    <div class="calendar-grid">
        <div class="calendar-weekdays">
            <span class="calendar-weekday">Sun</span>
            <span class="calendar-weekday">Mon</span>
            <span class="calendar-weekday">Tue</span>
            <span class="calendar-weekday">Wed</span>
            <span class="calendar-weekday">Thu</span>
            <span class="calendar-weekday">Fri</span>
            <span class="calendar-weekday">Sat</span>
        </div>
    </div>
</div>`,
        css: null
    },
    {
        id: 'carousel',
        name: 'Carousel',
        category: 'Interactive',
        type: 'js',
        description: 'Responsive slider with autoplay and swipe',
        demoPath: '/src/ui/components/carousel/carousel.demo.html',
        preview: `
            <div class="carousel" data-carousel data-visible="1" data-loop="true" aria-label="Explorer carousel" tabindex="0" style="width: min(100%, 22rem);">
                <div class="carousel-header">
                    <p class="carousel-title">Explorer slides</p>
                    <p class="carousel-meta" data-carousel-meta>Showing 1–1 of 3</p>
                </div>
                <div class="carousel-viewport" data-carousel-viewport>
                    <div class="carousel-track" data-carousel-track>
                        <article class="carousel-slide" data-carousel-slide>
                            <div data-slot="media" style="background: linear-gradient(135deg, var(--fx-color-primary), var(--fx-color-info)); min-height: 12rem;"></div>
                            <div data-slot="body">
                                <h3>Real contract</h3>
                                <p>Uses the same data attributes as the standalone carousel demo.</p>
                            </div>
                        </article>
                        <article class="carousel-slide" data-carousel-slide>
                            <div data-slot="media" style="background: linear-gradient(135deg, var(--fx-color-success), var(--fx-color-warning)); min-height: 12rem;"></div>
                            <div data-slot="body">
                                <h3>Controls wired</h3>
                                <p>Prev/next, dots, keyboard navigation, and autoplay come from the shared system.</p>
                            </div>
                        </article>
                        <article class="carousel-slide" data-carousel-slide>
                            <div data-slot="media" style="background: linear-gradient(135deg, var(--fx-color-danger), var(--fx-color-primary)); min-height: 12rem;"></div>
                            <div data-slot="body">
                                <h3>Preview parity</h3>
                                <p>The explorer is no longer a fake shell for interactive components.</p>
                            </div>
                        </article>
                    </div>
                </div>
                <div class="carousel-controls">
                    <button class="carousel-button" type="button" data-carousel-prev aria-label="Previous slide">‹</button>
                    <button class="carousel-button" type="button" data-carousel-next aria-label="Next slide">›</button>
                </div>
                <div class="carousel-dots" data-carousel-dots></div>
            </div>
        `,
        html: `<div class="carousel" data-carousel data-visible="1" data-loop="true" aria-label="Explorer carousel" tabindex="0">
    <div class="carousel-header">
        <p class="carousel-title">Explorer slides</p>
        <p class="carousel-meta" data-carousel-meta>Showing 1–1 of 3</p>
    </div>
    <div class="carousel-viewport" data-carousel-viewport>
        <div class="carousel-track" data-carousel-track>
            <article class="carousel-slide" data-carousel-slide>...</article>
            <article class="carousel-slide" data-carousel-slide>...</article>
            <article class="carousel-slide" data-carousel-slide>...</article>
        </div>
    </div>
    <div class="carousel-controls">
        <button class="carousel-button" type="button" data-carousel-prev aria-label="Previous slide">‹</button>
        <button class="carousel-button" type="button" data-carousel-next aria-label="Next slide">›</button>
    </div>
    <div class="carousel-dots" data-carousel-dots></div>
</div>`,
        css: null
    },

    // ============================================
    // Overlay Components
    // ============================================
    {
        id: 'tooltip',
        name: 'Tooltip',
        category: 'Overlay',
        type: 'js',
        description: 'Hover hints and information',
        demoPath: '/src/ui/components/tooltip/tooltip.demo.html',
        preview: `
            <div class="tooltip-trigger">
                <button class="button" data-variant="secondary">Hover me</button>
                <span class="tooltip-content" data-position="top" data-state="closed">Tooltip on top</span>
            </div>
        `,
        html: `<div class="tooltip-trigger">
    <button class="button" data-variant="secondary">Hover me</button>
    <span class="tooltip-content" data-position="top" data-state="closed">Tooltip on top</span>
</div>`,
        css: null
    },
    {
        id: 'popover',
        name: 'Popover',
        category: 'Overlay',
        type: 'js',
        description: 'Floating content panels',
        demoPath: '/src/ui/components/popover/popover.demo.html',
        preview: `
            <div class="popover-container">
                <button class="button popover-trigger" data-variant="primary" aria-haspopup="dialog" aria-expanded="false">
                    Open Popover
                </button>
                <div class="popover-content popover-bottom" data-state="closed">
                    <div class="popover-arrow"></div>
                    <p style="margin: 0;">Floating content in the CSMA popover contract.</p>
                </div>
            </div>
        `,
        html: `<div class="popover-container">
    <button class="button popover-trigger" data-variant="primary" aria-haspopup="dialog" aria-expanded="false">
        Open Popover
    </button>
    <div class="popover-content popover-bottom" data-state="closed">
        <div class="popover-arrow"></div>
        <p style="margin: 0;">Floating content in the CSMA popover contract.</p>
    </div>
</div>`,
        css: null
    },
    {
        id: 'hover-card',
        name: 'Hover Card',
        category: 'Overlay',
        type: 'js',
        description: 'Preview cards on hover',
        preview: `
            <button class="button" data-hover-card="User info preview">Hover for card</button>
        `,
        html: `<span data-hover-card="Preview content">
    Hover target
</span>`,
        css: null
    },
    {
        id: 'dropdown',
        name: 'Dropdown',
        category: 'Overlay',
        type: 'js',
        description: 'Menu with actions and shortcuts',
        demoPath: '/src/ui/components/dropdown/dropdown.demo.html',
        preview: `
            <div class="dropdown" data-dropdown id="explorer-dropdown">
                <button class="button dropdown-trigger" data-dropdown-trigger>
                    Open Menu
                    <span class="dropdown-arrow">▼</span>
                </button>
                <div class="dropdown-content">
                    <a class="dropdown-item" href="#">Action 1</a>
                    <a class="dropdown-item" href="#">Action 2</a>
                </div>
            </div>
        `,
        html: `<div class="dropdown" data-dropdown>
    <button class="dropdown-trigger" data-dropdown-trigger>Open Menu</button>
    <div class="dropdown-content">
        <a class="dropdown-item" href="#">Action 1</a>
        <a class="dropdown-item" href="#">Action 2</a>
    </div>
</div>`,
        css: null
    },
    {
        id: 'context-menu',
        name: 'Context Menu',
        category: 'Overlay',
        type: 'js',
        description: 'Right-click context menus',
        preview: `
            <div class="context-menu-container" style="width: min(100%, 18rem);">
                <div class="context-menu-trigger" style="padding: 1rem; background: var(--fx-color-bg-muted); border-radius: var(--fx-radius-md); text-align: center;">
                    Right-click here
                </div>
                <div class="context-menu">
                    <button class="context-menu-item" data-action="copy">Copy</button>
                    <button class="context-menu-item" data-action="rename">Rename</button>
                    <button class="context-menu-item" data-action="delete">Delete</button>
                </div>
            </div>
        `,
        html: `<div class="context-menu-container">
    <div class="context-menu-trigger">
        Right-click me
    </div>
    <div class="context-menu">
        <button class="context-menu-item" data-action="copy">Copy</button>
        <button class="context-menu-item" data-action="rename">Rename</button>
        <button class="context-menu-item" data-action="delete">Delete</button>
    </div>
</div>
`,
        css: null
    },
    {
        id: 'dialog',
        name: 'Dialog',
        category: 'Overlay',
        type: 'js',
        description: 'Modal dialogs for forms and content',
        demoPath: '/src/ui/components/dialog/dialog.demo.html',
        preview: `
            <button class="button" data-variant="secondary" data-intent-event="INTENT_MODAL_OPEN" data-intent-id="explorer-dialog">
                Open Dialog
            </button>
            <div class="dialog-overlay" id="explorer-dialog" role="dialog" aria-modal="true" data-state="closed">
                <div class="dialog-content" data-size="sm">
                    <div class="dialog-header">
                        <h3 class="dialog-title">Explorer Dialog</h3>
                        <button class="dialog-close" aria-label="Close">×</button>
                    </div>
                    <div class="dialog-body">
                        <p style="margin: 0;">This preview opens through a real CSMA modal intent.</p>
                    </div>
                    <div class="dialog-footer">
                        <button class="button" data-variant="secondary" data-intent-event="INTENT_MODAL_CLOSE" data-intent-id="explorer-dialog">
                            Cancel
                        </button>
                        <button class="button" data-variant="primary" data-intent-event="INTENT_MODAL_CLOSE" data-intent-id="explorer-dialog">
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        `,
        html: `<button class="button" data-variant="secondary" data-intent-event="INTENT_MODAL_OPEN" data-intent-id="explorer-dialog">
    Open Dialog
</button>
<div class="dialog-overlay" id="explorer-dialog" role="dialog" aria-modal="true" data-state="closed">
    <div class="dialog-content" data-size="sm">
        <div class="dialog-header">
            <h3 class="dialog-title">Explorer Dialog</h3>
            <button class="dialog-close" aria-label="Close">×</button>
        </div>
        <div class="dialog-body">
            <p style="margin: 0;">This preview opens through a real CSMA modal intent.</p>
        </div>
        <div class="dialog-footer">
            <button class="button" data-variant="secondary" data-intent-event="INTENT_MODAL_CLOSE" data-intent-id="explorer-dialog">
                Cancel
            </button>
            <button class="button" data-variant="primary" data-intent-event="INTENT_MODAL_CLOSE" data-intent-id="explorer-dialog">
                Confirm
            </button>
        </div>
    </div>
</div>`,
        css: null
    },
    {
        id: 'alert-dialog',
        name: 'Alert Dialog',
        category: 'Overlay',
        type: 'js',
        description: 'Confirmation and warning dialogs',
        demoPath: '/src/ui/components/alert-dialog/alert-dialog.demo.html',
        preview: `
            <button class="button" data-variant="destructive" data-intent-event="INTENT_ALERT_DIALOG_OPEN" data-intent-id="explorer-alert-dialog">
                Delete item
            </button>
            <div class="alert-dialog-overlay" id="explorer-alert-dialog" role="alertdialog" aria-modal="true" data-state="closed">
                <div class="alert-dialog-content">
                    <div class="alert-dialog-header">
                        <div class="alert-dialog-icon" data-variant="danger"><img src="../../ui/icons/trash.svg" alt=""></div>
                        <div class="alert-dialog-title-group">
                            <h3 class="alert-dialog-title">Delete explorer preview?</h3>
                            <p class="alert-dialog-description">This action cannot be undone.</p>
                        </div>
                    </div>
                    <div class="alert-dialog-footer">
                        <button class="alert-dialog-cancel" data-intent-event="INTENT_ALERT_DIALOG_CLOSE" data-intent-id="explorer-alert-dialog">Cancel</button>
                        <button class="alert-dialog-action" data-intent-event="INTENT_ALERT_DIALOG_CLOSE" data-intent-id="explorer-alert-dialog">Delete</button>
                    </div>
                </div>
            </div>
        `,
        html: `<button class="button" data-variant="destructive" data-intent-event="INTENT_ALERT_DIALOG_OPEN" data-intent-id="explorer-alert-dialog">
    Delete item
</button>
<div class="alert-dialog-overlay" id="explorer-alert-dialog" role="alertdialog" aria-modal="true" data-state="closed">
    <div class="alert-dialog-content">
        <div class="alert-dialog-header">
            <div class="alert-dialog-icon" data-variant="danger"><img src="../../ui/icons/trash.svg" alt=""></div>
            <div class="alert-dialog-title-group">
                <h3 class="alert-dialog-title">Delete explorer preview?</h3>
                <p class="alert-dialog-description">This action cannot be undone.</p>
            </div>
        </div>
        <div class="alert-dialog-footer">
            <button class="alert-dialog-cancel" data-intent-event="INTENT_ALERT_DIALOG_CLOSE" data-intent-id="explorer-alert-dialog">Cancel</button>
            <button class="alert-dialog-action" data-intent-event="INTENT_ALERT_DIALOG_CLOSE" data-intent-id="explorer-alert-dialog">Delete</button>
        </div>
    </div>
</div>`,
        css: null
    },
    {
        id: 'drawer',
        name: 'Drawer',
        category: 'Overlay',
        type: 'js',
        description: 'Side panel overlays',
        preview: `
            <button class="button" data-variant="secondary" data-intent-event="INTENT_DRAWER_OPEN" data-intent-drawer-id="explorer-drawer">
                Open drawer
            </button>
            <div class="drawer-overlay" id="explorer-drawer" data-state="closed">
                <aside class="drawer" data-side="right" data-size="sm" data-state="closed">
                    <div class="drawer-header">
                        <h3 class="drawer-title">Explorer drawer</h3>
                        <button class="drawer-close" aria-label="Close drawer">×</button>
                    </div>
                    <div class="drawer-body">
                        Use drawers for settings, filters, or action summaries without leaving the current page.
                    </div>
                    <div class="drawer-footer">
                        <button class="button" data-variant="secondary" data-intent-event="INTENT_DRAWER_CLOSE" data-intent-drawer-id="explorer-drawer">Close</button>
                        <button class="button" data-variant="primary">Save</button>
                    </div>
                </aside>
            </div>
        `,
        html: `<button class="button" data-variant="secondary" data-intent-event="INTENT_DRAWER_OPEN" data-intent-drawer-id="explorer-drawer">
    Open drawer
</button>
<div class="drawer-overlay" id="explorer-drawer" data-state="closed">
    <aside class="drawer" data-side="right" data-size="sm" data-state="closed">
        <div class="drawer-header">
            <h3 class="drawer-title">Explorer drawer</h3>
            <button class="drawer-close" aria-label="Close drawer">×</button>
        </div>
        <div class="drawer-body">Content</div>
    </aside>
</div>`,
        css: null
    },
    {
        id: 'command',
        name: 'Command',
        category: 'Overlay',
        type: 'js',
        description: 'Command palette for quick actions',
        preview: `
            <div style="display: flex; flex-direction: column; gap: 0.75rem; align-items: center; width: 100%;">
                <button class="button" data-variant="secondary" data-intent-event="INTENT_COMMAND_OPEN" data-intent-trigger="click">
                    Open command palette
                </button>
                <div class="command-overlay" data-state="closed">
                    <div class="command">
                        <div class="command-input-wrapper">
                            <svg class="command-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                            <input type="text" class="command-input" placeholder="Type a command...">
                        </div>
                        <div class="command-list">
                            <div class="command-group">
                                <div class="command-group-heading">Suggestions</div>
                                <div class="command-group-items">
                                    <button class="command-item" data-action="open-demo" data-value="dialog">
                                        <span class="command-item-label">Open dialog demo</span>
                                    </button>
                                    <button class="command-item" data-action="open-demo" data-value="carousel">
                                        <span class="command-item-label">Open carousel demo</span>
                                    </button>
                                    <button class="command-item" data-action="show-toast" data-value="success">
                                        <span class="command-item-label">Show success toast</span>
                                    </button>
                                </div>
                            </div>
                            <div class="command-empty" style="display: none;">No commands found.</div>
                        </div>
                    </div>
                </div>
            </div>
        `,
        html: `<button class="button" data-variant="secondary" data-intent-event="INTENT_COMMAND_OPEN" data-intent-trigger="click">
    Open command palette
</button>
<div class="command-overlay" data-state="closed">
    <div class="command">
        <div class="command-input-wrapper">
            <svg class="command-icon">...</svg>
            <input type="text" class="command-input" placeholder="Search commands...">
        </div>
        <div class="command-list">
            <div class="command-group">
                <div class="command-group-heading">Suggestions</div>
                <div class="command-group-items">
                    <button class="command-item" data-action="open-demo" data-value="dialog">
                        <span class="command-item-label">Open dialog demo</span>
                    </button>
                </div>
            </div>
            <div class="command-empty" style="display: none;">No commands found.</div>
        </div>
    </div>
</div>`,
        css: null
    },

    // ============================================
    // Navigation Components
    // ============================================
    {
        id: 'navbar',
        name: 'Navbar',
        category: 'Navigation',
        type: 'js',
        description: 'Responsive navigation with mobile menu',
        demoPath: '/src/ui/components/navbar/navbar.demo.html',
        preview: `
            <nav class="navbar" id="explorer-navbar" style="width: 100%; max-width: 34rem;">
                <div class="navbar-container">
                    <a href="#home" class="navbar-brand">CSMA</a>
                    <ul class="navbar-nav">
                        <li class="navbar-item"><a href="#home" class="navbar-link" data-nav-path="/home">Home</a></li>
                        <li class="navbar-item"><a href="#components" class="navbar-link" data-nav-path="/components">Components</a></li>
                        <li class="navbar-item"><a href="#docs" class="navbar-link" data-nav-path="/docs">Docs</a></li>
                    </ul>
                    <button class="navbar-hamburger" aria-label="Toggle navigation menu">
                        <span class="navbar-hamburger-lines"></span>
                    </button>
                </div>
                <div class="navbar-overlay"></div>
                <div class="navbar-mobile-menu">
                    <nav aria-label="Mobile navigation">
                        <ul class="navbar-mobile-nav">
                            <li><a href="#home" class="navbar-link" data-nav-path="/home">Home</a></li>
                            <li><a href="#components" class="navbar-link" data-nav-path="/components">Components</a></li>
                            <li><a href="#docs" class="navbar-link" data-nav-path="/docs">Docs</a></li>
                        </ul>
                    </nav>
                </div>
            </nav>
        `,
        html: `<nav class="navbar" id="main-navbar">
    <div class="navbar-container">
        <a href="#home" class="navbar-brand">CSMA</a>
        <ul class="navbar-nav">
            <li class="navbar-item"><a href="#home" class="navbar-link" data-nav-path="/home">Home</a></li>
            <li class="navbar-item"><a href="#components" class="navbar-link" data-nav-path="/components">Components</a></li>
            <li class="navbar-item"><a href="#docs" class="navbar-link" data-nav-path="/docs">Docs</a></li>
        </ul>
        <button class="navbar-hamburger" aria-label="Toggle navigation menu">
            <span class="navbar-hamburger-lines"></span>
        </button>
    </div>
    <div class="navbar-overlay"></div>
    <div class="navbar-mobile-menu">
        <nav aria-label="Mobile navigation">
            <ul class="navbar-mobile-nav">
                <li><a href="#home" class="navbar-link" data-nav-path="/home">Home</a></li>
            </ul>
        </nav>
    </div>
</nav>`,
        css: null
    },
    {
        id: 'menubar',
        name: 'Menubar',
        category: 'Navigation',
        type: 'js',
        description: 'Horizontal menu bar like OS applications',
        preview: `
            <div class="menubar" style="width: min(100%, 28rem);">
                <div class="menubar-menu" id="explorer-menu-file">
                    <button class="menubar-trigger">File</button>
                    <div class="menubar-content">
                        <div class="menubar-item" role="menuitem" tabindex="0"><span class="menubar-item-label">New explorer</span></div>
                        <div class="menubar-item" role="menuitem" tabindex="0"><span class="menubar-item-label">Open demo</span></div>
                        <div class="menubar-separator"></div>
                        <div class="menubar-item" role="menuitem" tabindex="0"><span class="menubar-item-label">Export snapshot</span></div>
                    </div>
                </div>
                <div class="menubar-menu" id="explorer-menu-view">
                    <button class="menubar-trigger">View</button>
                    <div class="menubar-content">
                        <button class="menubar-checkbox-item" data-checked="true"><span class="menubar-item-label">Show sidebar</span></button>
                        <button class="menubar-checkbox-item" data-checked="false"><span class="menubar-item-label">Show runtime snapshot</span></button>
                    </div>
                </div>
            </div>
        `,
        html: `<div class="menubar">
    <div class="menubar-menu" id="menu-file">
        <button class="menubar-trigger">File</button>
        <div class="menubar-content">
            <div class="menubar-item" role="menuitem" tabindex="0"><span class="menubar-item-label">New explorer</span></div>
            <div class="menubar-item" role="menuitem" tabindex="0"><span class="menubar-item-label">Open demo</span></div>
        </div>
    </div>
</div>`,
        css: null
    },
    {
        id: 'navigation-menu',
        name: 'Navigation Menu',
        category: 'Navigation',
        type: 'js',
        description: 'Complex navigation with nested dropdowns',
        preview: `
            <nav class="navigation-menu" style="width: min(100%, 34rem);">
                <ul class="navigation-menu-list">
                    <li class="navigation-menu-item">
                        <a class="navigation-menu-link" href="#home">Home</a>
                    </li>
                    <li class="navigation-menu-item">
                        <button class="navigation-menu-trigger">
                            Products
                            <svg class="navigation-menu-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <div class="navigation-menu-content">
                            <a class="navigation-menu-content-item" href="#runtime" data-id="runtime">
                                <span class="navigation-menu-content-item-title">Runtime</span>
                                <span class="navigation-menu-content-item-description">EventBus, contracts, lifecycle</span>
                            </a>
                            <a class="navigation-menu-content-item" href="#components" data-id="components">
                                <span class="navigation-menu-content-item-title">Components</span>
                                <span class="navigation-menu-content-item-description">Explorer-ready UI primitives</span>
                            </a>
                        </div>
                    </li>
                </ul>
            </nav>
        `,
        html: `<nav class="navigation-menu">
    <ul class="navigation-menu-list">
        <li class="navigation-menu-item">
            <a class="navigation-menu-link" href="#home">Home</a>
        </li>
        <li class="navigation-menu-item">
            <button class="navigation-menu-trigger">
                Products
                <svg class="navigation-menu-trigger-icon">...</svg>
            </button>
            <div class="navigation-menu-content">
                <a class="navigation-menu-content-item" href="#runtime" data-id="runtime">
                    <span class="navigation-menu-content-item-title">Runtime</span>
                    <span class="navigation-menu-content-item-description">EventBus, contracts, lifecycle</span>
                </a>
            </div>
        </li>
    </ul>
</nav>`,
        css: null
    },
    {
        id: 'breadcrumb',
        name: 'Breadcrumb',
        category: 'Navigation',
        type: 'css',
        description: 'Navigation breadcrumbs with truncation',
        preview: `
            <nav class="breadcrumb">
                <a class="breadcrumb-link" href="#">Home</a>
                <span class="breadcrumb-separator">/</span>
                <a class="breadcrumb-link" href="#">Components</a>
                <span class="breadcrumb-separator">/</span>
                <span class="breadcrumb-current">Explorer</span>
            </nav>
        `,
        html: `<nav class="breadcrumb">
    <a class="breadcrumb-link" href="#">Home</a>
    <span class="breadcrumb-separator">/</span>
    <a class="breadcrumb-link" href="#">Category</a>
    <span class="breadcrumb-separator">/</span>
    <span class="breadcrumb-current">Current Page</span>
</nav>`,
        css: null
    },
    {
        id: 'pagination',
        name: 'Pagination',
        category: 'Navigation',
        type: 'js',
        description: 'Page navigation controls',
        demoPath: '/src/ui/components/pagination/pagination.demo.html',
        preview: `
            <nav class="pagination" aria-label="Explorer pagination">
                <button class="pagination-button pagination-prev" data-state="disabled">← Prev</button>
                <button class="pagination-button" data-state="active" aria-current="page">1</button>
                <button class="pagination-button">2</button>
                <button class="pagination-button">3</button>
                <button class="pagination-button">4</button>
                <button class="pagination-button pagination-next">Next →</button>
            </nav>
        `,
        html: `<nav class="pagination" aria-label="Explorer pagination">
    <button class="pagination-button pagination-prev" data-state="disabled">← Prev</button>
    <button class="pagination-button" data-state="active" aria-current="page">1</button>
    <button class="pagination-button">2</button>
    <button class="pagination-button">3</button>
    <button class="pagination-button">4</button>
    <button class="pagination-button pagination-next">Next →</button>
</nav>`,
        css: null
    },

    // ============================================
    // Data Components
    // ============================================
    {
        id: 'table',
        name: 'Table',
        category: 'Data',
        type: 'js',
        description: 'Data tables with sorting and selection',
        preview: `
            <div class="table-container" style="width: 100%;">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Item 1</td>
                            <td><span class="badge" data-variant="success">Active</span></td>
                        </tr>
                        <tr>
                            <td>Item 2</td>
                            <td><span class="badge" data-variant="warning">Pending</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `,
        html: `<div class="table-container">
    <table class="table">
        <thead>
            <tr>
                <th>Name</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Item 1</td>
                <td>Active</td>
            </tr>
        </tbody>
    </table>
</div>`,
        css: null
    },
    {
        id: 'multi-select',
        name: 'Multi-Select',
        category: 'Data',
        type: 'js',
        description: 'Multiple selection dropdown',
        preview: `
            <div class="multi-select" style="width: min(100%, 18rem);" data-selected='["runtime"]'>
                <div class="multi-select-trigger">
                    <div class="multi-select-tags"></div>
                    <span class="multi-select-placeholder">Select items...</span>
                    <input class="multi-select-input" type="text" placeholder="Filter components">
                    <svg class="multi-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                <div class="multi-select-dropdown" data-state="closed">
                    <div class="multi-select-option" data-value="runtime" data-selected="true">
                        <span class="multi-select-checkbox"><svg class="multi-select-checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
                        <span class="multi-select-option-label">Runtime</span>
                    </div>
                    <div class="multi-select-option" data-value="components">
                        <span class="multi-select-checkbox"><svg class="multi-select-checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
                        <span class="multi-select-option-label">Components</span>
                    </div>
                    <div class="multi-select-option" data-value="docs">
                        <span class="multi-select-checkbox"><svg class="multi-select-checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></span>
                        <span class="multi-select-option-label">Docs</span>
                    </div>
                    <div class="multi-select-empty" style="display: none;">No results found.</div>
                </div>
            </div>
        `,
        html: `<div class="multi-select" data-selected='["runtime"]'>
    <div class="multi-select-trigger">
        <div class="multi-select-tags"></div>
        <span class="multi-select-placeholder">Select items...</span>
        <input class="multi-select-input" type="text" placeholder="Filter components">
        <svg class="multi-select-chevron">...</svg>
    </div>
    <div class="multi-select-dropdown" data-state="closed">
        <div class="multi-select-option" data-value="runtime" data-selected="true">
            <span class="multi-select-checkbox"><svg class="multi-select-checkbox-icon">...</svg></span>
            <span class="multi-select-option-label">Runtime</span>
        </div>
    </div>
</div>`,
        css: null
    },
    {
        id: 'file-upload',
        name: 'File Upload',
        category: 'Data',
        type: 'js',
        description: 'Drag-and-drop file uploads with progress',
        demoPath: '/src/ui/components/file-upload/file-upload.demo.html',
        preview: `
            <div class="file-upload" data-component="file-upload" style="width: min(100%, 26rem);">
                <div class="file-upload__dropzone" data-fu-dropzone tabindex="0" role="button" aria-label="Upload files">
                    <div class="file-upload__icon"><img src="/src/ui/icons/upload.svg" alt=""></div>
                    <div class="file-upload__text">
                        <span class="file-upload__primary">Click or drag files to upload</span>
                        <span class="file-upload__secondary">Images, PDF, text, audio, video</span>
                    </div>
                    <input class="file-upload__input" data-fu-input type="file" multiple aria-label="Choose files to upload">
                </div>
                <div class="file-upload__queue" data-fu-queue></div>
                <div class="file-upload__empty" data-fu-empty>No files yet. Add some to get started.</div>
            </div>
        `,
        html: `<div class="file-upload" data-component="file-upload">
    <div class="file-upload__dropzone" data-fu-dropzone tabindex="0" role="button" aria-label="Upload files">
        <div class="file-upload__icon"><img src="/src/ui/icons/upload.svg" alt=""></div>
        <div class="file-upload__text">
            <span class="file-upload__primary">Click or drag files to upload</span>
            <span class="file-upload__secondary">Images, PDF, text, audio, video</span>
        </div>
        <input class="file-upload__input" data-fu-input type="file" multiple aria-label="Choose files to upload">
    </div>
    <div class="file-upload__queue" data-fu-queue></div>
    <div class="file-upload__empty" data-fu-empty>No files yet. Add some to get started.</div>
</div>`,
        css: null
    },

    // ============================================
    // Layout Components
    // ============================================
    {
        id: 'resizable',
        name: 'Resizable',
        category: 'Layout',
        type: 'js',
        description: 'Panels with draggable resize handles',
        preview: `
            <div class="resizable" data-orientation="horizontal" data-variant="bordered" style="width: min(100%, 24rem); height: 14rem; position: relative;">
                <div class="resizable-panel" style="background: var(--fx-color-bg-muted); padding: 1rem;">
                    Navigation
                </div>
                <div class="resizable-handle" data-with-handle="true"></div>
                <div class="resizable-panel" style="background: var(--fx-color-surface); padding: 1rem;">
                    Content
                </div>
            </div>
        `,
        html: `<div class="resizable" data-orientation="horizontal" data-variant="bordered">
    <div class="resizable-panel">Panel 1</div>
    <div class="resizable-handle" data-with-handle="true"></div>
    <div class="resizable-panel">Panel 2</div>
</div>`,
        css: null
    }
];
