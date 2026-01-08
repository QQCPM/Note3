/**
 * Timezone Utilities - New York (America/New_York)
 * 
 * Centralized timezone handling for consistent date/time across the app.
 * All user-facing dates should use these utilities.
 */

const NY_TIMEZONE = 'America/New_York';

/**
 * Get current date/time in New York timezone
 */
export function getNYDate(): Date {
    const nyDateString = new Date().toLocaleString('en-US', { timeZone: NY_TIMEZONE });
    return new Date(nyDateString);
}

/**
 * Get today's date as YYYY-MM-DD in NY timezone
 */
export function getNYDateString(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: NY_TIMEZONE });
}

/**
 * Get tomorrow's date as YYYY-MM-DD in NY timezone
 */
export function getNYTomorrowString(): string {
    const today = getNYDate();
    today.setDate(today.getDate() + 1);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get current hour in NY (0-23) for greeting logic
 */
export function getNYHour(): number {
    return parseInt(
        new Date().toLocaleString('en-US', {
            timeZone: NY_TIMEZONE,
            hour: 'numeric',
            hour12: false,
        })
    );
}

/**
 * Get current day name in NY timezone (e.g., "Mon", "Tue")
 */
export function getNYDayName(): string {
    return new Date().toLocaleDateString('en-US', {
        timeZone: NY_TIMEZONE,
        weekday: 'short',
    });
}

/**
 * Get current day of week in NY (0 = Sunday, 6 = Saturday)
 */
export function getNYDayOfWeek(): number {
    return getNYDate().getDay();
}

/**
 * Format a date string (YYYY-MM-DD) for display, avoiding timezone shift
 * @param dateStr - Date string like "2026-01-06"
 * @param format - Display format options
 */
export function formatNYDate(
    dateStr: string,
    format: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string {
    // Append noon time to avoid UTC midnight timezone shift
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('en-US', format);
}

/**
 * Get formatted date range for display
 */
export function formatNYDateRange(startDate: string, endDate: string): string {
    return `${formatNYDate(startDate)} - ${formatNYDate(endDate)}`;
}

/**
 * Get formatted current date for display (e.g., "Tuesday, January 6, 2026")
 */
export function getNYFormattedDate(): string {
    return new Date().toLocaleDateString('en-US', {
        timeZone: NY_TIMEZONE,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

/**
 * Check if a date string (YYYY-MM-DD) is today in NY timezone
 */
export function isNYToday(dateStr: string): boolean {
    return dateStr === getNYDateString();
}

/**
 * Get the start of the current week (Monday) in NY timezone as YYYY-MM-DD
 */
export function getNYWeekStart(): string {
    const now = getNYDate();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so go back 6 days
    now.setDate(now.getDate() - daysToMonday);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
