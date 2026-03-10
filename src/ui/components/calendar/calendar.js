/**
 * CSMA Calendar Component
 * Date picker calendar using EventBus
 * 
 * Contracts: INTENT_CALENDAR_SELECT, CALENDAR_DATE_SELECTED
 */

/**
 * Initialize Calendar system with EventBus integration
 * @param {EventBus} eventBus - CSMA EventBus instance
 * @returns {Function} Cleanup function
 */
export function initCalendarSystem(eventBus) {
    if (!eventBus) {
        console.warn('[Calendar] EventBus not provided');
        return () => {};
    }

    const cleanups = [];
    const calendars = document.querySelectorAll('.calendar');

    calendars.forEach(calendar => {
        const cleanup = initCalendar(calendar, eventBus);
        cleanups.push(cleanup);
    });

    const unsubscribe = eventBus.subscribe('INTENT_CALENDAR_SELECT', (payload) => {
        const calendar = document.getElementById(payload.calendarId);
        if (calendar) {
            selectDate(calendar, payload.date, eventBus);
        }
    });

    return () => {
        unsubscribe();
        cleanups.forEach(cleanup => cleanup());
    };
}

/**
 * Initialize a single calendar
 */
function initCalendar(container, eventBus) {
    // Assign ID if not present
    if (!container.id) {
        container.id = `calendar-${Math.random().toString(36).substr(2, 9)}`;
    }

    const eventHandlers = [];
    let selectedDate = null;
    let viewDate = new Date();

    // Parse initial date from data attribute
    if (container.dataset.selected) {
        selectedDate = new Date(container.dataset.selected);
        viewDate = new Date(selectedDate);
    }

    // Parse min/max dates
    const minDate = container.dataset.min ? new Date(container.dataset.min) : null;
    const maxDate = container.dataset.max ? new Date(container.dataset.max) : null;

    const prevBtn = container.querySelector('.calendar-nav-btn[data-action="prev"]');
    const nextBtn = container.querySelector('.calendar-nav-btn[data-action="next"]');
    const monthSelect = container.querySelector('.calendar-month-select');
    const yearSelect = container.querySelector('.calendar-year-select');
    const todayBtn = container.querySelector('.calendar-today-btn');

    const rerender = () => {
        selectedDate = container.dataset.selected ? new Date(container.dataset.selected) : null;
        renderCalendar(container, viewDate, selectedDate, minDate, maxDate, eventBus, eventHandlers);
    };

    // Render calendar
    rerender();

    if (prevBtn) {
        const handlePrev = () => {
            viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
            rerender();
        };
        prevBtn.addEventListener('click', handlePrev);
        eventHandlers.push({ element: prevBtn, event: 'click', handler: handlePrev });
    }

    if (nextBtn) {
        const handleNext = () => {
            viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
            rerender();
        };
        nextBtn.addEventListener('click', handleNext);
        eventHandlers.push({ element: nextBtn, event: 'click', handler: handleNext });
    }

    if (monthSelect) {
        const handleMonthChange = (event) => {
            viewDate = new Date(viewDate.getFullYear(), Number(event.target.value), 1);
            rerender();
        };
        monthSelect.addEventListener('change', handleMonthChange);
        eventHandlers.push({ element: monthSelect, event: 'change', handler: handleMonthChange });
    }

    if (yearSelect) {
        const handleYearChange = (event) => {
            viewDate = new Date(Number(event.target.value), viewDate.getMonth(), 1);
            rerender();
        };
        yearSelect.addEventListener('change', handleYearChange);
        eventHandlers.push({ element: yearSelect, event: 'change', handler: handleYearChange });
    }

    if (todayBtn) {
        const handleToday = () => {
            const today = new Date();
            viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
            selectDate(container, today, eventBus);
            rerender();
        };
        todayBtn.addEventListener('click', handleToday);
        eventHandlers.push({ element: todayBtn, event: 'click', handler: handleToday });
    }

    return () => {
        eventHandlers.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
    };
}

/**
 * Render the calendar grid
 */
function renderCalendar(container, viewDate, selectedDate, minDate, maxDate, eventBus, eventHandlers) {
    const header = container.querySelector('.calendar-header');
    const grid = container.querySelector('.calendar-grid');
    
    if (!grid) return;

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const today = new Date();

    // Update header
    if (header) {
        const monthSelect = header.querySelector('.calendar-month-select');
        const yearSelect = header.querySelector('.calendar-year-select');
        
        if (monthSelect) {
            monthSelect.value = month;
        }
        if (yearSelect) {
            yearSelect.value = year;
        }
    }

    // Clear existing days (keep weekdays)
    const existingDays = grid.querySelectorAll('.calendar-day');
    existingDays.forEach(day => day.remove());

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
        const day = createDayElement(prevMonthLastDay - i, true, false, null, null, null);
        day.dataset.outside = 'true';
        grid.appendChild(day);
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const isToday = isSameDay(date, today);
        const isSelected = selectedDate && isSameDay(date, selectedDate);
        const isDisabled = isDateDisabled(date, minDate, maxDate);
        
        const dayEl = createDayElement(
            day,
            false,
            isToday,
            isSelected,
            isDisabled,
            date.toISOString().split('T')[0]
        );

        if (!isDisabled) {
            const handleClick = () => {
                selectDate(container, date, eventBus);
            };
            dayEl.addEventListener('click', handleClick);
            eventHandlers.push({ element: dayEl, event: 'click', handler: handleClick });
        }

        grid.appendChild(dayEl);
    }

    // Next month days
    const remainingDays = 42 - (startingDay + totalDays);
    for (let i = 1; i <= remainingDays; i++) {
        const day = createDayElement(i, true, false, null, null, null);
        day.dataset.outside = 'true';
        grid.appendChild(day);
    }
}

/**
 * Create a day element
 */
function createDayElement(day, isOutside, isToday, isSelected, isDisabled, dateStr) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'calendar-day';
    el.textContent = day;
    
    if (dateStr) el.dataset.date = dateStr;
    if (isOutside) el.dataset.outside = 'true';
    if (isToday) el.dataset.today = 'true';
    if (isSelected) el.dataset.selected = 'true';
    if (isDisabled) el.disabled = true;

    return el;
}

/**
 * Select a date
 */
function selectDate(container, date, eventBus) {
    // Clear previous selection
    const prevSelected = container.querySelector('.calendar-day[data-selected="true"]');
    if (prevSelected) {
        prevSelected.dataset.selected = 'false';
        delete prevSelected.dataset.selected;
    }

    // Set new selection
    const dateStr = date.toISOString().split('T')[0];
    const dayEl = container.querySelector(`[data-date="${dateStr}"]`);
    if (dayEl) {
        dayEl.dataset.selected = 'true';
    }

    // Update container data
    container.dataset.selected = dateStr;

    eventBus.publish('CALENDAR_DATE_SELECTED', {
        calendarId: container.id,
        date: dateStr,
        timestamp: Date.now()
    });
}

/**
 * Check if two dates are the same day
 */
function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

/**
 * Check if date is disabled
 */
function isDateDisabled(date, minDate, maxDate) {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
}
