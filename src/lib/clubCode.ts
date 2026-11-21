/**
 * The club code keeps non-members out of the sign-up step at /join. It is a
 * Wrangler secret (CLUB_CODE). Wrong tries are limited per account. The
 * window helpers are shared with team join codes (src/lib/teams.ts).
 */

/** Wrong tries allowed per account inside one window. */
export const MAX_TRIES = 5;
/** The window: one hour. */
export const WINDOW_MS = 60 * 60 * 1000;

/** Trimmed and case-insensitive. An empty or missing secret never matches. */
export function clubCodeMatches(input: string, secret: string | undefined | null): boolean {
  const expected = (secret ?? '').trim().toLowerCase();
  if (expected === '') return false;
  return input.trim().toLowerCase() === expected;
}

/** Wrong tries that still count at `now` (inside the last hour). */
export function triesInWindow(attempts: Date[], now: Date): Date[] {
  const since = now.getTime() - WINDOW_MS;
  return attempts.filter((t) => t.getTime() > since && t.getTime() <= now.getTime());
}

/**
 * True once there are `max` wrong tries inside the last hour. `max` defaults
 * to the club-code limit; team join codes pass their own.
 */
export function isLockedOut(attempts: Date[], now: Date, max = MAX_TRIES): boolean {
  return triesInWindow(attempts, now).length >= max;
}

/** Wrong tries left before the lockout. Never below 0. */
export function triesLeft(attempts: Date[], now: Date, max = MAX_TRIES): number {
  return Math.max(0, max - triesInWindow(attempts, now).length);
}

/**
 * Whole minutes (at least 1) until one more try is allowed, or 0 if one is
 * allowed now. The oldest counted try has to slide out of the hour first.
 */
export function minutesUntilRetry(attempts: Date[], now: Date, max = MAX_TRIES): number {
  const counted = triesInWindow(attempts, now)
    .map((t) => t.getTime())
    .sort((a, b) => a - b);
  if (counted.length < max) return 0;
  const freesAt = counted[counted.length - max]! + WINDOW_MS;
  return Math.max(1, Math.ceil((freesAt - now.getTime()) / 60_000));
}
