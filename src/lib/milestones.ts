/**
 * Team milestones: which ones a team sees, how each one's status reads, and
 * what a Save on the team page changes. Pure functions; the queries live in
 * src/db/milestones.ts and the team page only renders.
 */
import { clubTimeZone, milestones, type Milestone } from '../data/club';
import type { MentorshipStatus } from '../db/schema';
import { formatShortMonthDay } from './format';

export type { Milestone };

/** YYYY-MM-DD for the instant `now` as a calendar day in `timeZone`. */
export function todayIn(timeZone: string = clubTimeZone, now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** The milestones a team sees: the mentor review only for mentored teams. */
export function visibleMilestones(status: MentorshipStatus, list: readonly Milestone[] = milestones): Milestone[] {
  return list.filter((m) => !m.mentoredOnly || status === 'mentored');
}

/** Can a team member tick or untick this milestone? (Mentors come in Phase E.) */
export function memberCanTick(m: Milestone): boolean {
  return !m.mentoredOnly;
}

/** Whole days from one YYYY-MM-DD to another (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export interface MilestoneStatus {
  text: string;
  state: 'done' | 'due' | 'late';
  /** YYYY-MM-DD the text refers to (done date or due date), for <time datetime>. */
  date: string;
}

/**
 * A milestone's status in words, never colour alone:
 * "Done Dec 10", "Due Dec 12", or "Due Dec 12, 3 days late".
 * `today` is YYYY-MM-DD in the club's time zone; the done date is read there too.
 */
export function milestoneStatus(
  due: string,
  doneAt: Date | null,
  today: string,
  timeZone: string = clubTimeZone,
): MilestoneStatus {
  if (doneAt) {
    const day = todayIn(timeZone, doneAt);
    return { text: `Done ${formatShortMonthDay(day)}`, state: 'done', date: day };
  }
  const late = daysBetween(due, today);
  const dueText = `Due ${formatShortMonthDay(due)}`;
  if (late <= 0) return { text: dueText, state: 'due', date: due };
  return { text: `${dueText}, ${late} ${late === 1 ? 'day' : 'days'} late`, state: 'late', date: due };
}

/**
 * The hidden "shown" fields on the milestones form: each visible milestone's
 * state when the page was drawn, as "key:1" (done) or "key:0" (not done).
 * Malformed values and unknown keys are ignored.
 */
export function parseShown(values: readonly unknown[], list: readonly Milestone[] = milestones): Map<string, boolean> {
  const known = new Set(list.map((m) => m.key));
  const shown = new Map<string, boolean>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const match = /^([a-z0-9-]+):([01])$/.exec(value);
    if (!match || !known.has(match[1])) continue;
    shown.set(match[1], match[2] === '1');
  }
  return shown;
}

export interface MilestonePlan {
  add: string[];
  remove: string[];
}

/**
 * What a Save changes. Only rows the member actually changed count: a key
 * whose box differs from how it was shown. So a stale page can't undo a
 * teammate's tick made after it loaded, and saving twice changes nothing.
 * Mentor-only milestones, hidden milestones and unknown keys are never touched.
 *
 * @param current keys done in the database right now
 * @param shown   each row's state when the page was drawn (parseShown)
 * @param checked the `milestone` checkbox values that were sent
 */
export function planMilestoneSave(
  current: ReadonlySet<string>,
  shown: ReadonlyMap<string, boolean>,
  checked: readonly unknown[],
  status: MentorshipStatus,
  list: readonly Milestone[] = milestones,
): MilestonePlan {
  const ticked = new Set(checked.filter((v): v is string => typeof v === 'string'));
  const plan: MilestonePlan = { add: [], remove: [] };
  for (const m of visibleMilestones(status, list)) {
    if (!memberCanTick(m) || !shown.has(m.key)) continue;
    const was = shown.get(m.key);
    const now = ticked.has(m.key);
    if (now === was) continue;
    if (now && !current.has(m.key)) plan.add.push(m.key);
    if (!now && current.has(m.key)) plan.remove.push(m.key);
  }
  return plan;
}
