import { describe, expect, it } from 'vitest';
import { mentorship, milestones, targetSubmitDate, templates } from '../data/club';

describe('club templates', () => {
  it.each(Object.entries(templates))('%s is a Google Docs "make a copy" link', (_id, t) => {
    const url = new URL(t.url);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('docs.google.com');
    expect(url.pathname).toMatch(/^\/(spreadsheets|presentation)\/d\/[\w-]+\/copy$/);
    expect(t.label).toMatch(/Template$/);
  });
});

describe('club milestones', () => {
  it.each(milestones.map((m) => [m.key, m.due]))(
    '%s (due %s) is a real date on or before targetSubmitDate',
    (_key, due) => {
      expect(due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${due}T00:00:00Z`).toISOString().slice(0, 10)).toBe(due);
      expect(due <= targetSubmitDate).toBe(true);
    },
  );

  it('ends with submitted, due on targetSubmitDate', () => {
    const submitted = milestones.find((m) => m.key === 'submitted');
    expect(submitted?.due).toBe(targetSubmitDate);
    expect(milestones.at(-1)?.key).toBe('submitted');
  });

  it('has unique keys in date order', () => {
    const keys = milestones.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    const dues = milestones.map((m) => m.due);
    expect([...dues].sort()).toEqual(dues);
  });

  it('marks only the mentor review as mentored-only', () => {
    expect(milestones.filter((m) => 'mentoredOnly' in m && m.mentoredOnly).map((m) => m.key)).toEqual([
      'mentor-review',
    ]);
  });
});

describe('club mentorship', () => {
  it('closes on a real date before the target submit date', () => {
    expect(mentorship.closes).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${mentorship.closes}T00:00:00Z`).toISOString().slice(0, 10)).toBe(mentorship.closes);
    expect(mentorship.closes < targetSubmitDate).toBe(true);
  });

  it('has an https application link, or none yet', () => {
    if (mentorship.applicationUrl !== null) expect(new URL(mentorship.applicationUrl).protocol).toBe('https:');
  });

  it('checks in every 14 days', () => expect(mentorship.checkinEveryDays).toBe(14));
});
