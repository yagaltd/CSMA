/**
 * CSMA Datepicker Component (Type III - Service-backed)
 *
 * Features:
 * - Single-date picker with keyboard navigation
 * - Date-range picker with hover preview and automatic highlighting
 * - Modal lifecycle managed via CSS-class reactivity (no inline styles)
 * - EventBus integration (DATE_SELECTED + CALENDAR_RENDERED contracts)
 * - Zero-trust friendly: no innerHTML with user data, readonly inputs
 */

import { createDateService } from '../../../services/DateService.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KEYBOARD_NAV_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown'
]);

export function initDatepickerUI(eventBus) {
    const dateService = createDateService(eventBus);
    const instances = [];
    const nodes = document.querySelectorAll('[data-datepicker]');

    nodes.forEach((root, index) => {
        const instance = new DatepickerInstance(root, dateService, eventBus, index + 1);
        if (instance.isReady) {
            instances.push(instance);
        }
    });

    if (instances.length) {
        console.log(`[Datepicker] Initialized ${instances.length} instance(s)`);
    } else {
        console.log('[Datepicker] No datepicker instances detected');
    }

    return () => {
        instances.forEach(instance => instance.destroy());
    };
}

class DatepickerInstance {
    constructor(root, dateService, eventBus, instanceId) {
        this.root = root;
        this.dateService = dateService;
        this.eventBus = eventBus;
        this.instanceId = instanceId;

        // DOM references
        this.field = root.querySelector('[data-datepicker-field]');
        this.modal = root.querySelector('[data-datepicker-modal]');
        this.overlay = root.querySelector('[data-datepicker-overlay]');
        this.panel = root.querySelector('[data-datepicker-panel]');
        this.monthLabel = root.querySelector('[data-datepicker-month]');
        this.weekdaysRow = root.querySelector('[data-datepicker-weekdays]');
        this.grid = root.querySelector('[data-datepicker-grid]');
        this.display = root.querySelector('[data-datepicker-display]');
        this.prevButton = root.querySelector('[data-action="prev"]');
        this.nextButton = root.querySelector('[data-action="next"]');
        this.todayButton = root.querySelector('[data-action="today"]');

        if (!this.field || !this.modal || !this.panel || !this.monthLabel || !this.grid) {
            console.warn('[Datepicker] Missing required DOM nodes. Component skipped.', root);
            this.isReady = false;
            return;
        }

        // Mode + state
        this.mode = root.dataset.mode === 'range' ? 'range' : 'single';
        const now = new Date();
        this.currentYear = now.getFullYear();
        this.currentMonth = now.getMonth();
        this.focusedDate = new Date(now);
        this.selectedDate = null;
        this.startDate = null;
        this.endDate = null;
        this.hoverDate = null;
        this.isOpen = false;

        // Bound handlers for cleanup
        this.handleFieldClick = () => this.toggle();
        this.handleFieldKeydown = (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.open();
            }
        };
        this.handlePrevClick = () => this.navigateMonth(-1);
        this.handleNextClick = () => this.navigateMonth(1);
        this.handleTodayClick = () => this.selectToday();
        this.handleOverlayClick = () => this.close();
        this.handleDocumentPointerDown = this.onDocumentPointerDown.bind(this);
        this.handlePanelKeydown = (event) => this.onPanelKeydown(event);
        this.handleGridMouseLeave = () => this.clearHoverPreview();

        this.isReady = true;
        this.init();
    }

    init() {
        this.populateWeekdays();

        this.field.setAttribute('readonly', 'readonly');
        this.field.setAttribute('aria-haspopup', 'dialog');
        this.field.setAttribute('aria-expanded', 'false');
        this.field.addEventListener('click', this.handleFieldClick);
        this.field.addEventListener('keydown', this.handleFieldKeydown);

        this.prevButton?.addEventListener('click', this.handlePrevClick);
        this.nextButton?.addEventListener('click', this.handleNextClick);
        this.todayButton?.addEventListener('click', this.handleTodayClick);
        this.overlay?.addEventListener('click', this.handleOverlayClick);
        this.grid.addEventListener('mouseleave', this.handleGridMouseLeave);

        this.renderCalendar();
        this.updateFieldDisplay();
    }

    destroy() {
        this.close();
        this.field.removeEventListener('click', this.handleFieldClick);
        this.field.removeEventListener('keydown', this.handleFieldKeydown);
        this.prevButton?.removeEventListener('click', this.handlePrevClick);
        this.nextButton?.removeEventListener('click', this.handleNextClick);
        this.todayButton?.removeEventListener('click', this.handleTodayClick);
        this.overlay?.removeEventListener('click', this.handleOverlayClick);
        this.grid.removeEventListener('mouseleave', this.handleGridMouseLeave);
    }

    populateWeekdays() {
        if (!this.weekdaysRow || this.weekdaysRow.childElementCount) return;
        DAY_NAMES.forEach(name => {
            const cell = document.createElement('span');
            cell.className = 'datepicker-weekday';
            cell.textContent = name;
            this.weekdaysRow.appendChild(cell);
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.root.classList.add('is-open');
        this.modal.removeAttribute('aria-hidden');
        this.field.setAttribute('aria-expanded', 'true');
        document.addEventListener('pointerdown', this.handleDocumentPointerDown);
        this.panel.addEventListener('keydown', this.handlePanelKeydown);
        this.renderCalendar(true);
        this.focusGridButton();
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.root.classList.remove('is-open');
        this.modal.setAttribute('aria-hidden', 'true');
        this.field.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', this.handleDocumentPointerDown);
        this.panel.removeEventListener('keydown', this.handlePanelKeydown);
        this.hoverDate = null;
    }

    onDocumentPointerDown(event) {
        if (!this.root.contains(event.target)) {
            this.close();
        }
    }

    onPanelKeydown(event) {
        if (KEYBOARD_NAV_KEYS.has(event.key)) {
            event.preventDefault();
            this.moveFocus(event.key);
            return;
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.selectDate(new Date(this.focusedDate));
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            this.close();
        }
    }

    moveFocus(key) {
        const candidate = this.dateService.getKeyboardNavigation(this.focusedDate, key);
        const constrained = this.constrainToRange(candidate);
        const previousMonth = this.currentMonth;
        const previousYear = this.currentYear;

        this.focusedDate = constrained;
        this.currentYear = constrained.getFullYear();
        this.currentMonth = constrained.getMonth();

        if (previousMonth !== this.currentMonth || previousYear !== this.currentYear) {
            const direction = new Date(this.currentYear, this.currentMonth) > new Date(previousYear, previousMonth)
                ? 'next'
                : 'prev';
            this.publishCalendarChange(direction);
        }

        this.renderCalendar(true);
    }

    navigateMonth(step) {
        const target = step < 0
            ? this.dateService.previousMonth(this.currentYear, this.currentMonth)
            : this.dateService.nextMonth(this.currentYear, this.currentMonth);

        this.currentYear = target.year;
        this.currentMonth = target.month;
        const direction = step < 0 ? 'prev' : 'next';
        this.publishCalendarChange(direction);
        this.renderCalendar(true);
    }

    selectToday() {
        const today = new Date();
        this.currentYear = today.getFullYear();
        this.currentMonth = today.getMonth();
        this.focusedDate = today;
        this.renderCalendar(true);
        this.selectDate(today);
    }

    selectDate(rawDate) {
        const date = new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate());
        if (!this.isSelectable(date)) return;

        if (this.mode === 'range') {
            this.applyRangeSelection(date);
            return;
        }

        this.selectedDate = date;
        this.focusedDate = new Date(date);
        this.publishSelection(date, null, null);
        this.updateFieldDisplay();
        this.renderCalendar();
        this.close();
    }

    applyRangeSelection(date) {
        if (!this.startDate || (this.startDate && this.endDate)) {
            this.startDate = date;
            this.endDate = null;
            this.hoverDate = null;
            this.focusedDate = new Date(date);
            this.updateFieldDisplay();
            this.renderCalendar();
            return;
        }

        if (date < this.startDate) {
            this.endDate = this.startDate;
            this.startDate = date;
        } else {
            this.endDate = date;
        }

        this.focusedDate = new Date(this.endDate);
        this.hoverDate = null;
        this.publishSelection(this.endDate, this.startDate, this.endDate);
        this.updateFieldDisplay();
        this.renderCalendar();
        this.close();
    }

    publishSelection(primaryDate, rangeStart, rangeEnd) {
        if (!this.eventBus) return;
        const payload = {
            date: this.dateService.formatDate(primaryDate),
            timestamp: Date.now(),
            year: primaryDate.getFullYear(),
            month: primaryDate.getMonth(),
            day: primaryDate.getDate(),
            instanceId: this.instanceId
        };

        if (rangeStart) {
            payload.startDate = this.dateService.formatDate(rangeStart);
        }
        if (rangeEnd) {
            payload.endDate = this.dateService.formatDate(rangeEnd);
        }

        this.eventBus.publish('DATE_SELECTED', payload);
    }

    publishCalendarChange(direction) {
        if (!this.eventBus) return;
        this.eventBus.publish('CALENDAR_RENDERED', {
            year: this.currentYear,
            month: this.currentMonth,
            direction,
            timestamp: Date.now()
        });
    }

    renderCalendar(keepFocus = false) {
        const monthName = this.dateService.getMonthName(this.currentMonth);
        this.monthLabel.textContent = `${monthName} ${this.currentYear}`;
        this.grid.innerHTML = '';

        const calendarDays = this.dateService.buildCalendar(this.currentYear, this.currentMonth, {
            selectedDate: this.mode === 'single' ? this.selectedDate : null,
            minDate: this.getMinDate(),
            maxDate: this.getMaxDate()
        });

        let focusTarget = null;

        calendarDays.forEach(day => {
            const button = this.createDayButton(day);
            if (this.dateService.isSameDate(day.date, this.focusedDate)) {
                button.dataset.focusTarget = 'true';
                focusTarget = button;
            }
            this.grid.appendChild(button);
        });

        if (keepFocus && focusTarget) {
            focusTarget.focus();
        }
    }

    createDayButton(day) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'datepicker-day';
        button.textContent = String(day.day);
        button.dataset.date = this.dateService.formatDate(day.date);
        button.tabIndex = this.dateService.isSameDate(day.date, this.focusedDate) ? 0 : -1;

        if (!day.inCurrentMonth) {
            button.classList.add('is-outside');
        }
        if (!day.isSelectable) {
            button.classList.add('is-disabled');
            button.disabled = true;
        }
        if (day.isToday) {
            button.classList.add('is-today');
        }
        if (this.mode === 'single' && this.selectedDate && this.dateService.isSameDate(day.date, this.selectedDate)) {
            button.classList.add('is-selected');
        }
        if (this.mode === 'range') {
            if (this.isRangeStart(day.date)) {
                button.classList.add('is-range-start');
            }
            if (this.isRangeEnd(day.date)) {
                button.classList.add('is-range-end');
            }
            if (this.isWithinActiveRange(day.date)) {
                button.classList.add('is-range-middle');
            }
            if (this.hoverDate && this.dateService.isSameDate(day.date, this.hoverDate)) {
                button.classList.add('is-hover-edge');
            }
        }
        if (this.dateService.isSameDate(day.date, this.focusedDate)) {
            button.classList.add('is-focused');
        }

        if (day.isSelectable) {
            button.addEventListener('click', () => this.selectDate(day.date));
            if (this.mode === 'range') {
                button.addEventListener('mouseenter', () => this.handleHover(day.date));
            }
        }

        return button;
    }

    focusGridButton() {
        const target = this.grid.querySelector('[data-focus-target="true"]');
        target?.focus();
    }

    handleHover(date) {
        if (this.mode !== 'range') return;
        if (!this.startDate || this.endDate) return;
        this.hoverDate = new Date(date);
        this.updateRangeVisualState();
    }

    clearHoverPreview() {
        if (this.mode !== 'range') return;
        if (!this.startDate || this.endDate) return;
        if (!this.hoverDate) return;
        this.hoverDate = null;
        this.updateRangeVisualState();
    }

    updateRangeVisualState() {
        if (this.mode !== 'range' || !this.grid) return;
        const buttons = this.grid.querySelectorAll('.datepicker-day');
        buttons.forEach(button => {
            button.classList.remove('is-range-start', 'is-range-end', 'is-range-middle', 'is-hover-edge');
            const dateString = button.dataset.date;
            const parsed = dateString ? this.safeParseDate(dateString) : null;
            if (!parsed) return;
            if (this.isRangeStart(parsed)) {
                button.classList.add('is-range-start');
            }
            if (this.isRangeEnd(parsed)) {
                button.classList.add('is-range-end');
            }
            if (this.isWithinActiveRange(parsed)) {
                button.classList.add('is-range-middle');
            }
            if (this.hoverDate && this.dateService.isSameDate(parsed, this.hoverDate)) {
                button.classList.add('is-hover-edge');
            }
        });
    }

    isWithinActiveRange(date) {
        if (this.mode !== 'range' || !this.startDate) return false;
        const rangeEnd = this.endDate || this.hoverDate;
        if (!rangeEnd) return false;
        const [min, max] = this.normalizeRange(this.startDate, rangeEnd);
        return date >= min && date <= max;
    }

    isRangeStart(date) {
        if (this.mode !== 'range' || !this.startDate) return false;
        if (this.endDate) {
            return date.getTime() === this.startDate.getTime();
        }
        if (this.hoverDate) {
            const [min] = this.normalizeRange(this.startDate, this.hoverDate);
            return date.getTime() === min.getTime();
        }
        return false;
    }

    isRangeEnd(date) {
        if (this.mode !== 'range' || !this.startDate) return false;
        if (this.endDate) {
            return date.getTime() === this.endDate.getTime();
        }
        if (this.hoverDate) {
            const [, max] = this.normalizeRange(this.startDate, this.hoverDate);
            return date.getTime() === max.getTime();
        }
        return false;
    }

    normalizeRange(a, b) {
        return a <= b ? [a, b] : [b, a];
    }

    updateFieldDisplay() {
        if (this.mode === 'single') {
            if (this.selectedDate) {
                this.field.value = this.formatDisplayDate(this.selectedDate);
                this.updateDisplayMessage(`Selected ${this.field.value}`);
            } else {
                this.field.value = '';
                this.updateDisplayMessage('Select a date');
            }
            return;
        }

        if (this.startDate && this.endDate) {
            const start = this.formatDisplayDate(this.startDate);
            const end = this.formatDisplayDate(this.endDate);
            this.field.value = `${start} – ${end}`;
            this.updateDisplayMessage(`${start} to ${end}`);
        } else if (this.startDate) {
            this.field.value = `${this.formatDisplayDate(this.startDate)} …`;
            this.updateDisplayMessage('Select an end date');
        } else {
            this.field.value = '';
            this.updateDisplayMessage('Select a date range');
        }
    }

    updateDisplayMessage(message) {
        if (!this.display) return;
        this.display.textContent = message;
    }

    getMinDate() {
        const raw = this.field.dataset.minDate || this.root.dataset.min;
        if (!raw) return null;
        if (raw === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return today;
        }
        if (raw.startsWith('today+')) {
            const offset = parseInt(raw.split('+')[1], 10);
            const future = new Date();
            future.setHours(0, 0, 0, 0);
            future.setDate(future.getDate() + offset);
            return future;
        }
        return this.safeParseDate(raw);
    }

    getMaxDate() {
        const raw = this.field.dataset.maxDate || this.root.dataset.max;
        if (!raw) return null;
        if (raw.startsWith('today+')) {
            const offset = parseInt(raw.split('+')[1], 10);
            const future = new Date();
            future.setHours(0, 0, 0, 0);
            future.setDate(future.getDate() + offset);
            return future;
        }
        return this.safeParseDate(raw);
    }

    safeParseDate(value) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    isSelectable(date) {
        const min = this.getMinDate();
        const max = this.getMaxDate();
        if (min && date < min) return false;
        if (max && date > max) return false;
        return true;
    }

    constrainToRange(date) {
        const min = this.getMinDate();
        const max = this.getMaxDate();
        if (min && date < min) return min;
        if (max && date > max) return max;
        return date;
    }

    formatDisplayDate(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }
}
