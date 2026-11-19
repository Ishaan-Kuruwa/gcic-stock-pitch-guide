import { describe, expect, it } from 'vitest';
import { limits } from '../data/competition';
import {
  DEFAULT_SECTIONS,
  LIMIT_MS,
  MAX_SECTION_SEC,
  WARN_MS,
  addSection,
  budgetEndsAt,
  budgetFromParts,
  budgetParts,
  formatClock,
  formatSpoken,
  isFinished,
  isRunning,
  newClock,
  next,
  parseSections,
  pause,
  removeSection,
  sectionElapsed,
  sectionOverBy,
  start,
  statusMessage,
  timeStatus,
  totalBudgetSec,
  totalElapsed,
  updateSection,
} from './pitchTimer';

describe('limits', () => {
  it('come from competition.ts', () => {
    expect(LIMIT_MS).toBe(limits.videoMaxMinutes * 60_000);
    expect(WARN_MS).toBe(9 * 60_000 + 30_000);
  });
});

describe('timeStatus', () => {
  it('is ok below 9:30', () => {
    expect(timeStatus(0)).toBe('ok');
    expect(timeStatus(WARN_MS - 1)).toBe('ok');
  });
  it('warns from 9:30', () => {
    expect(timeStatus(WARN_MS)).toBe('warn');
    expect(timeStatus(LIMIT_MS - 1)).toBe('warn');
  });
  it('treats exactly 10:00 as over', () => {
    expect(timeStatus(LIMIT_MS)).toBe('over');
    expect(timeStatus(LIMIT_MS + 5000)).toBe('over');
  });
});

describe('formatClock', () => {
  it('rounds down to whole seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(999)).toBe('0:00');
    expect(formatClock(65_400)).toBe('1:05');
    expect(formatClock(LIMIT_MS - 1)).toBe('9:59');
    expect(formatClock(LIMIT_MS)).toBe('10:00');
  });
  it('shows negatives as 0:00', () => {
    expect(formatClock(-5000)).toBe('0:00');
  });
});

describe('formatSpoken', () => {
  it('reads naturally', () => {
    expect(formatSpoken(0)).toBe('0 seconds');
    expect(formatSpoken(1000)).toBe('1 second');
    expect(formatSpoken(60_000)).toBe('1 minute');
    expect(formatSpoken(125_000)).toBe('2 minutes 5 seconds');
  });
});

describe('budgets', () => {
  it('defaults match module 9: eight minutes over eight parts', () => {
    expect(DEFAULT_SECTIONS).toHaveLength(8);
    expect(totalBudgetSec(DEFAULT_SECTIONS)).toBe(8 * 60);
    expect(budgetEndsAt(DEFAULT_SECTIONS)).toEqual([45, 105, 165, 255, 345, 405, 450, 480]);
  });
  it('builds and splits minutes and seconds', () => {
    expect(budgetFromParts(1, 30)).toBe(90);
    expect(budgetFromParts(0, 90)).toBe(90);
    expect(budgetFromParts(-2, 5.7)).toBe(5);
    expect(budgetFromParts(Number.NaN, 10)).toBe(10);
    expect(budgetFromParts(999, 0)).toBe(MAX_SECTION_SEC);
    expect(budgetParts(95)).toEqual({ minutes: 1, seconds: 35 });
  });
});

describe('editing sections', () => {
  it('updates label and budget', () => {
    const s = updateSection(DEFAULT_SECTIONS, 'risks', { label: 'Risks!', budgetSec: 75 });
    expect(s.find((x) => x.id === 'risks')).toEqual({ id: 'risks', label: 'Risks!', budgetSec: 75 });
    expect(DEFAULT_SECTIONS.find((x) => x.id === 'risks')?.budgetSec).toBe(60);
  });
  it('adds with a unique id and removes', () => {
    const ids = ['title', 'new'];
    const added = addSection(DEFAULT_SECTIONS, () => ids.shift()!);
    expect(added.at(-1)).toEqual({ id: 'new', label: '', budgetSec: 60 });
    expect(removeSection(added, 'new')).toEqual(DEFAULT_SECTIONS);
  });
});

describe('parseSections', () => {
  it('falls back to defaults for junk', () => {
    expect(parseSections(undefined)).toEqual(DEFAULT_SECTIONS);
    expect(parseSections('x')).toEqual(DEFAULT_SECTIONS);
    expect(parseSections([])).toEqual(DEFAULT_SECTIONS);
    expect(parseSections([{ id: 1 }])).toEqual(DEFAULT_SECTIONS);
  });
  it('keeps valid entries, drops duplicates, clamps budgets', () => {
    expect(
      parseSections([
        { id: 'a', label: 'A', budgetSec: 30 },
        { id: 'a', label: 'dupe', budgetSec: 30 },
        { id: 'b', label: 'B', budgetSec: -4 },
        { id: 'c', label: 'C', budgetSec: Number.POSITIVE_INFINITY },
        null,
      ]),
    ).toEqual([
      { id: 'a', label: 'A', budgetSec: 30 },
      { id: 'b', label: 'B', budgetSec: 0 },
    ]);
  });
});

describe('rehearsal clock', () => {
  it('starts paused at the first section', () => {
    const c = newClock(3);
    expect(isRunning(c)).toBe(false);
    expect(isFinished(c)).toBe(false);
    expect(totalElapsed(c, 1000)).toBe(0);
  });

  it('times sections, keeps running across next, and pauses', () => {
    let c = start(newClock(3), 0);
    expect(sectionElapsed(c, 0, 5000)).toBe(5000);
    c = next(c, 5000);
    expect(isRunning(c)).toBe(true);
    expect(c.current).toBe(1);
    c = pause(c, 8000);
    expect(sectionElapsed(c, 1, 99_999)).toBe(3000);
    expect(totalElapsed(c, 99_999)).toBe(8000);
    c = start(c, 10_000);
    expect(totalElapsed(c, 11_000)).toBe(9000);
  });

  it('next while paused moves on without adding time', () => {
    let c = next(newClock(2), 4000);
    expect(c.current).toBe(1);
    expect(isRunning(c)).toBe(false);
    expect(totalElapsed(c, 9000)).toBe(0);
  });

  it('stops after the last section and ignores further input', () => {
    let c = start(newClock(1), 0);
    c = next(c, 2000);
    expect(isFinished(c)).toBe(true);
    expect(isRunning(c)).toBe(false);
    expect(start(c, 3000)).toBe(c);
    expect(next(c, 3000)).toBe(c);
    expect(totalElapsed(c, 50_000)).toBe(2000);
  });

  it('start and pause are no-ops when already in that state', () => {
    const running = start(newClock(1), 0);
    expect(start(running, 10)).toBe(running);
    const paused = newClock(1);
    expect(pause(paused, 10)).toBe(paused);
  });

  it('crosses into warn and over at 9:30 and 10:00', () => {
    const c = start(newClock(1), 0);
    expect(timeStatus(totalElapsed(c, WARN_MS - 1))).toBe('ok');
    expect(timeStatus(totalElapsed(c, WARN_MS))).toBe('warn');
    expect(timeStatus(totalElapsed(c, LIMIT_MS))).toBe('over');
  });
});

describe('sectionOverBy', () => {
  it('counts whole seconds past the budget', () => {
    expect(sectionOverBy(45_999, 45)).toBe(0);
    expect(sectionOverBy(46_000, 45)).toBe(1);
    expect(sectionOverBy(10_000, 45)).toBe(0);
  });
});

describe('statusMessage', () => {
  it('says nothing when ok and names the limit otherwise', () => {
    expect(statusMessage('ok')).toBe('');
    expect(statusMessage('warn')).toContain('9:30');
    expect(statusMessage('over')).toContain('under 10:00');
  });
});
