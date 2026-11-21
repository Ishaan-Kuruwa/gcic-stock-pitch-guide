/**
 * Check-in queries. The form rules live in src/lib/checkins.ts and who may
 * add or edit lives in src/lib/guards.ts (allowedTeamActions); these only
 * read and write. Editing is limited to the mentor who wrote the check-in by
 * the WHERE clause, so a wrong id changes nothing.
 */
import { and, desc, eq } from 'drizzle-orm';
import type { CheckinValues } from '../lib/checkins';
import { todayIn } from '../lib/milestones';
import type { Db } from './accounts';
import { checkins, profiles, type CheckinStatus } from './schema';

export interface CheckinView {
  id: string;
  mentorId: string | null;
  /** The mentor's name from their profile; null once they delete their account. */
  mentorName: string | null;
  metOn: string;
  covered: string;
  nextStep: string;
  status: CheckinStatus;
}

/** A team's check-ins, newest meeting first. */
export async function listCheckins(db: Db, teamId: string): Promise<CheckinView[]> {
  return db
    .select({
      id: checkins.id,
      mentorId: checkins.mentorId,
      mentorName: profiles.name,
      metOn: checkins.metOn,
      covered: checkins.covered,
      nextStep: checkins.nextStep,
      status: checkins.status,
    })
    .from(checkins)
    .leftJoin(profiles, eq(profiles.userId, checkins.mentorId))
    .where(eq(checkins.teamId, teamId))
    .orderBy(desc(checkins.metOn), desc(checkins.createdAt));
}

/** Log a check-in. An empty meeting day means today in the club's time zone. */
export async function addCheckin(
  db: Db,
  teamId: string,
  mentorId: string,
  values: Omit<CheckinValues, 'metOn'> & { metOn?: string },
  now = new Date(),
): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(checkins).values({
    id,
    teamId,
    mentorId,
    metOn: values.metOn || todayIn(undefined, now),
    covered: values.covered,
    nextStep: values.nextStep,
    status: values.status,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/** Edit a check-in. Only its own mentor, on its own team: returns false if nothing matched. */
export async function updateCheckin(
  db: Db,
  id: string,
  teamId: string,
  mentorId: string,
  values: CheckinValues,
  now = new Date(),
): Promise<boolean> {
  const result = await db
    .update(checkins)
    .set({ ...values, updatedAt: now })
    .where(and(eq(checkins.id, id), eq(checkins.teamId, teamId), eq(checkins.mentorId, mentorId)));
  return result.meta.changes > 0;
}
