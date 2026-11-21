/**
 * Mentorship queries: who can be assigned, setting a team's status and
 * mentor, and the data behind /admin/teams and /mentor. The rules live in
 * src/lib/mentorship.ts; these only read and write.
 */
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { TeamOverviewData } from '../lib/mentorship';
import type { Db } from './accounts';
import {
  checkins,
  profiles,
  teamMembers,
  teamMilestones,
  teams,
  user,
  type CheckinStatus,
  type MentorshipStatus,
} from './schema';

export interface AssignableMentor {
  userId: string;
  name: string;
  email: string;
}

/** Everyone who can be a team's mentor: mentors and admins who finished /join. */
export async function listAssignableMentors(db: Db): Promise<AssignableMentor[]> {
  const rows = await db
    .select({ userId: profiles.userId, name: profiles.name, email: user.email })
    .from(profiles)
    .innerJoin(user, eq(user.id, profiles.userId))
    .where(and(inArray(profiles.role, ['mentor', 'admin']), isNotNull(profiles.name)))
    .orderBy(profiles.name);
  return rows.map((r) => ({ userId: r.userId, name: r.name ?? '', email: r.email }));
}

/** Set a team's mentorship status and mentor. Check-ins are untouched. */
export async function setMentorship(
  db: Db,
  teamId: string,
  status: MentorshipStatus,
  mentorId: string | null,
): Promise<void> {
  await db.update(teams).set({ mentorshipStatus: status, mentorId }).where(eq(teams.id, teamId));
}

/**
 * Every team (or only those `mentorId` is assigned to) with its members,
 * done milestone keys, mentor's name and latest check-in. Filters use
 * subqueries, not lists of ids, so there's no limit on how many teams.
 */
export async function getTeamsOverview(db: Db, options: { mentorId?: string } = {}): Promise<TeamOverviewData[]> {
  const mine = options.mentorId === undefined ? undefined : eq(teams.mentorId, options.mentorId);
  const teamIds = db.select({ id: teams.id }).from(teams).where(mine);
  const inTeams = (column: AnySQLiteColumn) => (mine ? inArray(column, teamIds) : undefined);

  const [teamRows, memberRows, milestoneRows, checkinRows] = await db.batch([
    db
      .select({
        id: teams.id,
        name: teams.name,
        company: teams.company,
        ticker: teams.ticker,
        mentorshipStatus: teams.mentorshipStatus,
        mentorId: teams.mentorId,
        // Aliased: D1 batches return rows by column name, and teams.name is also "name".
        mentorName: sql<string | null>`${profiles.name}`.as('mentor_name'),
      })
      .from(teams)
      .leftJoin(profiles, eq(profiles.userId, teams.mentorId))
      .where(mine),
    db
      .select({ teamId: teamMembers.teamId, name: profiles.name, grade: profiles.grade })
      .from(teamMembers)
      .leftJoin(profiles, eq(profiles.userId, teamMembers.userId))
      .where(inTeams(teamMembers.teamId))
      .orderBy(teamMembers.joinedAt),
    db
      .select({ teamId: teamMilestones.teamId, key: teamMilestones.key })
      .from(teamMilestones)
      .where(inTeams(teamMilestones.teamId)),
    db
      .select({ teamId: checkins.teamId, metOn: checkins.metOn, status: checkins.status })
      .from(checkins)
      .where(inTeams(checkins.teamId))
      .orderBy(desc(checkins.metOn), desc(checkins.createdAt)),
  ]);

  const members = new Map<string, { name: string | null; grade: number | null }[]>();
  for (const m of memberRows) {
    const list = members.get(m.teamId) ?? [];
    list.push({ name: m.name, grade: m.grade });
    members.set(m.teamId, list);
  }
  const done = new Map<string, string[]>();
  for (const m of milestoneRows) done.set(m.teamId, [...(done.get(m.teamId) ?? []), m.key]);
  // Rows come newest first, so the first one seen for a team is its latest.
  const latest = new Map<string, { metOn: string; status: CheckinStatus }>();
  for (const c of checkinRows) if (!latest.has(c.teamId)) latest.set(c.teamId, { metOn: c.metOn, status: c.status });

  return teamRows.map((t) => ({
    ...t,
    members: members.get(t.id) ?? [],
    doneKeys: done.get(t.id) ?? [],
    lastCheckin: latest.get(t.id) ?? null,
  }));
}
