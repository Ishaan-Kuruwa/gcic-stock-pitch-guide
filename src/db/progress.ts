/**
 * Module progress queries: which modules a student has marked done, by slug.
 * Slugs are checked against the modules collection before they get here
 * (src/lib/progressApi.ts).
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from './accounts';
import { moduleProgress } from './schema';

/** Slugs the user has marked done, in no particular order. */
export async function getModuleProgress(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: moduleProgress.moduleSlug })
    .from(moduleProgress)
    .where(eq(moduleProgress.userId, userId));
  return rows.map((r) => r.slug);
}

/** Mark one module done (keeping its first done time) or not done. */
export async function setModuleDone(db: Db, userId: string, slug: string, done: boolean, now = new Date()) {
  if (done) {
    await db.insert(moduleProgress).values({ userId, moduleSlug: slug, completedAt: now }).onConflictDoNothing();
  } else {
    await db.delete(moduleProgress).where(and(eq(moduleProgress.userId, userId), eq(moduleProgress.moduleSlug, slug)));
  }
}

/** Mark several modules done (the first-sign-in merge). Never unticks anything. */
export async function addModuleProgress(db: Db, userId: string, slugs: readonly string[], now = new Date()) {
  const [first, ...rest] = slugs.map((slug) =>
    db.insert(moduleProgress).values({ userId, moduleSlug: slug, completedAt: now }).onConflictDoNothing(),
  );
  if (!first) return;
  await db.batch([first, ...rest]);
}

/**
 * How many modules each user has done, counting only slugs that still exist
 * (so a renamed or removed module doesn't inflate the count).
 */
export async function countModuleProgress(
  db: Db,
  userIds: readonly string[],
  validSlugs: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(userIds.map((id) => [id, 0]));
  if (userIds.length === 0 || validSlugs.length === 0) return counts;
  const rows = await db
    .select({ userId: moduleProgress.userId, n: sql<number>`count(*)` })
    .from(moduleProgress)
    .where(and(inArray(moduleProgress.userId, [...userIds]), inArray(moduleProgress.moduleSlug, [...validSlugs])))
    .groupBy(moduleProgress.userId);
  for (const row of rows) counts.set(row.userId, Number(row.n));
  return counts;
}
