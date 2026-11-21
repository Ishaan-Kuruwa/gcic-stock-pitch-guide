/**
 * End-of-season delete against a real local D1 (see testDb.ts).
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addMentor, completeProfile, recordWrongCode, syncRole, type Db } from './accounts';
import { addCheckin } from './checkins';
import { saveTeamMilestones } from './milestones';
import { setMentorship } from './mentorship';
import { addModuleProgress } from './progress';
import {
  account,
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
import { deleteSeason, seasonCounts } from './season';
import { createTeam, joinTeam, recordWrongTeamCode, setTeamLinks } from './teams';
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

const ADMINS = ['Officer@Example.com', 'pending-officer@example.com'];
const NOTE = { metOn: '2026-12-03', covered: 'Comps.', nextStep: '', status: 'on-track' as const };

async function person(id: string, email: string, grade = 10) {
  await signUp(db, id, email);
  await syncRole(db, id, ADMINS);
  await completeProfile(db, id, { name: `Person ${id}`, grade, codeOk: true });
}

/** A full season: officers, mentors, students, two teams with everything filled in. */
async function season() {
  await addMentor(db, 'mentor@example.com');
  await addMentor(db, 'pending-mentor@example.com');
  await addMentor(db, 'never-signed-in@example.com');
  await person('admin', 'officer@example.com', 12);
  await person('mentor', 'mentor@example.com', 12);
  // A mentor and an officer who signed in but never finished (or started) /join.
  await signUp(db, 'pending-mentor', 'pending-mentor@example.com');
  await signUp(db, 'pending-officer', 'Pending-Officer@example.com');
  // Students: two teams, plus one who never finished /join.
  await person('s1', 's1@example.com');
  await person('s2', 's2@example.com');
  await person('s3', 's3@example.com');
  await signUp(db, 's4', 's4@example.com');
  await syncRole(db, 's4', ADMINS);
  await recordWrongCode(db, 's4');

  const a = await createTeam(db, 's1', 'Alpha');
  const b = await createTeam(db, 's3', 'Beta');
  if (!a.ok || !b.ok) throw new Error('teams');
  const alpha = await db.select().from(teams).where(eq(teams.id, a.teamId)).get();
  await joinTeam(db, 's2', alpha!.joinCode, 2);
  await recordWrongTeamCode(db, 's3');
  await setTeamLinks(db, a.teamId, {
    report: 'https://docs.google.com/document/d/x',
    slides: null,
    financials: null,
    comps: null,
    video: null,
  });
  await saveTeamMilestones(db, a.teamId, 's1', { add: ['company-picked'], remove: [] });
  await setMentorship(db, a.teamId, 'mentored', 'mentor');
  await setMentorship(db, b.teamId, 'mentored', 'admin');
  await addCheckin(db, a.teamId, 'mentor', NOTE);
  await addCheckin(db, b.teamId, 'admin', NOTE);
  for (const id of ['s1', 'admin', 'mentor']) await addModuleProgress(db, id, ['intro']);
}

const ids = async (table: typeof user) => (await db.select({ id: table.id }).from(table)).map((r) => r.id).sort();

describe('seasonCounts', () => {
  it('counts what will be deleted and what is kept', async () => {
    await season();
    expect(await seasonCounts(db, ADMINS)).toEqual({
      menteeAccounts: 4, // s1–s4, including s4 who never finished /join
      teams: 2,
      teamMembers: 3,
      teamLinks: 1,
      milestones: 1,
      checkins: 2,
      admins: 1,
      mentors: 1,
      mentorList: 3,
    });
  });

  it('is all zeros on an empty database', async () => {
    const counts = await seasonCounts(db, []);
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });
});

describe('deleteSeason', () => {
  it('deletes every mentee account and every team, and nothing else', async () => {
    await season();
    const before = await deleteSeason(db, ADMINS);
    expect(before.menteeAccounts).toBe(4);

    // Kept: officers (including the one assigned as a mentor) and mentors, finished or not, with their sessions, Google links and progress.
    const kept = ['admin', 'mentor', 'pending-mentor', 'pending-officer'];
    expect(await ids(user)).toEqual(kept.sort());
    expect((await db.select().from(session)).map((s) => s.userId).sort()).toEqual(kept.sort());
    expect((await db.select().from(account)).map((s) => s.userId).sort()).toEqual(kept.sort());
    expect((await db.select().from(profiles)).map((p) => [p.userId, p.role]).sort()).toEqual([
      ['admin', 'admin'],
      ['mentor', 'mentor'],
    ]);
    expect((await db.select().from(moduleProgress)).map((p) => p.userId).sort()).toEqual(['admin', 'mentor']);
    // The mentor list stays as it was.
    expect((await db.select().from(mentorInvites)).map((m) => m.email).sort()).toEqual([
      'mentor@example.com',
      'never-signed-in@example.com',
      'pending-mentor@example.com',
    ]);

    // Gone: every team and everything on it, and the students' code tries.
    for (const table of [teams, teamMembers, teamLinks, teamMilestones, checkins, teamCodeAttempts, clubCodeAttempts]) {
      expect(await db.select().from(table)).toEqual([]);
    }
  });

  it('can run twice (the second time deletes nothing)', async () => {
    await season();
    await deleteSeason(db, ADMINS);
    const again = await deleteSeason(db, ADMINS);
    expect(again.menteeAccounts).toBe(0);
    expect(again.teams).toBe(0);
    expect(await ids(user)).toHaveLength(4);
  });

  it('with no ADMIN_EMAILS keeps admins by their role, and mentors by the list', async () => {
    await season();
    await deleteSeason(db, []);
    expect(await ids(user)).toEqual(['admin', 'mentor', 'pending-mentor']);
  });
});
