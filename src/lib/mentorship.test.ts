import { describe, expect, it } from 'vitest';
import {
  checkinFlag,
  checkinFlagText,
  overviewRows,
  parseMentorshipForm,
  showMentorApplication,
  type TeamOverviewData,
} from './mentorship';

const URL_SET = 'https://docs.google.com/forms/d/e/x/viewform';

describe('showMentorApplication', () => {
  it('shows to self-guided teams up to and including the closing day', () => {
    expect(showMentorApplication('self-guided', URL_SET, '2026-12-07', '2026-12-08')).toBe(true);
    expect(showMentorApplication('self-guided', URL_SET, '2026-12-08', '2026-12-08')).toBe(true);
    expect(showMentorApplication('self-guided', URL_SET, '2026-12-09', '2026-12-08')).toBe(false);
  });

  it('is hidden while the form link is not set', () => {
    expect(showMentorApplication('self-guided', null, '2026-12-01', '2026-12-08')).toBe(false);
  });

  it('is hidden for teams that applied, have a mentor, or were declined', () => {
    for (const status of ['applied', 'mentored', 'declined'] as const) {
      expect(showMentorApplication(status, URL_SET, '2026-12-01', '2026-12-08')).toBe(false);
    }
  });
});

describe('parseMentorshipForm', () => {
  const mentorIds = ['m1', 'admin1'];
  const form = (status: string, mentor = '') => {
    const data = new FormData();
    data.set('mentorship_status', status);
    data.set('mentor_id', mentor);
    return data;
  };

  it('accepts each status without a mentor, except mentored', () => {
    for (const status of ['self-guided', 'applied', 'declined']) {
      expect(parseMentorshipForm(form(status), mentorIds)).toEqual({ ok: true, value: { status, mentorId: null } });
    }
  });

  it('mentored requires a mentor', () => {
    expect(parseMentorshipForm(form('mentored'), mentorIds).ok).toBe(false);
    expect(parseMentorshipForm(form('mentored', 'm1'), mentorIds)).toEqual({
      ok: true,
      value: { status: 'mentored', mentorId: 'm1' },
    });
  });

  it("accepts an admin's id as the mentor", () => {
    expect(parseMentorshipForm(form('mentored', 'admin1'), mentorIds)).toEqual({
      ok: true,
      value: { status: 'mentored', mentorId: 'admin1' },
    });
  });

  it('refuses someone who is not a current mentor', () => {
    const result = parseMentorshipForm(form('mentored', 'student1'), mentorIds);
    expect(result.ok ? null : result.error).toMatch(/isn't a mentor/);
  });

  it('refuses a mentor on a team without the mentored status', () => {
    const result = parseMentorshipForm(form('applied', 'm1'), mentorIds);
    expect(result.ok ? null : result.error).toMatch(/No mentor/);
  });

  it('refuses a status that is not on the list', () => {
    expect(parseMentorshipForm(form('vip'), mentorIds).ok).toBe(false);
  });
});

describe('checkinFlag', () => {
  const TODAY = '2026-12-20';
  it('flags a mentored team after 14 days, not 13', () => {
    expect(checkinFlag('mentored', 'm1', '2026-12-07', TODAY)).toBeNull();
    expect(checkinFlag('mentored', 'm1', '2026-12-06', TODAY)).toBe('overdue');
    expect(checkinFlag('mentored', 'm1', '2026-11-01', TODAY)).toBe('overdue');
  });

  it('flags a mentored team with no mentor or no check-ins', () => {
    expect(checkinFlag('mentored', null, '2026-12-19', TODAY)).toBe('needs-mentor');
    expect(checkinFlag('mentored', 'm1', null, TODAY)).toBe('no-checkin-yet');
  });

  it('never flags teams without a mentor', () => {
    for (const status of ['self-guided', 'applied', 'declined'] as const) {
      expect(checkinFlag(status, null, null, TODAY)).toBeNull();
    }
  });

  it('reads in words', () => {
    expect(checkinFlagText('overdue')).toBe('No check-in in 14+ days');
    expect(checkinFlagText('needs-mentor')).toBe('Needs a mentor');
  });
});

describe('overviewRows', () => {
  const TODAY = '2026-12-20';
  const team = (over: Partial<TeamOverviewData>): TeamOverviewData => ({
    id: over.name ?? 'x',
    name: 'Team',
    company: null,
    ticker: null,
    mentorshipStatus: 'self-guided',
    mentorId: null,
    mentorName: null,
    members: [],
    doneKeys: [],
    lastCheckin: null,
    ...over,
  });

  it('puts mentored teams needing attention first, then everyone by name', () => {
    const rows = overviewRows(
      [
        team({ name: 'Alpha' }),
        team({ name: 'Bravo', mentorshipStatus: 'mentored', mentorId: 'm1', lastCheckin: { metOn: '2026-12-18', status: 'on-track' } }),
        team({ name: 'Charlie', mentorshipStatus: 'mentored', mentorId: 'm1', lastCheckin: { metOn: '2026-12-01', status: 'behind' } }),
        team({ name: 'Delta', mentorshipStatus: 'mentored', mentorId: 'm1', lastCheckin: { metOn: '2026-11-20', status: 'stuck' } }),
        team({ name: 'Echo', mentorshipStatus: 'mentored', mentorId: null }),
        team({ name: 'Foxtrot', mentorshipStatus: 'mentored', mentorId: 'm1' }),
        team({ name: 'aardvark', mentorshipStatus: 'applied' }),
      ],
      TODAY,
    );
    expect(rows.map((r) => [r.name, r.flagText])).toEqual([
      ['Echo', 'Needs a mentor'],
      ['Foxtrot', 'No check-ins yet'],
      ['Delta', 'No check-in in 14+ days'],
      ['Charlie', 'No check-in in 14+ days'],
      ['aardvark', null],
      ['Alpha', null],
      ['Bravo', null],
    ]);
  });

  it('writes members, company, milestones, next due and last check-in in words', () => {
    const [row] = overviewRows(
      [
        team({
          name: 'Bulls',
          company: 'Apple',
          ticker: 'AAPL',
          mentorshipStatus: 'mentored',
          mentorId: 'm1',
          mentorName: 'Grace Hopper',
          members: [
            { name: 'Ada Lovelace', grade: 10 },
            { name: null, grade: null },
          ],
          doneKeys: ['company-picked', 'mentor-review', 'unknown-key'],
          lastCheckin: { metOn: '2026-12-15', status: 'on-track' },
        }),
      ],
      TODAY,
    );
    expect(row).toMatchObject({
      members: 'Ada, grade 10; Member',
      company: 'Apple (AAPL)',
      mentor: 'Grace Hopper',
      done: 2,
      total: 9,
      lastCheckin: 'Dec 15, on track',
      flag: null,
    });
    expect(row!.nextDue).toEqual({
      label: 'Registered with YIS',
      status: { text: 'Due Dec 19, 1 day late', state: 'late', date: '2026-12-19' },
    });
  });

  it('counts only visible milestones for teams without a mentor', () => {
    const [row] = overviewRows([team({ doneKeys: ['mentor-review', 'comps'] })], TODAY);
    expect([row!.done, row!.total]).toEqual([1, 8]);
  });
});
