/**
 * Runs the account queries against a real local D1 database (see testDb.ts).
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  addMentor,
  completeProfile,
  deleteAccount,
  getProfile,
  listMentors,
  recentWrongCodes,
  recordWrongCode,
  removeMentor,
  syncRole,
  type Db,
} from './accounts';
import { account, clubCodeAttempts, mentorInvites, profiles, session, user } from './schema';
import { resetDb, signUp as signUpIn, startTestDb, type TestDb } from './testDb';

let testDb: TestDb;
let db: Db;

beforeAll(async () => {
  testDb = await startTestDb();
  db = testDb.db;
}, 60_000);

afterAll(async () => {
  await testDb?.dispose();
});

beforeEach(async () => {
  await resetDb(db);
});

const signUp = (id: string, email: string) => signUpIn(db, id, email);

const ADMINS = ['officer@example.com'];

describe('syncRole (every sign-in)', () => {
  it('creates a mentee profile on the first sign-in', async () => {
    await signUp('u1', 'student@gmail.com');
    expect(await syncRole(db, 'u1', ADMINS)).toBe('mentee');
    const p = await getProfile(db, 'u1');
    expect(p).toMatchObject({ role: 'mentee', name: null, grade: null, clubCodeAt: null });
  });

  it('gives admin by ADMIN_EMAILS and mentor by the mentor list, ignoring case', async () => {
    await signUp('a', 'Officer@Example.com');
    await signUp('m', 'mentor@example.com');
    await db.insert(mentorInvites).values({ email: 'mentor@example.com' });
    expect(await syncRole(db, 'a', ADMINS)).toBe('admin');
    expect(await syncRole(db, 'm', ADMINS)).toBe('mentor');
  });

  it('re-checks on the next sign-in and keeps the rest of the profile', async () => {
    await signUp('m', 'mentor@example.com');
    await db.insert(mentorInvites).values({ email: 'mentor@example.com' });
    await syncRole(db, 'm', ADMINS);
    await completeProfile(db, 'm', { name: 'Grace', grade: 12, codeOk: false });

    await db.delete(mentorInvites);
    expect(await syncRole(db, 'm', ADMINS)).toBe('mentee');
    expect(await getProfile(db, 'm')).toMatchObject({ role: 'mentee', name: 'Grace', grade: 12, clubCodeAt: null });

    expect(await syncRole(db, 'm', ['mentor@example.com'])).toBe('admin');
    expect(await syncRole(db, 'm', [])).toBe('mentee');
  });

  it('returns null for a user that does not exist', async () => {
    expect(await syncRole(db, 'nobody', ADMINS)).toBeNull();
    expect(await getProfile(db, 'nobody')).toBeNull();
  });
});

describe('completeProfile', () => {
  it('saves name, grade and when the club code was entered', async () => {
    await signUp('u1', 'student@gmail.com');
    await syncRole(db, 'u1', ADMINS);
    const at = new Date('2026-12-01T12:00:00Z');
    await completeProfile(db, 'u1', { name: 'Ada', grade: 9, codeOk: true }, at);
    expect(await getProfile(db, 'u1')).toMatchObject({ name: 'Ada', grade: 9, clubCodeAt: at });
  });

  it('the database refuses grades outside 9 to 12', async () => {
    await signUp('u1', 'student@gmail.com');
    await expect(completeProfile(db, 'u1', { name: 'Ada', grade: 13, codeOk: true })).rejects.toThrow();
  });
});

describe('wrong club codes', () => {
  it('counts only this user’s tries from the last hour', async () => {
    await signUp('u1', 'one@gmail.com');
    await signUp('u2', 'two@gmail.com');
    const now = new Date('2026-12-01T12:00:00Z');
    const ago = (m: number) => new Date(now.getTime() - m * 60_000);
    await recordWrongCode(db, 'u1', ago(90));
    await recordWrongCode(db, 'u1', ago(30));
    await recordWrongCode(db, 'u1', ago(5));
    await recordWrongCode(db, 'u2', ago(5));
    const tries = await recentWrongCodes(db, 'u1', now);
    expect(tries.map((t) => t.getTime()).sort()).toEqual([ago(30).getTime(), ago(5).getTime()]);
  });
});

describe('mentor list', () => {
  it('adds (lowercased, no duplicates) and promotes an existing mentee right away', async () => {
    await signUp('u1', 'grace@example.com');
    await syncRole(db, 'u1', ADMINS);
    await addMentor(db, ' Grace@Example.com ');
    await addMentor(db, 'grace@example.com');
    expect((await listMentors(db)).map((m) => m.email)).toEqual(['grace@example.com']);
    expect((await getProfile(db, 'u1'))?.role).toBe('mentor');
  });

  it('removes and demotes a mentor right away, but never an admin', async () => {
    await signUp('m', 'grace@example.com');
    await signUp('a', 'officer@example.com');
    await addMentor(db, 'grace@example.com');
    await addMentor(db, 'officer@example.com');
    await syncRole(db, 'm', ADMINS);
    await syncRole(db, 'a', ADMINS);

    await removeMentor(db, 'GRACE@example.com');
    await removeMentor(db, 'officer@example.com');
    expect(await listMentors(db)).toEqual([]);
    expect((await getProfile(db, 'm'))?.role).toBe('mentee');
    expect((await getProfile(db, 'a'))?.role).toBe('admin');
  });
});

describe('deleteAccount', () => {
  it('removes the user, profile, sessions, accounts and code tries, and nobody else’s', async () => {
    await signUp('u1', 'one@gmail.com');
    await signUp('u2', 'two@gmail.com');
    for (const id of ['u1', 'u2']) {
      await syncRole(db, id, ADMINS);
      await completeProfile(db, id, { name: id, grade: 10, codeOk: true });
      await recordWrongCode(db, id);
    }
    await db.insert(session).values({ id: 'sess-u1-b', token: 'tok-u1-b', userId: 'u1', expiresAt: new Date() });

    await deleteAccount(db, 'u1');

    const count = async (rows: Promise<unknown[]>) => (await rows).length;
    expect(await count(db.select().from(user).where(eq(user.id, 'u1')))).toBe(0);
    expect(await count(db.select().from(profiles).where(eq(profiles.userId, 'u1')))).toBe(0);
    expect(await count(db.select().from(session).where(eq(session.userId, 'u1')))).toBe(0);
    expect(await count(db.select().from(account).where(eq(account.userId, 'u1')))).toBe(0);
    expect(await count(db.select().from(clubCodeAttempts).where(eq(clubCodeAttempts.userId, 'u1')))).toBe(0);

    expect(await count(db.select().from(user))).toBe(1);
    expect(await count(db.select().from(profiles))).toBe(1);
    expect(await count(db.select().from(session))).toBe(1);
    expect(await count(db.select().from(account))).toBe(1);
    expect(await count(db.select().from(clubCodeAttempts))).toBe(1);
  });
});
