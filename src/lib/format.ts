/** Format a date-only ISO string (YYYY-MM-DD) without shifting the day. */
export function formatDate(isoDate: string, locale = 'en-US'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
