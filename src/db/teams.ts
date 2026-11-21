/**
 * Team queries: create, join, leave, details, links and join-code tries.
 * The database is passed in, as in src/db/accounts.ts, so src/db/teams.test.ts
 * runs these against a real local D1.
 *
 * Teams never sit empty: creating a team adds its creator in the same batch,
 * and the last member leaving (or deleting their account) deletes the team
 * and its links and milestones in the same batch.
 */
import { and, eq, gt, notExists, sql } from 'drizzle-orm';
import { WINDOW_MS } from '../lib/clubCode';
import { generateJoinCode, normalizeJoinCode, TEAM_LINK_KINDS, type TeamLinkKind } from '../lib/teams';
import type { Db } from './accounts';
import { profiles, teamCodeAttempts, teamLinks, teamMembers, teamMilestones, teams, type Team } from './schema';

export interface TeamMember {
  userId: string;
  name: string | null;
  grade: number | null;
}

export interface TeamView {
  team: Team;
  members: TeamMember[];
  links: Partial<Record<TeamLinkKind, string>>;
}

/** How many times to try a new join code if one is already taken. */
const CODE_ATTEMPTS = 5;

function isUniqueError(error: unknown): boolean {
  const text = String(error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : error);
  return /UNIQUE constraint failed/i.test(text);
}

/** The id of the user's team, or null. */
export async function getTeamIdForUser(db: Db, userId: string): Promise<string | null> {
  const row = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .get();
  return row?.teamId ?? null;
}

/** A team with its members (name and grade from their profiles) and links. */
export async function getTeam(db: Db, teamId: string): Promise<TeamView | null> {
  const team = await db.select().from(teams).where(eq(teams.id, teamId)).get();
  if (!team) return null;
  const [members, linkRows] = await db.batch([
    db
      .select({ userId: teamMembers.userId, name: profiles.name, grade: profiles.grade })
      .from(teamMembers)
      .leftJoin(profiles, eq(profiles.userId, teamMembers.userId))
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(teamMembers.joinedAt),
    db.select({ kind: teamLinks.kind, url: teamLinks.url }).from(teamLinks).where(eq(teamLinks.teamId, teamId)),
  ]);
  const links: Partial<Record<TeamLinkKind, string>> = {};
  for (const row of linkRows) links[row.kind] = row.url;
  return { team, members, links };
}

export type CreateResult = { ok: true; teamId: string } | { ok: false; reason: 'already-on-team' };

/** Make a team with a fresh join code; its creator joins it in the same batch. */
export async function createTeam(db: Db, userId: string, name: string, now = new Date()): Promise<CreateResult> {
  if (await getTeamIdForUser(db, userId)) return { ok: false, reason: 'already-on-team' };
  for (let attempt = 1; ; attempt++) {
    const teamId = crypto.randomUUID();
    try {
      await db.batch([
        db.insert(teams).values({ id: teamId, name, joinCode: generateJoinCode(), createdAt: now }),
        db.insert(teamMembers).values({ teamId, userId, joinedAt: now }),
      ]);
      return { ok: true, teamId };
    } catch (error) {
      if (!isUniqueError(error)) throw error;
      // Either the user joined a team meanwhile, or the join code was taken.
      if (await getTeamIdForUser(db, userId)) return { ok: false, reason: 'already-on-team' };
      if (attempt >= CODE_ATTEMPTS) throw error;
    }
  }
}

export type JoinResult =
  | { ok: true; teamId: string }
  | { ok: false; reason: 'not-found' | 'full' | 'already-on-team' };

/**
 * Join the team with this code (any case). The size check and the insert are
 * one statement, so two students joining at once can't overfill a team.
 */
export async function joinTeam(
  db: Db,
  userId: string,
  code: string,
  maxSize: number,
  now = new Date(),
): Promise<JoinResult> {
  if (await getTeamIdForUser(db, userId)) return { ok: false, reason: 'already-on-team' };
  const team = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.joinCode, normalizeJoinCode(code)))
    .get();
  if (!team) return { ok: false, reason: 'not-found' };
  try {
    const result = await db.run(sql`
      insert into ${teamMembers} (team_id, user_id, joined_at)
      select ${team.id}, ${userId}, ${now.getTime()}
      where (select count(*) from ${teamMembers} where team_id = ${team.id}) < ${maxSize}`);
    if (result.meta.changes === 0) return { ok: false, reason: 'full' };
    return { ok: true, teamId: team.id };
  } catch (error) {
    if (isUniqueError(error)) return { ok: false, reason: 'already-on-team' };
    throw error;
  }
}

export async function recordWrongTeamCode(db: Db, userId: string, now = new Date()): Promise<void> {
  await db.insert(teamCodeAttempts).values({ userId, createdAt: now });
}

/** Times of this user's wrong join codes in the last hour. */
export async function recentWrongTeamCodes(db: Db, userId: string, now = new Date()): Promise<Date[]> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const rows = await db
    .select({ at: teamCodeAttempts.createdAt })
    .from(teamCodeAttempts)
    .where(and(eq(teamCodeAttempts.userId, userId), gt(teamCodeAttempts.createdAt, since)));
  return rows.map((r) => r.at);
}

export async function updateTeamDetails(
  db: Db,
  teamId: string,
  details: { company: string | null; ticker: string | null },
): Promise<void> {
  await db.update(teams).set(details).where(eq(teams.id, teamId));
}

/** Save all five links at once: a URL saves (or replaces) that kind, null removes it. */
export async function setTeamLinks(
  db: Db,
  teamId: string,
  links: Record<TeamLinkKind, string | null>,
  now = new Date(),
): Promise<void> {
  const [first, ...rest] = TEAM_LINK_KINDS.map((kind) => {
    const url = links[kind];
    return url === null
      ? db.delete(teamLinks).where(and(eq(teamLinks.teamId, teamId), eq(teamLinks.kind, kind)))
      : db
          .insert(teamLinks)
          .values({ teamId, kind, url, updatedAt: now })
          .onConflictDoUpdate({ target: [teamLinks.teamId, teamLinks.kind], set: { url, updatedAt: now } });
  });
  await db.batch([first!, ...rest]);
}

/** Replace the team's join code. Returns the new code. */
export async function regenerateJoinCode(db: Db, teamId: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const joinCode = generateJoinCode();
    try {
      await db.update(teams).set({ joinCode }).where(eq(teams.id, teamId));
      return joinCode;
    } catch (error) {
      if (!isUniqueError(error) || attempt >= CODE_ATTEMPTS) throw error;
    }
  }
}

/**
 * Statements that remove a user from a team, then delete the team's links,
 * milestones and the team if nobody is left. For a batch: leaveTeam and
 * deleteAccount.
 */
export function removeMemberStatements(db: Db, userId: string, teamId: string) {
  const nobodyLeft = notExists(
    db.select({ one: sql`1` }).from(teamMembers).where(eq(teamMembers.teamId, teamId)),
  );
  return [
    db.delete(teamMembers).where(eq(teamMembers.userId, userId)),
    db.delete(teamLinks).where(and(eq(teamLinks.teamId, teamId), nobodyLeft)),
    db.delete(teamMilestones).where(and(eq(teamMilestones.teamId, teamId), nobodyLeft)),
    db.delete(teams).where(and(eq(teams.id, teamId), nobodyLeft)),
  ] as const;
}

export type LeaveResult = 'left' | 'team-deleted' | 'not-on-team';

/** Leave your team. The last member leaving deletes the team, its links and milestones. */
export async function leaveTeam(db: Db, userId: string): Promise<LeaveResult> {
  const teamId = await getTeamIdForUser(db, userId);
  if (!teamId) return 'not-on-team';
  const [, , , deletedTeam] = await db.batch(removeMemberStatements(db, userId, teamId));
  return deletedTeam.meta.changes > 0 ? 'team-deleted' : 'left';
}
