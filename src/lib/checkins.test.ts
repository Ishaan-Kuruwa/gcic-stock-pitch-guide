import { describe, expect, it } from 'vitest';
import { isIsoDate, MAX_COVERED, MAX_NEXT_STEP, parseCheckinForm } from './checkins';

const TODAY = '2026-12-10';

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const good = { met_on: '2026-12-08', covered: 'Walked through the comps sheet.', next_step: 'Finish the DCF.', status: 'on-track' };

describe('isIsoDate', () => {
  it('accepts real dates only', () => {
    expect(isIsoDate('2026-12-08')).toBe(true);
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('12/08/2026')).toBe(false);
    expect(isIsoDate('2026-1-8')).toBe(false);
  });
});

describe('parseCheckinForm', () => {
  it('accepts a good check-in, trimming text and Windows line breaks', () => {
    const result = parseCheckinForm(form({ ...good, covered: '  Line one\r\nLine two  ' }), TODAY);
    expect(result).toEqual({
      ok: true,
      value: { metOn: '2026-12-08', covered: 'Line one\nLine two', nextStep: 'Finish the DCF.', status: 'on-track' },
    });
  });

  it('uses today when the date is left empty', () => {
    const result = parseCheckinForm(form({ ...good, met_on: '' }), TODAY);
    expect(result.ok && result.value.metOn).toBe(TODAY);
  });

  it('allows today but not a future date', () => {
    expect(parseCheckinForm(form({ ...good, met_on: TODAY }), TODAY).ok).toBe(true);
    const future = parseCheckinForm(form({ ...good, met_on: '2026-12-11' }), TODAY);
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.errors.metOn).toMatch(/future/);
  });

  it('refuses a date that is not a real day', () => {
    const result = parseCheckinForm(form({ ...good, met_on: '2026-11-31' }), TODAY);
    expect(result.ok ? null : result.errors.metOn).toMatch(/meeting date/);
  });

  it('needs what was covered', () => {
    const result = parseCheckinForm(form({ ...good, covered: '   ' }), TODAY);
    expect(result.ok ? null : result.errors.covered).toBe('Write what you covered.');
  });

  it(`allows ${MAX_COVERED} characters covered, not ${MAX_COVERED + 1}`, () => {
    expect(parseCheckinForm(form({ ...good, covered: 'a'.repeat(MAX_COVERED) }), TODAY).ok).toBe(true);
    const long = parseCheckinForm(form({ ...good, covered: 'a'.repeat(MAX_COVERED + 1) }), TODAY);
    expect(long.ok ? null : long.errors.covered).toMatch(/1000 characters or fewer \(now 1001\)/);
  });

  it(`lets the next step be empty, up to ${MAX_NEXT_STEP} characters`, () => {
    expect(parseCheckinForm(form({ ...good, next_step: '' }), TODAY).ok).toBe(true);
    expect(parseCheckinForm(form({ ...good, next_step: 'b'.repeat(MAX_NEXT_STEP) }), TODAY).ok).toBe(true);
    const long = parseCheckinForm(form({ ...good, next_step: 'b'.repeat(MAX_NEXT_STEP + 1) }), TODAY);
    expect(long.ok ? null : long.errors.nextStep).toMatch(/500 characters or fewer \(now 501\)/);
  });

  it('needs one of the three statuses', () => {
    for (const status of ['on-track', 'behind', 'stuck']) {
      expect(parseCheckinForm(form({ ...good, status }), TODAY).ok).toBe(true);
    }
    const bad = parseCheckinForm(form({ ...good, status: 'great' }), TODAY);
    expect(bad.ok ? null : bad.errors.status).toMatch(/on track, behind or stuck/);
  });

  it('gives back what was typed after an error', () => {
    const result = parseCheckinForm(form({ ...good, status: '' }), TODAY);
    expect(result.ok ? null : result.raw).toEqual({ metOn: good.met_on, covered: good.covered, nextStep: good.next_step, status: '' });
  });
});
