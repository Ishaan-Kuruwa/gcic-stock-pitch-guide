/**
 * Mentorship rules: the "Want a mentor?" notice, the admin's status and
 * mentor form, the check-in flag, and the rows on /admin/teams and /mentor.
 * Pure functions; the queries live in src/db/mentorship.ts.
 */
import { mentorship } from '../data/club';
import { MENTORSHIP_STATUSES, type CheckinStatus, type MentorshipStatus } from '../db/schema';
import { checkinStatusLabels } from './checkins';
import { formatShortMonthDay } from './format';
import { daysBetween, nextDueMilestone, visibleMilestones, type NextDue } from './milestones';
import { firstName } from './profile';
import { mentorshipLabels } from './teams';

// ---------------------------------------------------------------------------
// The application notice
// ---------------------------------------------------------------------------

/**
 * Show "Want a mentor? Apply with the club form" only to self-guided teams,
 * only once the form link is set, and only up to the closing day.
 */
export function showMentorApplication(
  status: MentorshipStatus,
  applicationUrl: string | null,
  today: string,
  closes: string = mentorship.closes,
): boolean {
  return status === 'self-guided' && applicationUrl !== null && daysBetween(today, closes) >= 0;
}

// ---------------------------------------------------------------------------
// The admin form on /team/[id]
// ---------------------------------------------------------------------------

export type MentorshipParse =
  | { ok: true; value: { status: MentorshipStatus; mentorId: string | null } }
  | { ok: false; error: string };

/**
 * The admin's "Save mentorship" form: `mentorship_status` and `mentor_id`
 * ('' for no mentor). `mentorIds` are the people who may be assigned right
 * now (mentors and admins, from listAssignableMentors).
 * A team with a mentor needs one chosen, and a mentor can only be chosen
 * for a team with a mentor, so nothing is cleared without the admin seeing it.
 */
export function parseMentorshipForm(form: FormData, mentorIds: readonly string[]): MentorshipParse {
  const rawStatus = form.get('mentorship_status');
  const rawMentor = form.get('mentor_id');
  const status = (MENTORSHIP_STATUSES as readonly unknown[]).includes(rawStatus)
    ? (rawStatus as MentorshipStatus)
    : null;
  if (!status) return { ok: false, error: 'Choose a mentorship status.' };
  const mentorId = typeof rawMentor === 'string' && rawMentor !== '' ? rawMentor : null;
  if (mentorId !== null && !mentorIds.includes(mentorId)) {
    return { ok: false, error: "That person isn't a mentor any more. Choose someone from the list." };
  }
  if (status === 'mentored' && mentorId === null) {
    return { ok: false, error: `Choose a mentor for a team marked "${mentorshipLabels.mentored}".` };
  }
  if (status !== 'mentored' && mentorId !== null) {
    return {
      ok: false,
      error: `Set the status to "${mentorshipLabels.mentored}" to assign a mentor, or choose "No mentor".`,
    };
  }
  return { ok: true, value: { status, mentorId } };
}

// ---------------------------------------------------------------------------
// The check-in flag
// ---------------------------------------------------------------------------

export type CheckinFlag = 'needs-mentor' | 'no-checkin-yet' | 'overdue';

/**
 * Why a mentored team needs an officer's attention, or null. Other teams are
 * never flagged. `lastMetOn` is the latest check-in's meeting day (YYYY-MM-DD)
 * and `today` is the club's day.
 */
export function checkinFlag(
  status: MentorshipStatus,
  mentorId: string | null,
  lastMetOn: string | null,
  today: string,
  everyDays: number = mentorship.checkinEveryDays,
): CheckinFlag | null {
  if (status !== 'mentored') return null;
  if (mentorId === null) return 'needs-mentor';
  if (lastMetOn === null) return 'no-checkin-yet';
  return daysBetween(lastMetOn, today) >= everyDays ? 'overdue' : null;
}

/** The flag in words (never colour alone). */
export function checkinFlagText(flag: CheckinFlag, everyDays: number = mentorship.checkinEveryDays): string {
  if (flag === 'needs-mentor') return 'Needs a mentor';
  if (flag === 'no-checkin-yet') return 'No check-ins yet';
  return `No check-in in ${everyDays}+ days`;
}

// ---------------------------------------------------------------------------
// Rows for /admin/teams and /mentor
// ---------------------------------------------------------------------------

/** One team as getTeamsOverview reads it. */
export interface TeamOverviewData {
  id: string;
  name: string;
  company: string | null;
  ticker: string | null;
  mentorshipStatus: MentorshipStatus;
  mentorId: string | null;
  mentorName: string | null;
  members: { name: string | null; grade: number | null }[];
  doneKeys: readonly string[];
  lastCheckin: { metOn: string; status: CheckinStatus } | null;
}

export interface TeamOverviewRow {
  id: string;
  name: string;
  /** "Ada, grade 10; Ben, grade 11". */
  members: string;
  /** "Apple (AAPL)" or "Not chosen yet". */
  company: string;
  status: MentorshipStatus;
  statusLabel: string;
  /** The mentor's name, or null when there is none. */
  mentor: string | null;
  done: number;
  total: number;
  nextDue: NextDue | null;
  /** "Dec 3, on track", or null when there's no check-in. */
  lastCheckin: string | null;
  lastMetOn: string | null;
  flag: CheckinFlag | null;
  flagText: string | null;
}

const flagRank: Record<CheckinFlag, number> = { 'needs-mentor': 0, 'no-checkin-yet': 1, overdue: 2 };

export function overviewRow(team: TeamOverviewData, today: string): TeamOverviewRow {
  const visible = visibleMilestones(team.mentorshipStatus);
  const done = new Set(team.doneKeys);
  const lastMetOn = team.lastCheckin?.metOn ?? null;
  const flag = checkinFlag(team.mentorshipStatus, team.mentorId, lastMetOn, today);
  return {
    id: team.id,
    name: team.name,
    members: team.members
      .map((m) => `${m.name ? firstName(m.name) : 'Member'}${m.grade !== null ? `, grade ${m.grade}` : ''}`)
      .join('; '),
    company: team.company ? `${team.company}${team.ticker ? ` (${team.ticker})` : ''}` : 'Not chosen yet',
    status: team.mentorshipStatus,
    statusLabel: mentorshipLabels[team.mentorshipStatus],
    mentor: team.mentorId ? (team.mentorName ?? 'Mentor') : null,
    done: visible.filter((m) => done.has(m.key)).length,
    total: visible.length,
    nextDue: nextDueMilestone(team.mentorshipStatus, done, today),
    lastCheckin: team.lastCheckin
      ? `${formatShortMonthDay(team.lastCheckin.metOn)}, ${checkinStatusLabels[team.lastCheckin.status].toLowerCase()}`
      : null,
    lastMetOn,
    flag,
    flagText: flag ? checkinFlagText(flag) : null,
  };
}

/**
 * Rows in the order officers act on them: mentored teams that need attention
 * first (needs a mentor, then no check-ins yet, then overdue with the oldest
 * check-in first), then every other team by name.
 */
export function overviewRows(teams: readonly TeamOverviewData[], today: string): TeamOverviewRow[] {
  return teams
    .map((t) => overviewRow(t, today))
    .sort((a, b) => {
      const ra = a.flag ? flagRank[a.flag] : 3;
      const rb = b.flag ? flagRank[b.flag] : 3;
      if (ra !== rb) return ra - rb;
      if (a.flag === 'overdue' && b.flag === 'overdue' && a.lastMetOn !== b.lastMetOn) {
        return (a.lastMetOn ?? '').localeCompare(b.lastMetOn ?? '');
      }
      return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id);
    });
}

// ---------------------------------------------------------------------------
// The CSV download on /admin/teams
// ---------------------------------------------------------------------------

/**
 * Column headings for /admin/teams.csv. No emails and no check-in notes:
 * only what the All teams table shows, for officers' records.
 */
export const TEAMS_CSV_HEADER = [
  'Team',
  'Members (grade)',
  'Company',
  'Ticker',
  'Mentorship status',
  'Mentor',
  'Milestones done',
  'Next due',
  'Next due date',
  'Last check-in date',
  'Last check-in status',
  'Attention',
] as const;

/** The CSV's header and one row per team, in the All teams order. */
export function teamsCsvRows(teams: readonly TeamOverviewData[], today: string): string[][] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const rows = overviewRows(teams, today).map((row) => {
    const team = byId.get(row.id)!;
    return [
      row.name,
      team.members.map((m) => `${m.name ?? 'Member'}${m.grade !== null ? ` (${m.grade})` : ''}`).join('; '),
      team.company ?? '',
      team.ticker ?? '',
      row.statusLabel,
      row.mentor ?? '',
      `${row.done} of ${row.total}`,
      row.nextDue ? row.nextDue.label : 'All done',
      row.nextDue ? row.nextDue.status.date : '',
      team.lastCheckin?.metOn ?? '',
      team.lastCheckin ? checkinStatusLabels[team.lastCheckin.status] : '',
      row.flagText ?? '',
    ];
  });
  return [[...TEAMS_CSV_HEADER], ...rows];
}

/** "ghic-teams-2026-11-21.csv". */
export function teamsCsvFilename(today: string): string {
  return `ghic-teams-${today}.csv`;
}
