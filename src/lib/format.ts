/** Format a date-only ISO string (YYYY-MM-DD) without shifting the day. */
export function formatDate(isoDate: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** Format a date-only ISO string (YYYY-MM-DD) as month and day, e.g. "February 17". */
export function formatMonthDay(isoDate: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** Format a date-only ISO string (YYYY-MM-DD) with a short month, e.g. "Jan 4, 2027". */
export function formatShortDate(isoDate: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
