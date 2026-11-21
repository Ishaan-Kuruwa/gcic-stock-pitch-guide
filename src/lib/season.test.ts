import { describe, expect, it } from 'vitest';
import { isSeasonConfirmed, SEASON_CONFIRM } from './season';

describe('isSeasonConfirmed', () => {
  it('accepts exactly the phrase', () => {
    expect(SEASON_CONFIRM).toBe('DELETE SEASON');
    expect(isSeasonConfirmed('DELETE SEASON')).toBe(true);
  });

  it('refuses anything else', () => {
    for (const typed of ['delete season', 'Delete Season', ' DELETE SEASON', 'DELETE SEASON ', 'DELETE  SEASON', 'DELETE', '', null, undefined]) {
      expect(isSeasonConfirmed(typed)).toBe(false);
    }
  });
});
