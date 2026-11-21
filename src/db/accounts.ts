/**
 * Club account queries: roles, profiles, the club-code limit, the mentor list
 * and account deletion. The database is passed in, so src/db/accounts.test.ts
 * runs these against a real local D1 (Miniflare) and routes pass the Worker's.
 */
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { WINDOW_MS } from '../lib/clubCode';
import { normalizeEmail, roleForEmail } from '../lib/roles';
import {
  account,
  appSchema,
  clubCodeAttempts,
  mentorInvites,
  profiles,
  session,
  teamCodeAttempts,
  teams,
  user,
  type Profile,
  type Role,
} from './schema';
import { getTeamIdForUser, removeMemberStatements } from './teams';

export type Db = DrizzleD1Database<typeof appSchema>;

/** Users whose email (any case) is `email`. */
function userIdsWithEmail(db: Db, email: string) {
  return db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = ${normalizeEmail(email)}`);
}

/**
 * Called on every sign-in. Works out the role from the user's email and
 * saves it, creating the profile row on the first sign-in. Returns the role,
 * or null if the user doesn't exist.
 */
export async function syncRole(db: Db, userId: string, adminEmails: string[]): Promise<Role | null> {
  const found = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).get();
  if (!found) return null;
  const invite = await db
    .select({ email: mentorInvites.email })
    .from(mentorInvites)
    .where(eq(mentorInvites.email, normalizeEmail(found.email)))
    .get();
  const role = roleForEmail(found.email, adminEmails, invite ? [invite.email] : []);
  await db
    .insert(profiles)
    .values({ userId, role })
    .onConflictDoUpdate({ target: profiles.userId, set: { role } });
  return role;
}

export async function getProfile(db: Db, userId: string): Promise<Profile | null> {
  return (await db.select().from(profiles).where(eq(profiles.userId, userId)).get()) ?? null;
}

/**
 * Save the /join form. `codeOk` records that the right club code was entered
 * just now; mentors and admins pass false and keep whatever was there.
 */
export async function completeProfile(
  db: Db,
  userId: string,
  input: { name: string; grade: number; codeOk: boolean },
  now = new Date(),
): Promise<void> {
  const set: Partial<typeof profiles.$inferInsert> = { name: input.name, grade: input.grade };
  if (input.codeOk) set.clubCodeAt = now;
  await db
    .insert(profiles)
    .values({ userId, ...set })
    .onConflictDoUpdate({ target: profiles.userId, set });
}

export async function recordWrongCode(db: Db, userId: string, now = new Date()): Promise<void> {
  await db.insert(clubCodeAttempts).values({ userId, createdAt: now });
}

/** Times of this user's wrong tries in the last hour. */
export async function recentWrongCodes(db: Db, userId: string, now = new Date()): Promise<Date[]> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const rows = await db
    .select({ at: clubCodeAttempts.createdAt })
    .from(clubCodeAttempts)
    .where(and(eq(clubCodeAttempts.userId, userId), gt(clubCodeAttempts.createdAt, since)));
  return rows.map((r) => r.at);
}

export async function listMentors(db: Db): Promise<{ email: string; addedAt: Date }[]> {
  return db.select().from(mentorInvites).orderBy(mentorInvites.email);
}

/**
 * Add a mentor email. If that person already has an account as a mentee,
 * they become a mentor right away (admins stay admins).
 */
export async function addMentor(db: Db, email: string): Promise<void> {
  const clean = normalizeEmail(email);
  await db.insert(mentorInvites).values({ email: clean }).onConflictDoNothing();
  await db
    .update(profiles)
    .set({ role: 'mentor' })
    .where(and(eq(profiles.role, 'mentee'), inArray(profiles.userId, userIdsWithEmail(db, clean))));
}

/**
 * Remove a mentor email. If that person has an account as a mentor, they
 * become a mentee right away (and must enter the club code to continue).
 */
export async function removeMentor(db: Db, email: string): Promise<void> {
  const clean = normalizeEmail(email);
  await db.delete(mentorInvites).where(eq(mentorInvites.email, clean));
  await db
    .update(profiles)
    .set({ role: 'mentee' })
    .where(and(eq(profiles.role, 'mentor'), inArray(profiles.userId, userIdsWithEmail(db, clean))));
}

/**
 * Delete everything stored about a user: their team membership (and their
 * team, with its links, if they were the last member), join-code and
 * club-code tries, profile, sessions, Google account link and the user row.
 * One batch, so it all goes or none.
 */
export async function deleteAccount(db: Db, userId: string): Promise<void> {
  const teamId = await getTeamIdForUser(db, userId);
  await db.batch([
    db.update(teams).set({ mentorId: null }).where(eq(teams.mentorId, userId)),
    ...(teamId ? removeMemberStatements(db, userId, teamId) : []),
    db.delete(teamCodeAttempts).where(eq(teamCodeAttempts.userId, userId)),
    db.delete(clubCodeAttempts).where(eq(clubCodeAttempts.userId, userId)),
    db.delete(profiles).where(eq(profiles.userId, userId)),
    db.delete(session).where(eq(session.userId, userId)),
    db.delete(account).where(eq(account.userId, userId)),
    db.delete(user).where(eq(user.id, userId)),
  ]);
}
