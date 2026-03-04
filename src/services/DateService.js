/**
 * Date Service for Datepicker Component
 * ECCA Metadata:
 * - Version: 1.0.0
 * - Type: service
 * - Owner: ui-service
 * - Lifecycle: active
 * - Stability: stable
 * 
 * Features:
 * - Calendar calculation and navigation
 * - Date validation and formatting
 * - Localization support
 * - Date range selection
 * - Keyboard navigation helpers
 */

export function createDateService(eventBus) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return {
        /**
         * Get days in month
         */
        getDaysInMonth(year, month) {
            return new Date(year, month + 1, 0).getDate();
        },

        /**
         * Get first day of month (0-6, where 0 is Sunday)
         */
        getFirstDayOfMonth(year, month) {
            return new Date(year, month, 1).getDay();
        },

        /**
         * Check if date is valid
         */
        isValidDate(year, month, day) {
            const date = new Date(year, month, day);
            return (
                date.getFullYear() === year &&
                date.getMonth() === month &&
                date.getDate() === day
            );
        },

        /**
         * Check if date is in range
         */
        isDateInRange(date, minDate, maxDate) {
            const time = date.getTime();
            const minTime = minDate ? minDate.getTime() : -Infinity;
            const maxTime = maxDate ? maxDate.getTime() : Infinity;
            return time >= minTime && time <= maxTime;
        },

        /**
         * Format date for display
         */
        formatDate(date, format = 'YYYY-MM-DD') {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');

            return format
                .replace('YYYY', year)
                .replace('MM', month)
                .replace('DD', day);
        },

        /**
         * Parse date string to Date object
         */
        parseDate(dateString) {
            const date = new Date(dateString);
            return isNaN(date.getTime()) ? null : date;
        },

        /**
         * Navigate to previous month
         */
        previousMonth(year, month) {
            if (month === 0) {
                return { year: year - 1, month: 11 };
            }
            return { year, month: month - 1 };
        },

        /**
         * Navigate to next month
         */
        nextMonth(year, month) {
            if (month === 11) {
                return { year: year + 1, month: 0 };
            }
            return { year, month: month + 1 };
        },

        /**
         * Build calendar grid for month
         */
        buildCalendar(year, month, options = {}) {
            const { minDate, maxDate, selectedDate } = options;
            const daysInMonth = this.getDaysInMonth(year, month);
            const firstDay = this.getFirstDayOfMonth(year, month);
            const days = [];

            // Add days from previous month to fill grid
            const prevMonth = this.previousMonth(year, month);
            const daysInPrevMonth = this.getDaysInMonth(prevMonth.year, prevMonth.month);
            
            for (let i = firstDay - 1; i >= 0; i--) {
                const day = daysInPrevMonth - i;
                const date = new Date(prevMonth.year, prevMonth.month, day);
                days.push({
                    day,
                    month: prevMonth.month,
                    year: prevMonth.year,
                    date,
                    inCurrentMonth: false,
                    isSelectable: this.isDateInRange(date, minDate, maxDate),
                    isSelected: this.isSameDate(date, selectedDate),
                    isToday: this.isSameDate(date, new Date())
                });
            }

            // Add days in current month
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                days.push({
                    day,
                    month,
                    year,
                    date,
                    inCurrentMonth: true,
                    isSelectable: this.isDateInRange(date, minDate, maxDate),
                    isSelected: this.isSameDate(date, selectedDate),
                    isToday: this.isSameDate(date, new Date())
                });
            }

            // Add days from next month to complete grid (42 cells = 6 weeks)
            const remaining = 42 - days.length;
            const nextMonth = this.nextMonth(year, month);
            
            for (let day = 1; day <= remaining; day++) {
                const date = new Date(nextMonth.year, nextMonth.month, day);
                days.push({
                    day,
                    month: nextMonth.month,
                    year: nextMonth.year,
                    date,
                    inCurrentMonth: false,
                    isSelectable: this.isDateInRange(date, minDate, maxDate),
                    isSelected: this.isSameDate(date, selectedDate),
                    isToday: this.isSameDate(date, new Date())
                });
            }

            return days;
        },

        /**
         * Check if two dates are the same
         */
        isSameDate(date1, date2) {
            if (!date1 || !date2) return false;
            return (
                date1.getFullYear() === date2.getFullYear() &&
                date1.getMonth() === date2.getMonth() &&
                date1.getDate() === date2.getDate()
            );
        },

        /**
         * Get date relative to today
         */
        getRelativeDate(daysFromToday) {
            const today = new Date();
            today.setDate(today.getDate() + daysFromToday);
            return today;
        },

        /**
         * Get month name
         */
        getMonthName(month, locale = 'en') {
            if (locale === 'en') {
                return months[month];
            }
            // In production, use Intl.DateTimeFormat for localization
            return new Date(2000, month).toLocaleDateString(locale, { month: 'long' });
        },

        /**
         * Get day names
         */
        getDayNames(locale = 'en') {
            if (locale === 'en') {
                return dayNames;
            }
            // In production, use Intl.DateTimeFormat for localization
            return Array.from({ length: 7 }, (_, i) => 
                new Date(2000, 0, i + 2).toLocaleDateString(locale, { weekday: 'short' })
            );
        },

        /**
         * Navigate to specific month
         */
        navigateMonth(currentYear, currentMonth, direction) {
            const navigation = direction === 'prev' 
                ? this.previousMonth(currentYear, currentMonth)
                : this.nextMonth(currentYear, currentMonth);

            // Publish navigation event
            if (eventBus) {
                eventBus.publishSync('CALENDAR_RENDERED', {
                    year: navigation.year,
                    month: navigation.month,
                    direction,
                    timestamp: Date.now()
                });
            }

            return navigation;
        },

        /**
         * Select a date
         */
        selectDate(year, month, day) {
            if (!this.isValidDate(year, month, day)) {
                throw new Error('Invalid date');
            }

            const date = new Date(year, month, day);
            
            if (eventBus) {
                eventBus.publishSync('DATE_SELECTED', {
                    date: this.formatDate(date),
                    timestamp: Date.now(),
                    year,
                    month,
                    day
                });
            }

            return date;
        },

        /**
         * Get keyboard navigation info
         */
        getKeyboardNavigation(currentDate, key) {
            const date = new Date(currentDate);
            
            switch (key) {
                case 'ArrowUp':
                    date.setDate(date.getDate() - 7);
                    break;
                case 'ArrowDown':
                    date.setDate(date.getDate() + 7);
                    break;
                case 'ArrowLeft':
                    date.setDate(date.getDate() - 1);
                    break;
                case 'ArrowRight':
                    date.setDate(date.getDate() + 1);
                    break;
                case 'Home':
                    date.setDate(1);
                    break;
                case 'End':
                    date.setDate(this.getDaysInMonth(date.getFullYear(), date.getMonth()));
                    break;
                case 'PageUp':
                    const prev = this.previousMonth(date.getFullYear(), date.getMonth());
                    date.setFullYear(prev.year, prev.month, Math.min(date.getDate(), this.getDaysInMonth(prev.year, prev.month)));
                    break;
                case 'PageDown':
                    const next = this.nextMonth(date.getFullYear(), date.getMonth());
                    date.setFullYear(next.year, next.month, Math.min(date.getDate(), this.getDaysInMonth(next.year, next.month)));
                    break;
                default:
                    return currentDate;
            }
            
            return date;
        }
    };
}
