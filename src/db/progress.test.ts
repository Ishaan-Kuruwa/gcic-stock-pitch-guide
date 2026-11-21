/**
 * Module progress queries and /api/progress, against a real local D1 (see testDb.ts).
 */
import type { User } from 'better-auth';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GuardLocals } from '../lib/guards';
import { handleProgressRequest, parseProgressBody } from '../lib/progressApi';
import { completeProfile, deleteAccount, getProfile, syncRole, type Db } from './accounts';
import { addModuleProgress, countModuleProgress, getModuleProgress, setModuleDone } from './progress';
import { moduleProgress } from './schema';
import { resetDb, signUp, startTestDb, type TestDb } from './testDb';

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

const catalog = [
  { slug: 'start-here', number: 0 },
  { slug: 'pick-your-company', number: 1 },
  { slug: 'value-the-company', number: 5 },
];
const slugs = catalog.map((c) => c.slug);
const ORIGIN = 'https://guide.example';

async function member(id: string, finished = true) {
  await signUp(db, id, `${id}@gmail.com`);
  await syncRole(db, id, []);
  if (finished) await completeProfile(db, id, { name: `Student ${id}`, grade: 10, codeOk: true });
}

async function localsFor(id: string | null): Promise<GuardLocals> {
  if (!id) return { user: null, profile: null };
  return { user: { id, email: `${id}@gmail.com`, name: id } as User, profile: await getProfile(db, id) };
}

function get() {
  return new Request(`${ORIGIN}/api/progress`);
}

function post(
  body: unknown,
  { origin = ORIGIN, type = 'application/json' }: { origin?: string | null; type?: string } = {},
) {
  const headers: Record<string, string> = { 'Content-Type': type };
  if (origin) headers.Origin = origin;
  return new Request(`${ORIGIN}/api/progress`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function call(request: Request, id: string | null) {
  const res = await handleProgressRequest(request, await localsFor(id), { db, catalog });
  return { res, body: (await res.json()) as Record<string, unknown> };
}

describe('progress queries', () => {
  it('ticks, unticks and merges without duplicates', async () => {
    await member('u1');
    await setModuleDone(db, 'u1', 'start-here', true);
    await setModuleDone(db, 'u1', 'start-here', true);
    await addModuleProgress(db, 'u1', ['start-here', 'pick-your-company']);
    expect((await getModuleProgress(db, 'u1')).sort()).toEqual(['pick-your-company', 'start-here']);
    await setModuleDone(db, 'u1', 'start-here', false);
    expect(await getModuleProgress(db, 'u1')).toEqual(['pick-your-company']);
  });

  it('keeps the first done time', async () => {
    await member('u1');
    await setModuleDone(db, 'u1', 'start-here', true, new Date('2026-12-01T00:00:00Z'));
    await addModuleProgress(db, 'u1', ['start-here'], new Date('2026-12-05T00:00:00Z'));
    const row = await db.select().from(moduleProgress).where(eq(moduleProgress.userId, 'u1')).get();
    expect(row?.completedAt.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('counts per member, ignoring modules that no longer exist', async () => {
    await member('u1');
    await member('u2');
    await addModuleProgress(db, 'u1', ['start-here', 'pick-your-company', 'old-module']);
    const counts = await countModuleProgress(db, ['u1', 'u2'], slugs);
    expect(counts).toEqual(
      new Map([
        ['u1', 2],
        ['u2', 0],
      ]),
    );
  });

  it('is deleted with the account', async () => {
    await member('u1');
    await member('u2');
    await addModuleProgress(db, 'u1', ['start-here']);
    await addModuleProgress(db, 'u2', ['start-here']);
    await deleteAccount(db, 'u1');
    expect(await db.select().from(moduleProgress).where(eq(moduleProgress.userId, 'u1'))).toEqual([]);
    expect(await getModuleProgress(db, 'u2')).toEqual(['start-here']);
  });
});

describe('parseProgressBody', () => {
  it('accepts a tick and a merge, deduping the merge', () => {
    expect(parseProgressBody({ slug: 'start-here', done: false }, slugs)).toEqual({
      kind: 'set',
      slug: 'start-here',
      done: false,
    });
    expect(parseProgressBody({ merge: ['start-here', 'start-here'] }, slugs)).toEqual({
      kind: 'merge',
      slugs: ['start-here'],
    });
  });

  it.each([
    ['an unknown slug', { slug: 'made-up', done: true }],
    ['a missing done', { slug: 'start-here' }],
    ['a string done', { slug: 'start-here', done: 'true' }],
    ['an unknown merge slug', { merge: ['start-here', 'made-up'] }],
    ['a merge that is not a list', { merge: 'start-here' }],
    ['a merge longer than the catalog', { merge: [...slugs, ...slugs] }],
    ['a list', ['start-here']],
    ['null', null],
  ])('refuses %s', (_name, body) => {
    expect(parseProgressBody(body, slugs).kind).toBe('invalid');
  });
});

describe('/api/progress', () => {
  it('GET returns the progress and catalog, never cached', async () => {
    await member('u1');
    await addModuleProgress(db, 'u1', ['pick-your-company', 'old-module']);
    const { res, body } = await call(get(), 'u1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body).toEqual({ userId: 'u1', done: ['pick-your-company'], modules: catalog });
  });

  it('POST ticks, unticks and merges', async () => {
    await member('u1');
    let { res, body } = await call(post({ slug: 'start-here', done: true }), 'u1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body.done).toEqual(['start-here']);
    ({ body } = await call(post({ merge: ['value-the-company'] }), 'u1'));
    expect((body.done as string[]).sort()).toEqual(['start-here', 'value-the-company']);
    ({ body } = await call(post({ slug: 'start-here', done: false }), 'u1'));
    expect(body.done).toEqual(['value-the-company']);
  });

  it('refuses a bad slug or bad JSON with 400 and saves nothing', async () => {
    await member('u1');
    expect((await call(post({ slug: 'made-up', done: true }), 'u1')).res.status).toBe(400);
    expect((await call(post({ merge: ['made-up'] }), 'u1')).res.status).toBe(400);
    expect((await call(post('{not json'), 'u1')).res.status).toBe(400);
    expect(await getModuleProgress(db, 'u1')).toEqual([]);
  });

  it('refuses a POST from another site or with no Origin', async () => {
    await member('u1');
    const other = await call(post({ slug: 'start-here', done: true }, { origin: 'https://evil.example' }), 'u1');
    expect(other.res.status).toBe(403);
    expect(other.res.headers.get('Cache-Control')).toBe('private, no-store');
    expect((await call(post({ slug: 'start-here', done: true }, { origin: null }), 'u1')).res.status).toBe(403);
    expect(await getModuleProgress(db, 'u1')).toEqual([]);
  });

  it('refuses form posts and oversized bodies', async () => {
    await member('u1');
    const form = post('slug=start-here&done=true', { type: 'application/x-www-form-urlencoded' });
    expect((await call(form, 'u1')).res.status).toBe(415);
    expect((await call(post(`{"merge":[${'"x",'.repeat(2000)}"x"]}`), 'u1')).res.status).toBe(413);
  });

  it('answers 401 when signed out and 403 before /join is finished', async () => {
    const out = await call(get(), null);
    expect(out.res.status).toBe(401);
    expect(out.body).toEqual({ error: 'signin' });
    expect(out.res.headers.get('Cache-Control')).toBe('private, no-store');
    expect((await call(post({ slug: 'start-here', done: true }), null)).res.status).toBe(401);
    await member('u2', false);
    expect((await call(get(), 'u2')).res.status).toBe(403);
  });

  it('answers 405 to other methods', async () => {
    await member('u1');
    const res = (
      await call(new Request(`${ORIGIN}/api/progress`, { method: 'DELETE', headers: { Origin: ORIGIN } }), 'u1')
    ).res;
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET, POST');
  });
});
