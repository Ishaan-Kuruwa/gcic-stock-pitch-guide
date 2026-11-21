/**
 * End of season: delete every student's account and every team, keep the
 * officers and mentors. Used by /admin/season (admins only).
 *
 * Kept accounts: anyone whose profile role is admin or mentor, plus anyone
 * whose email is in ADMIN_EMAILS or on the mentor list (so an officer or
 * mentor who never finished /join isn't caught). Everyone else is a mentee
 * account and is deleted with its profile, sessions, Google link, module
 * progress and club-code tries.
 *
 * Every team goes, with its members, links, milestones, check-ins and wrong
 * join-code tries. The mentor list (mentor_invites) stays.
 */
import { count, inArray, notInArray, or, sql } from 'drizzle-orm';
import { normalizeEmail } from '../lib/roles';
import type { Db } from './accounts';
import {
  account,
  checkins,
  clubCodeAttempts,
  mentorInvites,
  moduleProgress,
  profiles,
  session,
  teamCodeAttempts,
  teamLinks,
  teamMembers,
  teamMilestones,
  teams,
  user,
} from './schema';

/** Ids of the accounts the season delete keeps. */
function keptUserIds(db: Db, adminEmails: readonly string[]) {
  const emails = adminEmails.map(normalizeEmail);
  const lowerEmail = sql`lower(${user.email})`;
  return db
    .select({ id: user.id })
    .from(user)
    .where(
      or(
        inArray(user.id, db.select({ id: profiles.userId }).from(profiles).where(inArray(profiles.role, ['admin', 'mentor']))),
        inArray(lowerEmail, db.select({ email: mentorInvites.email }).from(mentorInvites)),
        emails.length > 0 ? inArray(lowerEmail, emails) : undefined,
      ),
    );
}

/** Ids of the mentee accounts the season delete removes. */
function deletedUserIds(db: Db, adminEmails: readonly string[]) {
  return db.select({ id: user.id }).from(user).where(notInArray(user.id, keptUserIds(db, adminEmails)));
}

export interface SeasonCounts {
  /** Deleted. */
  menteeAccounts: number;
  teams: number;
  teamMembers: number;
  teamLinks: number;
  milestones: number;
  checkins: number;
  /** Kept. */
  admins: number;
  mentors: number;
  mentorList: number;
}

/** What a season delete would remove and keep right now. */
export async function seasonCounts(db: Db, adminEmails: readonly string[]): Promise<SeasonCounts> {
  const [mentees, teamRows, members, links, milestones, notes, admins, mentors, invites] = await db.batch([
    db.select({ n: count() }).from(user).where(inArray(user.id, deletedUserIds(db, adminEmails))),
    db.select({ n: count() }).from(teams),
    db.select({ n: count() }).from(teamMembers),
    db.select({ n: count() }).from(teamLinks),
    db.select({ n: count() }).from(teamMilestones),
    db.select({ n: count() }).from(checkins),
    db.select({ n: count() }).from(profiles).where(sql`${profiles.role} = 'admin'`),
    db.select({ n: count() }).from(profiles).where(sql`${profiles.role} = 'mentor'`),
    db.select({ n: count() }).from(mentorInvites),
  ]);
  return {
    menteeAccounts: mentees[0]?.n ?? 0,
    teams: teamRows[0]?.n ?? 0,
    teamMembers: members[0]?.n ?? 0,
    teamLinks: links[0]?.n ?? 0,
    milestones: milestones[0]?.n ?? 0,
    checkins: notes[0]?.n ?? 0,
    admins: admins[0]?.n ?? 0,
    mentors: mentors[0]?.n ?? 0,
    mentorList: invites[0]?.n ?? 0,
  };
}

/**
 * Delete the season. One batch, children first, so it all goes or none.
 * Returns the counts from just before, for the confirmation message.
 */
export async function deleteSeason(db: Db, adminEmails: readonly string[]): Promise<SeasonCounts> {
  const before = await seasonCounts(db, adminEmails);
  const gone = () => deletedUserIds(db, adminEmails);
  await db.batch([
    db.delete(checkins),
    db.delete(teamMilestones),
    db.delete(teamLinks),
    db.delete(teamMembers),
    db.delete(teams),
    db.delete(teamCodeAttempts),
    db.delete(moduleProgress).where(inArray(moduleProgress.userId, gone())),
    db.delete(clubCodeAttempts).where(inArray(clubCodeAttempts.userId, gone())),
    db.delete(profiles).where(inArray(profiles.userId, gone())),
    db.delete(session).where(inArray(session.userId, gone())),
    db.delete(account).where(inArray(account.userId, gone())),
    db.delete(user).where(inArray(user.id, gone())),
  ]);
  return before;
}
