/**
 * Test helper (not app code): a real local D1 database for the DB tests.
 * wrangler's getPlatformProxy starts workerd with an in-memory copy
 * (persist: false), and every migration in drizzle/migrations is applied.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/d1';
import { getPlatformProxy } from 'wrangler';
import type { Db } from './accounts';
import {
  account,
  appSchema,
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

export interface TestDb {
  db: Db;
  dispose(): Promise<void>;
}

export async function startTestDb(): Promise<TestDb> {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
  const dir = join(process.cwd(), 'drizzle/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    for (const statement of readFileSync(join(dir, file), 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) await proxy.env.DB.prepare(statement).run();
    }
  }
  return { db: drizzle(proxy.env.DB, { schema: appSchema }), dispose: () => proxy.dispose() };
}

/** Empty every table, children first. */
export async function resetDb(db: Db): Promise<void> {
  await db.batch([
    db.delete(checkins),
    db.delete(moduleProgress),
    db.delete(teamMilestones),
    db.delete(teamLinks),
    db.delete(teamMembers),
    db.delete(teams),
    db.delete(teamCodeAttempts),
    db.delete(clubCodeAttempts),
    db.delete(profiles),
    db.delete(session),
    db.delete(account),
    db.delete(user),
    db.delete(mentorInvites),
  ]);
}

/** A user as Better Auth would create it after a Google sign-in, with a session. */
export async function signUp(db: Db, id: string, email: string): Promise<void> {
  await db.insert(user).values({ id, name: `Name ${id}`, email });
  await db.insert(account).values({ id: `acct-${id}`, accountId: `g-${id}`, providerId: 'google', userId: id });
  await db.insert(session).values({
    id: `sess-${id}`,
    token: `tok-${id}`,
    userId: id,
    expiresAt: new Date(Date.now() + 86_400_000),
  });
}
