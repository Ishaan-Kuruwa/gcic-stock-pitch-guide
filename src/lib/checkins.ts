/**
 * Check-in rules: the mentor's "Log a check-in" form and how a check-in reads.
 * Pure functions; the queries live in src/db/checkins.ts.
 *
 * A check-in is the mentor's own notes about a meeting with the team. The
 * site never writes them and never writes report, slide or pitch text.
 */
import { CHECKIN_STATUSES, type CheckinStatus } from '../db/schema';
import { daysBetween } from './milestones';

export { CHECKIN_STATUSES, type CheckinStatus };

export const MAX_COVERED = 1000;
export const MAX_NEXT_STEP = 500;

export const checkinStatusLabels: Record<CheckinStatus, string> = {
  'on-track': 'On track',
  behind: 'Behind',
  stuck: 'Stuck',
};

export interface CheckinValues {
  metOn: string;
  covered: string;
  nextStep: string;
  status: CheckinStatus;
}

/** What was typed, to put back in the form after an error. */
export interface CheckinRaw {
  metOn: string;
  covered: string;
  nextStep: string;
  status: string;
}

export type CheckinErrors = Partial<Record<keyof CheckinValues, string>>;
export type CheckinParse = { ok: true; value: CheckinValues } | { ok: false; errors: CheckinErrors; raw: CheckinRaw };

function field(form: FormData, name: string): string {
  const raw = form.get(name);
  return typeof raw === 'string' ? raw : '';
}

/** Trim the ends and turn Windows line breaks into plain ones (a browser sends \r\n). */
function cleanText(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim();
}

/** A real calendar date written YYYY-MM-DD (not 2026-02-30). */
export function isIsoDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

/**
 * The check-in form (add or edit). `today` is YYYY-MM-DD in the club's time
 * zone: the meeting can't be later than today. An empty date means today.
 */
export function parseCheckinForm(form: FormData, today: string): CheckinParse {
  const raw: CheckinRaw = {
    metOn: field(form, 'met_on').trim(),
    covered: field(form, 'covered'),
    nextStep: field(form, 'next_step'),
    status: field(form, 'status'),
  };
  const errors: CheckinErrors = {};

  const metOn = raw.metOn === '' ? today : raw.metOn;
  if (!isIsoDate(metOn)) errors.metOn = 'Enter the meeting date, like 2026-12-03.';
  else if (daysBetween(today, metOn) > 0) errors.metOn = "The meeting date can't be in the future.";

  const covered = cleanText(raw.covered);
  if (covered === '') errors.covered = 'Write what you covered.';
  else if (covered.length > MAX_COVERED) {
    errors.covered = `Keep "What you covered" to ${MAX_COVERED} characters or fewer (now ${covered.length}).`;
  }

  const nextStep = cleanText(raw.nextStep);
  if (nextStep.length > MAX_NEXT_STEP) {
    errors.nextStep = `Keep "Next step" to ${MAX_NEXT_STEP} characters or fewer (now ${nextStep.length}).`;
  }

  const status = (CHECKIN_STATUSES as readonly string[]).includes(raw.status) ? (raw.status as CheckinStatus) : null;
  if (!status) errors.status = 'Choose how the team is doing: on track, behind or stuck.';

  if (Object.keys(errors).length > 0 || !status) return { ok: false, errors, raw };
  return { ok: true, value: { metOn, covered, nextStep, status } };
}
