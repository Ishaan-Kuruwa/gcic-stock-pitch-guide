import { describe, expect, it } from 'vitest';
import {
  clubCodeMatches,
  isLockedOut,
  MAX_TRIES,
  minutesUntilRetry,
  triesLeft,
  WINDOW_MS,
} from './clubCode';

describe('clubCodeMatches', () => {
  it('ignores case and surrounding spaces', () => {
    expect(clubCodeMatches('bulls2027', 'Bulls2027')).toBe(true);
    expect(clubCodeMatches('  BULLS2027 ', 'bulls2027')).toBe(true);
  });
  it('rejects a wrong code', () => {
    expect(clubCodeMatches('bears2027', 'bulls2027')).toBe(false);
    expect(clubCodeMatches('bulls 2027', 'bulls2027')).toBe(false);
  });
  it('never matches when the secret is missing or empty', () => {
    expect(clubCodeMatches('', '')).toBe(false);
    expect(clubCodeMatches('', undefined)).toBe(false);
    expect(clubCodeMatches('  ', '  ')).toBe(false);
  });
});

describe('rate limit', () => {
  const now = new Date('2026-12-01T12:00:00Z');
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  it('allows 5 wrong tries per hour', () => {
    expect(MAX_TRIES).toBe(5);
    expect(WINDOW_MS).toBe(60 * 60 * 1000);
  });

  it('is not locked with fewer than 5 tries in the hour', () => {
    const tries = [1, 2, 3, 4].map(minutesAgo);
    expect(isLockedOut(tries, now)).toBe(false);
    expect(triesLeft(tries, now)).toBe(1);
    expect(minutesUntilRetry(tries, now)).toBe(0);
  });

  it('locks after the 5th wrong try', () => {
    const tries = [1, 2, 3, 4, 5].map(minutesAgo);
    expect(isLockedOut(tries, now)).toBe(true);
    expect(triesLeft(tries, now)).toBe(0);
  });

  it('says when the oldest try leaves the hour', () => {
    const tries = [50, 40, 30, 20, 10].map(minutesAgo);
    expect(minutesUntilRetry(tries, now)).toBe(10);
  });

  it('never says 0 minutes while locked', () => {
    const tries = [59.99, 1, 1, 1, 1].map(minutesAgo);
    expect(minutesUntilRetry(tries, now)).toBe(1);
  });

  it('unlocks once tries are over an hour old', () => {
    const tries = [61, 70, 80, 90, 100].map(minutesAgo);
    expect(isLockedOut(tries, now)).toBe(false);
    expect(triesLeft(tries, now)).toBe(5);
  });

  it('counts only tries inside the window when old ones are mixed in', () => {
    const tries = [...[61, 62].map(minutesAgo), ...[1, 2, 3, 4].map(minutesAgo)];
    expect(isLockedOut(tries, now)).toBe(false);
    expect(triesLeft(tries, now)).toBe(1);
  });
});
