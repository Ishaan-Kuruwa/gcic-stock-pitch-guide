import { describe, expect, it } from 'vitest';
import { milestones } from '../data/club';
import { daysBetween, milestoneStatus, parseShown, planMilestoneSave, todayIn, visibleMilestones } from './milestones';

const NY = 'America/New_York';
const keys = (list: { key: string }[]) => list.map((m) => m.key);

describe('todayIn', () => {
  it('uses the club day, not UTC', () => {
    // 11:30 PM in New York on Dec 12 is already Dec 13 in UTC.
    expect(todayIn(NY, new Date('2026-12-13T04:30:00Z'))).toBe('2026-12-12');
    expect(todayIn(NY, new Date('2026-12-13T05:30:00Z'))).toBe('2026-12-13');
  });
});

describe('daysBetween', () => {
  it('counts whole days across a month end', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(daysBetween('2027-01-02', '2026-12-30')).toBe(-3);
  });
});

describe('milestoneStatus (fixed today)', () => {
  it('says when it was done, in the club time zone', () => {
    // 10 PM Dec 10 in New York is Dec 11 in UTC.
    expect(milestoneStatus('2026-12-12', new Date('2026-12-11T03:00:00Z'), '2026-12-20', NY)).toEqual({
      text: 'Done Dec 10',
      state: 'done',
      date: '2026-12-10',
    });
  });

  it('says the due date before and on the day', () => {
    expect(milestoneStatus('2026-12-12', null, '2026-12-01', NY).text).toBe('Due Dec 12');
    expect(milestoneStatus('2026-12-12', null, '2026-12-12', NY)).toEqual({
      text: 'Due Dec 12',
      state: 'due',
      date: '2026-12-12',
    });
  });

  it('counts days late after the due date', () => {
    expect(milestoneStatus('2026-12-12', null, '2026-12-13', NY).text).toBe('Due Dec 12, 1 day late');
    expect(milestoneStatus('2026-12-12', null, '2026-12-15', NY)).toEqual({
      text: 'Due Dec 12, 3 days late',
      state: 'late',
      date: '2026-12-12',
    });
  });
});

describe('visibleMilestones', () => {
  it('hides the mentor review unless the team is mentored', () => {
    for (const status of ['self-guided', 'applied', 'declined'] as const) {
      expect(keys(visibleMilestones(status))).not.toContain('mentor-review');
    }
    expect(keys(visibleMilestones('mentored'))).toEqual(keys([...milestones]));
  });
});

describe('parseShown', () => {
  it('reads key:1 and key:0 and ignores anything else', () => {
    const shown = parseShown(['comps:1', 'slides:0', 'nope:1', 'video', 'video:2', 42, 'submitted:1:1']);
    expect([...shown]).toEqual([
      ['comps', true],
      ['slides', false],
    ]);
  });
});

describe('planMilestoneSave', () => {
  const allShown = (done: string[], status: 'self-guided' | 'mentored' = 'self-guided') =>
    new Map(visibleMilestones(status).map((m) => [m.key, done.includes(m.key)]));

  it('ticks and unticks what the member changed', () => {
    const current = new Set(['company-picked']);
    const plan = planMilestoneSave(current, allShown(['company-picked']), ['yis-registered'], 'self-guided');
    expect(plan).toEqual({ add: ['yis-registered'], remove: ['company-picked'] });
  });

  it('changes nothing when the form is saved as shown', () => {
    const current = new Set(['company-picked', 'comps']);
    const plan = planMilestoneSave(
      current,
      allShown(['company-picked', 'comps']),
      ['company-picked', 'comps'],
      'self-guided',
    );
    expect(plan).toEqual({ add: [], remove: [] });
  });

  it("keeps a teammate's tick made after my page loaded", () => {
    // My page showed "financials" not done; my teammate then ticked it.
    const current = new Set(['financials']);
    const plan = planMilestoneSave(current, allShown([]), ['company-picked'], 'self-guided');
    expect(plan).toEqual({ add: ['company-picked'], remove: [] });
  });

  it("keeps a teammate's untick made after my page loaded", () => {
    const current = new Set<string>();
    const plan = planMilestoneSave(current, allShown(['comps']), ['comps'], 'self-guided');
    expect(plan).toEqual({ add: [], remove: [] });
  });

  it('never lets a member tick or untick the mentor review', () => {
    const tick = planMilestoneSave(new Set(), allShown([], 'mentored'), ['mentor-review'], 'mentored');
    expect(tick).toEqual({ add: [], remove: [] });
    const untick = planMilestoneSave(
      new Set(['mentor-review']),
      allShown(['mentor-review'], 'mentored'),
      [],
      'mentored',
    );
    expect(untick).toEqual({ add: [], remove: [] });
  });

  it('ignores unknown keys and rows that were not shown', () => {
    const plan = planMilestoneSave(
      new Set(),
      new Map([['comps', false]]),
      ['made-up', 'slides', 'comps'],
      'self-guided',
    );
    expect(plan).toEqual({ add: ['comps'], remove: [] });
  });
});
