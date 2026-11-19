import { describe, expect, it } from 'vitest';
import { deadline } from '../data/competition';
import { targetSubmitDate } from '../data/club';
import { formatDate, formatMonthDay } from './format';

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

describe('club targetSubmitDate', () => {
  it('is a valid date before the YIS deadline', () => {
    expect(targetSubmitDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${targetSubmitDate}T23:59:59-08:00`).getTime()).toBeLessThan(
      new Date(deadline.iso).getTime(),
    );
    expect(formatMonthDay(targetSubmitDate)).toBe('February 17');
  });
});
