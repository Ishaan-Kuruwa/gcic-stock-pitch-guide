/**
 * Team milestone queries. The rules (which keys a member may change) live in
 * src/lib/milestones.ts; these only read and write.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { MilestonePlan } from '../lib/milestones';
import type { Db } from './accounts';
import { teamMilestones } from './schema';

/** Done milestones for a team: key → when it was ticked. */
export async function getTeamMilestones(db: Db, teamId: string): Promise<Map<string, Date>> {
  const rows = await db
    .select({ key: teamMilestones.key, doneAt: teamMilestones.doneAt })
    .from(teamMilestones)
    .where(eq(teamMilestones.teamId, teamId));
  return new Map(rows.map((r) => [r.key, r.doneAt]));
}

/**
 * Apply a plan from planMilestoneSave in one batch. A key that's already done
 * keeps its first done date.
 */
export async function saveTeamMilestones(
  db: Db,
  teamId: string,
  userId: string,
  plan: MilestonePlan,
  now = new Date(),
): Promise<void> {
  const statements = [
    ...plan.add.map((key) =>
      db.insert(teamMilestones).values({ teamId, key, doneAt: now, doneBy: userId }).onConflictDoNothing(),
    ),
    ...(plan.remove.length > 0
      ? [
          db
            .delete(teamMilestones)
            .where(and(eq(teamMilestones.teamId, teamId), inArray(teamMilestones.key, plan.remove))),
        ]
      : []),
  ];
  const [first, ...rest] = statements;
  if (!first) return;
  await db.batch([first, ...rest]);
}
