/**
 * CSMA Date Range Picker Component
 * Dual calendar for selecting date ranges using EventBus
 * 
 * Contracts: INTENT_DATE_RANGE_SELECT, DATE_RANGE_CHANGED
 */

/**
 * Initialize Date Range Picker system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initDateRangePickerSystem(eventBus) {
    if (!eventBus) {
        console.warn('[DateRangePicker] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const pickers = document.querySelectorAll('.date-range-picker');

    pickers.forEach(picker => {
        const cleanup = initDateRangePicker(picker, eventBus);
        cleanups.push(cleanup);
    });

    return () => {
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single date range picker
 */
function initDateRangePicker(picker, eventBus) {
    const trigger = picker.querySelector('.date-range-trigger');
    const content = picker.querySelector('.date-range-content');
    const eventHandlers = [];

    if (!trigger || !content) return () => {};

    // Assign ID if not present
    if (!picker.id) {
        picker.id = `date-range-picker-${Math.random().toString(36).substr(2, 9)}`;
    }

    let isOpen = false;
    let startDate = null;
    let endDate = null;
    let selectingEnd = false;

    // Current view months
    let leftMonth = new Date();
    let rightMonth = new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1);

    const open = () => {
        isOpen = true;
        content.dataset.state = 'open';
        trigger.dataset.state = 'open';
        renderCalendars();
    };

    const close = () => {
        isOpen = false;
        content.dataset.state = 'closed';
        trigger.dataset.state = 'closed';
    };

    const toggle = () => {
        if (isOpen) close();
        else open();
    };

    // Click trigger
    const handleTriggerClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
    };

    trigger.addEventListener('click', handleTriggerClick);
    eventHandlers.push({ element: trigger, event: 'click', handler: handleTriggerClick });

    // Render calendars
    const renderCalendars = () => {
        const calendars = content.querySelectorAll('.date-range-calendar');
        
        calendars.forEach((calendar, index) => {
            const month = index === 0 ? leftMonth : rightMonth;
            renderCalendar(calendar, month, index === 0 ? 'left' : 'right');
        });
    };

    const renderCalendar = (calendar, month, position) => {
        const title = calendar.querySelector('.date-range-calendar-title');
        const grid = calendar.querySelector('.date-range-calendar-grid');
        
        if (!grid) return;

        // Update title
        if (title) {
            title.textContent = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }

        // Clear grid (keep headers)
        const headers = grid.querySelectorAll('.date-range-calendar-day-header');
        grid.innerHTML = '';
        headers.forEach(h => grid.appendChild(h));

        // Add headers if not present
        if (headers.length === 0) {
            const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
            dayNames.forEach(day => {
                const header = document.createElement('div');
                header.className = 'date-range-calendar-day-header';
                header.textContent = day;
                grid.appendChild(header);
            });
        }

        // Get first day of month and total days
        const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
        const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        const startOffset = firstDay.getDay();
        const totalDays = lastDay.getDate();

        // Add days from previous month
        const prevMonth = new Date(month.getFullYear(), month.getMonth(), 0);
        for (let i = startOffset - 1; i >= 0; i--) {
            const day = document.createElement('div');
            day.className = 'date-range-calendar-day';
            day.textContent = prevMonth.getDate() - i;
            day.dataset.outside = 'true';
            day.dataset.disabled = 'true';
            grid.appendChild(day);
        }

        // Add days of current month
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 1; i <= totalDays; i++) {
            const day = document.createElement('div');
            day.className = 'date-range-calendar-day';
            day.textContent = i;
            
            const date = new Date(month.getFullYear(), month.getMonth(), i);
            const dateStr = formatDate(date);
            
            day.dataset.date = dateStr;
            
            // Today
            if (date.getTime() === today.getTime()) {
                day.dataset.today = 'true';
            }

            // Selected
            if (startDate && dateStr === formatDate(startDate)) {
                day.dataset.selected = 'true';
                day.dataset.range = 'start';
            }
            if (endDate && dateStr === formatDate(endDate)) {
                day.dataset.selected = 'true';
                day.dataset.range = startDate && formatDate(startDate) === dateStr ? 'single' : 'end';
            }

            // In range
            if (startDate && endDate && date > startDate && date < endDate) {
                day.dataset.range = 'middle';
            }

            // Click handler
            const handleDayClick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                selectDate(date);
            };

            day.addEventListener('click', handleDayClick);
            eventHandlers.push({ element: day, event: 'click', handler: handleDayClick });

            grid.appendChild(day);
        }

        // Add days from next month
        const remaining = 42 - (startOffset + totalDays);
        for (let i = 1; i <= remaining; i++) {
            const day = document.createElement('div');
            day.className = 'date-range-calendar-day';
            day.textContent = i;
            day.dataset.outside = 'true';
            day.dataset.disabled = 'true';
            grid.appendChild(day);
        }
    };

    const selectDate = (date) => {
        if (!startDate || (startDate && endDate)) {
            // Start new selection
            startDate = date;
            endDate = null;
            selectingEnd = true;
            updateTriggerDisplay();
        } else if (selectingEnd) {
            // Select end date
            if (date < startDate) {
                endDate = startDate;
                startDate = date;
            } else {
                endDate = date;
            }
            selectingEnd = false;

            // Publish selection
            eventBus.publish('DATE_RANGE_CHANGED', {
                pickerId: picker.id,
                startDate: formatDate(startDate),
                endDate: formatDate(endDate),
                startDateObj: startDate,
                endDateObj: endDate,
                timestamp: Date.now()
            });

            // Update trigger display
            updateTriggerDisplay();
            close();
        }

        renderCalendars();
    };

    const updateTriggerDisplay = () => {
        const valueEl = trigger.querySelector('.date-range-trigger-value');
        if (!valueEl) return;

        if (startDate && endDate) {
            const format = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            valueEl.innerHTML = `<span>${format(startDate)}</span> – <span>${format(endDate)}</span>`;
            valueEl.classList.remove('date-range-trigger-placeholder');
            return;
        }

        if (startDate) {
            const format = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            valueEl.textContent = `${format(startDate)} → Pick end date`;
            valueEl.classList.remove('date-range-trigger-placeholder');
            return;
        }

        valueEl.textContent = 'Select date range';
        valueEl.classList.add('date-range-trigger-placeholder');
    };

    // Navigation
    const setupNavigation = () => {
        const calendars = content.querySelectorAll('.date-range-calendar');
        
        calendars.forEach((calendar, index) => {
            const prevBtn = calendar.querySelector('.date-range-calendar-nav-btn[data-dir="prev"]');
            const nextBtn = calendar.querySelector('.date-range-calendar-nav-btn[data-dir="next"]');

            if (prevBtn) {
                const handlePrev = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (index === 0) {
                        leftMonth = new Date(leftMonth.getFullYear(), leftMonth.getMonth() - 1, 1);
                        rightMonth = new Date(rightMonth.getFullYear(), rightMonth.getMonth() - 1, 1);
                    }
                    renderCalendars();
                };
                prevBtn.addEventListener('click', handlePrev);
                eventHandlers.push({ element: prevBtn, event: 'click', handler: handlePrev });
            }

            if (nextBtn) {
                const handleNext = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (index === 1) {
                        leftMonth = new Date(leftMonth.getFullYear(), leftMonth.getMonth() + 1, 1);
                        rightMonth = new Date(rightMonth.getFullYear(), rightMonth.getMonth() + 1, 1);
                    }
                    renderCalendars();
                };
                nextBtn.addEventListener('click', handleNext);
                eventHandlers.push({ element: nextBtn, event: 'click', handler: handleNext });
            }
        });
    };

    setupNavigation();

    // Presets
    const presets = content.querySelectorAll('.date-range-preset');
    presets.forEach(preset => {
        const handlePresetClick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            const range = preset.dataset.range;
            const dates = getPresetRange(range);
            if (dates) {
                startDate = dates.start;
                endDate = dates.end;
                renderCalendars();
                updateTriggerDisplay();
                
                eventBus.publish('DATE_RANGE_CHANGED', {
                    pickerId: picker.id,
                    startDate: formatDate(startDate),
                    endDate: formatDate(endDate),
                    preset: range,
                    timestamp: Date.now()
                });
            }
        };

        preset.addEventListener('click', handlePresetClick);
        eventHandlers.push({ element: preset, event: 'click', handler: handlePresetClick });
    });

    // Close on outside click
    const handleOutsideClick = (e) => {
        if (!picker.contains(e.target)) {
            close();
        }
    };

    document.addEventListener('click', handleOutsideClick);
    eventHandlers.push({ element: document, event: 'click', handler: handleOutsideClick });

    // Keyboard handling
    const handleKeyDown = (e) => {
        if (e.key === 'Escape' && isOpen) {
            e.preventDefault();
            close();
        }
    };

    picker.addEventListener('keydown', handleKeyDown);
    eventHandlers.push({ element: picker, event: 'keydown', handler: handleKeyDown });

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Get preset date range
 */
function getPresetRange(preset) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ranges = {
        'today': { start: today, end: today },
        'yesterday': {
            start: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1),
            end: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
        },
        'last7': {
            start: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6),
            end: today
        },
        'last30': {
            start: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29),
            end: today
        },
        'thisMonth': {
            start: new Date(today.getFullYear(), today.getMonth(), 1),
            end: new Date(today.getFullYear(), today.getMonth() + 1, 0)
        },
        'lastMonth': {
            start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
            end: new Date(today.getFullYear(), today.getMonth(), 0)
        }
    };

    return ranges[preset] || null;
}
