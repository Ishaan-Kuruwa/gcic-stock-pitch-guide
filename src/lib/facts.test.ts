import { describe, expect, it } from 'vitest';
import { deadline, limits, requiredItems, rubricTotalPoints } from '../data/competition';
import { categoryPoints, deadlineEastern, formatInstant, formatUsd } from './facts';

describe('formatUsd', () => {
  it('formats whole dollars', () => {
    expect(formatUsd(30)).toBe('$30');
  });
});

describe('formatInstant', () => {
  it('reproduces deadline.display in Pacific time', () => {
    expect(formatInstant(deadline.iso, deadline.timeZone, 'Pacific')).toBe(deadline.display);
  });

  it('shows the deadline in Eastern time as the next day', () => {
    expect(deadlineEastern).toBe('February 20, 2027, 2:59 AM Eastern');
  });
});

describe('categoryPoints', () => {
  it('reads category points from competition.ts', () => {
    expect(categoryPoints('investment-idea')).toBe(50);
    expect(categoryPoints('presentation')).toBe(25);
    expect(categoryPoints('video')).toBe(25);
  });

  it('module 0 says half the score is the written analysis; keep that true', () => {
    expect(categoryPoints('investment-idea') * 2).toBe(rubricTotalPoints);
  });
});

describe('limits', () => {
  it('match the requiredItems sentences', () => {
    const constraints = requiredItems.flatMap((item) => [...item.constraints]);
    expect(constraints).toContain(`Max ${limits.reportMaxPages} pages plus an appendix of any length.`);
    expect(constraints).toContain(`Under ${limits.videoMaxMinutes} minutes.`);
    expect(limits).toEqual({ reportMaxPages: 10, videoMaxMinutes: 10 });
  });
});
