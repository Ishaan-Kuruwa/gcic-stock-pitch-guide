import { describe, expect, it } from 'vitest';
import { deadline } from '../data/competition';
import { targetSubmitDate } from '../data/club';
import {
  formatCurrency,
  formatDate,
  formatMonthDay,
  formatMultiple,
  formatPercent,
  formatShortDate,
  formatShortMonthDay,
} from './format';

// Tests run with TZ=America/Los_Angeles (vitest.config.ts), so these catch day shifts.
describe('formatDate', () => {
  it('formats a date-only string without shifting the day', () => {
    expect(formatDate('2026-12-18')).toBe('December 18, 2026');
  });
});

describe('formatMonthDay', () => {
  it('formats month and day without shifting the day', () => {
    expect(formatMonthDay('2027-02-17')).toBe('February 17');
    expect(formatMonthDay('2027-01-01')).toBe('January 1');
  });
});

describe('formatShortMonthDay', () => {
  it('formats a short month and day without shifting the day', () => {
    expect(formatShortMonthDay('2026-12-12')).toBe('Dec 12');
    expect(formatShortMonthDay('2027-01-02')).toBe('Jan 2');
  });
});

describe('formatShortDate', () => {
  it('formats with a short month without shifting the day', () => {
    expect(formatShortDate('2027-01-04')).toBe('Jan 4, 2027');
    expect(formatShortDate('2026-12-18')).toBe('Dec 18, 2026');
  });
});

describe('club targetSubmitDate', () => {
  it('is a valid date before the YIS deadline', () => {
    expect(targetSubmitDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${targetSubmitDate}T23:59:59-08:00`).getTime()).toBeLessThan(
      new Date(deadline.iso).getTime(),
    );
    expect(formatMonthDay(targetSubmitDate)).toBe('February 17');
  });
});

describe('formatCurrency', () => {
  it('shows dollars to the cent with separators', () => {
    expect(formatCurrency(93.6)).toBe('$93.60');
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(0.01)).toBe('$0.01');
  });
});

describe('formatPercent', () => {
  it('shows one decimal', () => {
    expect(formatPercent(0.17)).toBe('17.0%');
    expect(formatPercent(-0.031)).toBe('-3.1%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(1.234)).toBe('123.4%');
  });
});

describe('formatMultiple', () => {
  it('shows up to two decimals without padding', () => {
    expect(formatMultiple(18)).toBe('18');
    expect(formatMultiple(17.78)).toBe('17.78');
    expect(formatMultiple(17.5)).toBe('17.5');
    expect(formatMultiple(1250)).toBe('1,250');
  });
});
