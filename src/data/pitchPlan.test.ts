import { describe, expect, it } from 'vitest';
import { limits } from './competition';
import { pitchPlan } from './pitchPlan';
import { DEFAULT_SECTIONS, LIMIT_MS, WARN_MS, formatClock, timeStatus, totalBudgetSec } from '../lib/pitchTimer';

describe('pitchPlan', () => {
  const totalSec = totalBudgetSec(pitchPlan);

  it('totals 8:00', () => {
    expect(totalSec).toBe(8 * 60);
    expect(formatClock(totalSec * 1000)).toBe('8:00');
  });

  it('stays under the video limit, before the 9:30 warning', () => {
    expect(totalSec * 1000).toBeLessThan(limits.videoMaxMinutes * 60_000);
    expect(totalSec * 1000).toBeLessThan(LIMIT_MS);
    expect(totalSec * 1000).toBeLessThan(WARN_MS);
    expect(timeStatus(totalSec * 1000)).toBe('ok');
  });

  it('has unique ids and positive whole-second budgets', () => {
    expect(new Set(pitchPlan.map((p) => p.id)).size).toBe(pitchPlan.length);
    for (const p of pitchPlan) {
      expect(Number.isInteger(p.budgetSec)).toBe(true);
      expect(p.budgetSec).toBeGreaterThan(0);
    }
  });

  it("is the timer's default plan", () => {
    expect(DEFAULT_SECTIONS).toEqual(pitchPlan.map(({ id, label, budgetSec }) => ({ id, label, budgetSec })));
  });
});
