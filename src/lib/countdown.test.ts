import { describe, expect, it } from 'vitest';
import { deadline } from '../data/competition';
import { formatDeadlineInZone, getCountdown } from './countdown';

const deadlineMs = Date.parse(deadline.iso);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('deadline instant', () => {
  it('is 11:59 PM PST (UTC-8) on Feb 19, 2027', () => {
    expect(new Date(deadlineMs).toISOString()).toBe('2027-02-20T07:59:00.000Z');
  });

  it('is 11:59 PM in the Pacific time zone', () => {
    expect(formatDeadlineInZone(deadline.iso, deadline.timeZone)).toBe(
      'Friday, February 19, 2027 at 11:59 PM PST',
    );
  });
});

describe('getCountdown', () => {
  it('breaks down 1 day, 1 hour, 1 minute, 1 second', () => {
    const now = deadlineMs - (DAY + HOUR + MINUTE + SECOND);
    expect(getCountdown(deadlineMs, now)).toEqual({
      days: 1,
      hours: 1,
      minutes: 1,
      seconds: 1,
      isPast: false,
    });
  });

  it('floors partial seconds', () => {
    expect(getCountdown(deadlineMs, deadlineMs - 1500).seconds).toBe(1);
  });

  it('is past and zeroed at and after the deadline', () => {
    const zero = { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
    expect(getCountdown(deadlineMs, deadlineMs)).toEqual(zero);
    expect(getCountdown(deadlineMs, deadlineMs + HOUR)).toEqual(zero);
  });

  it('gives the same result no matter which zone "now" was written in', () => {
    // The same instant written with different offsets.
    const instants = [
      '2027-02-19T20:59:00-08:00', // Los Angeles
      '2027-02-19T23:59:00-05:00', // New York
      '2027-02-20T10:29:00+05:30', // Kolkata
      '2027-02-20T04:59:00Z', // UTC
    ].map((s) => Date.parse(s));
    const results = instants.map((now) => getCountdown(deadlineMs, now));
    for (const r of results) {
      expect(r).toEqual({ days: 0, hours: 3, minutes: 0, seconds: 0, isPast: false });
    }
  });

  it('handles the PDT to PST switch between now and the deadline', () => {
    // "Now" is during daylight time (PDT, UTC-7); the deadline is in standard
    // time (PST, UTC-8). The one-hour shift must not change the result.
    const now = Date.parse('2026-10-31T12:00:00-07:00');
    // Oct 31 12:00 PDT = 19:00Z. Deadline = Feb 20 07:59Z.
    // Oct 31 19:00Z -> Feb 19 19:00Z is 111 days; + 12h59m.
    expect(getCountdown(deadlineMs, now)).toEqual({
      days: 111,
      hours: 12,
      minutes: 59,
      seconds: 0,
      isPast: false,
    });
  });
});

describe('formatDeadlineInZone', () => {
  const cases: [string, string][] = [
    ['America/Los_Angeles', 'Friday, February 19, 2027 at 11:59 PM PST'],
    ['America/New_York', 'Saturday, February 20, 2027 at 2:59 AM EST'],
    ['America/Chicago', 'Saturday, February 20, 2027 at 1:59 AM CST'],
    ['Pacific/Honolulu', 'Friday, February 19, 2027 at 9:59 PM HST'],
    ['Asia/Kolkata', 'Saturday, February 20, 2027 at 1:29 PM GMT+5:30'],
    ['UTC', 'Saturday, February 20, 2027 at 7:59 AM UTC'],
  ];

  it.each(cases)('shows the right local time in %s', (zone, expected) => {
    // Normalize narrow no-break spaces that some ICU versions use before AM/PM.
    const out = formatDeadlineInZone(deadline.iso, zone).replace(/ /g, ' ');
    expect(out).toBe(expected);
  });
});
