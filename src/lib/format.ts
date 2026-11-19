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

/** Format dollars to the cent, e.g. "$1,234.50". */
export function formatCurrency(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format a fraction as a percent with one decimal, e.g. 0.17 → "17.0%". */
export function formatPercent(fraction: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(fraction);
}

/** Format a ratio such as a P/E with up to two decimals, e.g. "18" or "17.78". */
export function formatMultiple(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}
