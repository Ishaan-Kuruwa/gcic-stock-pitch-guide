/** The end-of-season delete's confirmation (see src/pages/admin/season.astro). */

/** What an admin types to confirm. */
export const SEASON_CONFIRM = 'DELETE SEASON';

/** Only the exact phrase counts: same capitals, no extra words or spaces. */
export function isSeasonConfirmed(typed: unknown): boolean {
  return typed === SEASON_CONFIRM;
}
