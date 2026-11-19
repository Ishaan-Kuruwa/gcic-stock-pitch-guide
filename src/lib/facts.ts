import { deadline, rubricCategories, type RubricCategoryId } from '../data/competition';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** Whole-dollar amount, e.g. 30 -> "$30". */
export function formatUsd(amount: number): string {
  return usd.format(amount);
}

/**
 * An exact instant shown in a given time zone, in the same style as
 * deadline.display: "February 19, 2027, 11:59 PM Pacific".
 */
export function formatInstant(iso: string, timeZone: string, zoneLabel: string): string {
  const instant = new Date(iso);
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(instant);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
  return `${date}, ${time} ${zoneLabel}`;
}

/** The submission deadline in Eastern time (North Carolina). */
export const deadlineEastern = formatInstant(deadline.iso, 'America/New_York', 'Eastern');

/** Points for one rubric category. */
export function categoryPoints(id: RubricCategoryId): number {
  const category = rubricCategories.find((c) => c.id === id);
  if (!category) throw new Error(`Unknown rubric category "${id}".`);
  return category.points;
}
