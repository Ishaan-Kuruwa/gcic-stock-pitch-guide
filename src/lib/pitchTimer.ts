/**
 * Pitch timer logic: section budgets and a rehearsal clock.
 *
 * Pure functions only. The clock takes `now` (milliseconds, e.g. from
 * performance.now()) as an argument so it can be tested without real time.
 */
import { limits } from '../data/competition';
import { pitchPlan } from '../data/pitchPlan';

/** Saved through storage.ts, so the real key is "ghic-pitch-timer". */
export const PITCH_TIMER_KEY = 'pitch-timer';

export interface PitchSection {
  id: string;
  label: string;
  /** Planned time for this section, in whole seconds. */
  budgetSec: number;
}

/** Default budget: GHIC's eight-minute plan (src/data/pitchPlan.ts), also shown in module 9. */
export const DEFAULT_SECTIONS: readonly PitchSection[] = pitchPlan.map(({ id, label, budgetSec }) => ({
  id,
  label,
  budgetSec,
}));

/** The video must be under this: 10:00 itself is over the limit. */
export const LIMIT_MS = limits.videoMaxMinutes * 60_000;
/** Warn from here (9:30), 30 seconds before the limit. */
export const WARN_MS = LIMIT_MS - 30_000;

/** Longest budget one section can have, so typos can't make huge numbers. */
export const MAX_SECTION_SEC = 59 * 60 + 59;

export type TimeStatus = 'ok' | 'warn' | 'over';

/** ok below 9:30, warn from 9:30 up to (not including) 10:00, over at 10:00 or more. */
export function timeStatus(ms: number): TimeStatus {
  if (ms >= LIMIT_MS) return 'over';
  if (ms >= WARN_MS) return 'warn';
  return 'ok';
}

/**
 * "m:ss", rounding down to the whole second, so the display never reads 10:00
 * before the limit is actually reached. Negative values show as 0:00.
 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Spoken form for screen readers: "1 minute 5 seconds". */
export function formatSpoken(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (m > 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  if (s > 0 || m === 0) parts.push(`${s} ${s === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ');
}

/** Clamp minutes and seconds typed by a student into a whole-second budget. */
export function budgetFromParts(minutes: number, seconds: number): number {
  const m = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return Math.min(m * 60 + s, MAX_SECTION_SEC);
}

export function budgetParts(budgetSec: number): { minutes: number; seconds: number } {
  return { minutes: Math.floor(budgetSec / 60), seconds: budgetSec % 60 };
}

export function totalBudgetSec(sections: readonly PitchSection[]): number {
  return sections.reduce((sum, s) => sum + s.budgetSec, 0);
}

/** Running total of budgets: when each section should end. */
export function budgetEndsAt(sections: readonly PitchSection[]): number[] {
  let sum = 0;
  return sections.map((s) => (sum += s.budgetSec));
}

// ---------------------------------------------------------------------------
// Editing sections

export function updateSection(
  sections: readonly PitchSection[],
  id: string,
  patch: Partial<Pick<PitchSection, 'label' | 'budgetSec'>>,
): PitchSection[] {
  return sections.map((s) =>
    s.id === id
      ? {
          ...s,
          ...(patch.label !== undefined ? { label: patch.label } : {}),
          ...(patch.budgetSec !== undefined
            ? { budgetSec: budgetFromParts(0, patch.budgetSec) }
            : {}),
        }
      : s,
  );
}

/** Add a section with a fresh id. `makeId` is injectable for tests. */
export function addSection(
  sections: readonly PitchSection[],
  makeId: () => string = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
): PitchSection[] {
  let id = makeId();
  while (sections.some((s) => s.id === id)) id = makeId();
  return [...sections, { id, label: '', budgetSec: 60 }];
}

export function removeSection(sections: readonly PitchSection[], id: string): PitchSection[] {
  return sections.filter((s) => s.id !== id);
}

/** Saved budgets back into sections. Anything malformed falls back to the defaults. */
export function parseSections(raw: unknown): PitchSection[] {
  if (!Array.isArray(raw)) return DEFAULT_SECTIONS.map((s) => ({ ...s }));
  const seen = new Set<string>();
  const out: PitchSection[] = [];
  for (const v of raw) {
    if (typeof v !== 'object' || v === null) continue;
    const { id, label, budgetSec } = v as Record<string, unknown>;
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue;
    if (typeof label !== 'string') continue;
    if (typeof budgetSec !== 'number' || !Number.isFinite(budgetSec)) continue;
    seen.add(id);
    out.push({ id, label: label.slice(0, 200), budgetSec: budgetFromParts(0, budgetSec) });
  }
  return out.length > 0 ? out : DEFAULT_SECTIONS.map((s) => ({ ...s }));
}

// ---------------------------------------------------------------------------
// Rehearsal clock

export interface ClockState {
  /** Index of the section being timed. May equal laps.length once finished. */
  current: number;
  /** Time banked for each section so far, in ms (excludes the running stretch). */
  laps: number[];
  /** `now` when the clock last started, or null when paused. */
  runningSince: number | null;
}

export function newClock(sectionCount: number): ClockState {
  return { current: 0, laps: Array.from({ length: sectionCount }, () => 0), runningSince: null };
}

export function isRunning(state: ClockState): boolean {
  return state.runningSince !== null;
}

export function isFinished(state: ClockState): boolean {
  return state.current >= state.laps.length;
}

/** Bank the running stretch into the current section. */
function bank(state: ClockState, now: number): number[] {
  const laps = [...state.laps];
  if (state.runningSince !== null && state.current < laps.length) {
    laps[state.current] = (laps[state.current] ?? 0) + Math.max(0, now - state.runningSince);
  }
  return laps;
}

export function start(state: ClockState, now: number): ClockState {
  if (isRunning(state) || isFinished(state)) return state;
  return { ...state, runningSince: now };
}

export function pause(state: ClockState, now: number): ClockState {
  if (!isRunning(state)) return state;
  return { ...state, laps: bank(state, now), runningSince: null };
}

/**
 * Move on to the next section. If the clock was running it keeps running,
 * so going to the next slide is one tap. After the last section it stops.
 */
export function next(state: ClockState, now: number): ClockState {
  if (isFinished(state)) return state;
  const laps = bank(state, now);
  const current = state.current + 1;
  const keepRunning = state.runningSince !== null && current < laps.length;
  return { current, laps, runningSince: keepRunning ? now : null };
}

/** Time spent in one section, including the running stretch. */
export function sectionElapsed(state: ClockState, index: number, now: number): number {
  const banked = state.laps[index] ?? 0;
  if (index === state.current && state.runningSince !== null) {
    return banked + Math.max(0, now - state.runningSince);
  }
  return banked;
}

export function totalElapsed(state: ClockState, now: number): number {
  return state.laps.reduce((sum, _, i) => sum + sectionElapsed(state, i, now), 0);
}

/**
 * Compare a section's time with its budget. A section is over once it has run
 * past its budget by a whole second, matching what the m:ss display shows.
 */
export function sectionOverBy(elapsedMs: number, budgetSec: number): number {
  return Math.max(0, Math.floor(elapsedMs / 1000) - budgetSec);
}

/** The message shown next to the total. Plain text so screen readers announce it. */
export function statusMessage(status: TimeStatus): string {
  const limit = formatClock(LIMIT_MS);
  switch (status) {
    case 'over':
      return `Over the limit. The video must be under ${limit}. Cut something and try again.`;
    case 'warn':
      return `Past ${formatClock(WARN_MS)}. Wrap up now: the video must be under ${limit}.`;
    default:
      return '';
  }
}
