/**
 * What the admin routes answer, beyond who may open them (that's in
 * permissions.test.ts): the CSV's headers and contents, and the season
 * delete's confirmation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { addMentor, completeProfile, syncRole, type Db } from '../db/accounts';
import { addCheckin } from '../db/checkins';
import { setMentorship } from '../db/mentorship';
import { mentorInvites, teams, user } from '../db/schema';
import { createTeam } from '../db/teams';
import { resetDb, signUp, startTestDb, type TestDb } from '../db/testDb';
import { todayIn } from '../lib/milestones';
import { env } from './cloudflareWorkersStub';
import { call } from './routes';

vi.mock('astro:content', () => ({ getCollection: async () => [] }));
vi.mock('../auth', () => ({ getAuth: () => ({}) }));

const ADMINS = ['officer@example.com'];
const NOTE_TEXT = 'Secret note about the thesis';

let testDb: TestDb;
let db: Db;

beforeAll(async () => {
  testDb = await startTestDb();
  db = testDb.db;
  env.DB = testDb.d1;
  env.ADMIN_EMAILS = ADMINS.join(',');
}, 60_000);

afterAll(async () => {
  await testDb?.dispose();
});

async function person(id: string, email: string) {
  await signUp(db, id, email);
  await syncRole(db, id, ADMINS);
  await completeProfile(db, id, { name: `Person ${id}`, grade: 11, codeOk: true });
}

beforeEach(async () => {
  await resetDb(db);
  await addMentor(db, 'mentor@example.com');
  await person('admin', 'officer@example.com');
  await person('mentor', 'mentor@example.com');
  await person('s1', 'student@example.com');
  const team = await createTeam(db, 's1', '=HYPERLINK("x")');
  if (!team.ok) throw new Error('team');
  await setMentorship(db, team.teamId, 'mentored', 'mentor');
  await addCheckin(db, team.teamId, 'mentor', { metOn: '2026-11-01', covered: NOTE_TEXT, nextStep: NOTE_TEXT, status: 'stuck' });
});

describe('/admin/teams.csv', () => {
  it('downloads a dated, uncached CSV', async () => {
    const res = await call(db, '/admin/teams.csv', { userId: 'admin' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toBe(`attachment; filename="ghic-teams-${todayIn()}.csv"`);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('has the team, members, mentor and last check-in, but no emails or note text', async () => {
    const text = await (await call(db, '/admin/teams.csv', { userId: 'admin' })).text();
    const lines = text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Team,Members \(grade\),Company,Ticker,/);
    expect(lines[1]).toContain('Person s1 (11)');
    expect(lines[1]).toContain('Person mentor');
    expect(lines[1]).toContain('2026-11-01,Stuck');
    // The formula-looking team name is made safe.
    expect(lines[1].startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
    expect(text).not.toContain('@');
    expect(text).not.toContain(NOTE_TEXT);
  });
});

describe('/admin/season', () => {
  const post = (confirm: string) => call(db, '/admin/season', { userId: 'admin', method: 'POST', form: { confirm } });

  it('shows the counts, the CSV link above the button, and a labelled confirm box', async () => {
    const html = await (await call(db, '/admin/season', { userId: 'admin' })).text();
    expect(html).toContain('1 member account');
    expect(html).toContain('1 team');
    expect(html).toContain('1 member, 0 file links, 0 ticked milestones and 1 check-in');
    expect(html).toContain('1 admin account');
    expect(html).toContain('1 mentor account');
    expect(html.indexOf('Download a copy first')).toBeGreaterThan(-1);
    expect(html.indexOf('Download a copy first')).toBeLessThan(html.indexOf('type="submit"'));
    expect(html).toMatch(/<label for="confirm"/);
    expect(html).toMatch(/<input[^>]*id="confirm"/);
  });

  it('deletes nothing and explains when the phrase is wrong', async () => {
    const res = await post('delete season');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Nothing was deleted');
    expect(await db.select().from(teams)).toHaveLength(1);
    expect(await db.select().from(user)).toHaveLength(3);
  });

  it('deletes the season with the exact phrase and says what went', async () => {
    const res = await post('DELETE SEASON');
    expect(res.status).toBe(303);
    const location = res.headers.get('Location')!;
    expect(location).toBe('/admin/season?status=deleted&accounts=1&teams=1');
    expect(await db.select().from(teams)).toEqual([]);
    expect((await db.select().from(user)).map((u) => u.id).sort()).toEqual(['admin', 'mentor']);
    expect(await db.select().from(mentorInvites)).toHaveLength(1);

    const after = await (await call(db, '/admin/season', { userId: 'admin', path: location })).text();
    expect(after).toContain('Season deleted: 1 member account and 1 team.');
    expect(after).toContain('There are no member accounts or teams to delete.');
  });
});
