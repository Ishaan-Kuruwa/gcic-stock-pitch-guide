/**
 * Team milestones against a real local D1 (see testDb.ts).
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { planMilestoneSave, visibleMilestones } from '../lib/milestones';
import { completeProfile, deleteAccount, syncRole, type Db } from './accounts';
import { getTeamMilestones, saveTeamMilestones } from './milestones';
import { teamMilestones, teams } from './schema';
import { createTeam, getTeam, joinTeam, leaveTeam } from './teams';
import { resetDb, signUp, startTestDb, type TestDb } from './testDb';
import type { MentorshipStatus } from './schema';

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

async function member(id: string) {
  await signUp(db, id, `${id}@gmail.com`);
  await syncRole(db, id, []);
  await completeProfile(db, id, { name: `Student ${id}`, grade: 10, codeOk: true });
}

async function pair() {
  await member('u1');
  await member('u2');
  const created = await createTeam(db, 'u1', 'Bulls');
  if (!created.ok) throw new Error('createTeam failed');
  const code = (await getTeam(db, created.teamId))!.team.joinCode;
  await joinTeam(db, 'u2', code, 2);
  return created.teamId;
}

/** What the team page shows: each visible milestone and whether it's done. */
async function drawPage(teamId: string, status: MentorshipStatus = 'self-guided') {
  const done = await getTeamMilestones(db, teamId);
  return new Map(visibleMilestones(status).map((m) => [m.key, done.has(m.key)]));
}

/** Submit the team page form: `checked` boxes, with `shown` from when the page was drawn. */
async function save(
  teamId: string,
  userId: string,
  shown: Map<string, boolean>,
  checked: string[],
  status: MentorshipStatus = 'self-guided',
  now = new Date(),
) {
  const current = new Set((await getTeamMilestones(db, teamId)).keys());
  await saveTeamMilestones(db, teamId, userId, planMilestoneSave(current, shown, checked, status, { member: true, mentor: false }), now);
}

const keys = async (teamId: string) => [...(await getTeamMilestones(db, teamId)).keys()].sort();

describe('saving milestones', () => {
  it('ticks and unticks, recording who and when', async () => {
    const teamId = await pair();
    await save(
      teamId,
      'u1',
      await drawPage(teamId),
      ['company-picked', 'yis-registered'],
      'self-guided',
      new Date('2026-12-10T15:00:00Z'),
    );
    expect(await keys(teamId)).toEqual(['company-picked', 'yis-registered']);
    const row = await db.select().from(teamMilestones).where(eq(teamMilestones.key, 'company-picked')).get();
    expect(row).toMatchObject({ teamId, doneBy: 'u1' });
    expect(row?.doneAt.toISOString()).toBe('2026-12-10T15:00:00.000Z');

    await save(teamId, 'u2', await drawPage(teamId), ['company-picked']);
    expect(await keys(teamId)).toEqual(['company-picked']);
  });

  it('keeps the first done date when saved again', async () => {
    const teamId = await pair();
    await save(teamId, 'u1', await drawPage(teamId), ['comps'], 'self-guided', new Date('2027-01-05T15:00:00Z'));
    await save(
      teamId,
      'u2',
      await drawPage(teamId),
      ['comps', 'slides'],
      'self-guided',
      new Date('2027-01-09T15:00:00Z'),
    );
    const done = await getTeamMilestones(db, teamId);
    expect(done.get('comps')?.toISOString()).toBe('2027-01-05T15:00:00.000Z');
  });

  it("keeps a teammate's tick made after my page loaded", async () => {
    const teamId = await pair();
    const myPage = await drawPage(teamId);
    // My teammate ticks "financials" after my page was drawn.
    await save(teamId, 'u2', await drawPage(teamId), ['financials']);
    // I save, having ticked only "company-picked".
    await save(teamId, 'u1', myPage, ['company-picked']);
    expect(await keys(teamId)).toEqual(['company-picked', 'financials']);
  });

  it("doesn't let a member tick the mentor review, even on a mentored team", async () => {
    const teamId = await pair();
    await db.update(teams).set({ mentorshipStatus: 'mentored' }).where(eq(teams.id, teamId));
    await save(teamId, 'u1', await drawPage(teamId, 'mentored'), ['mentor-review', 'slides'], 'mentored');
    expect(await keys(teamId)).toEqual(['slides']);
    // Not shown to a self-guided team, so a forged field is ignored too.
    await save(teamId, 'u1', new Map([['mentor-review', false]]), ['mentor-review']);
    expect(await keys(teamId)).toEqual(['slides']);
  });
});

describe('cleanup', () => {
  it('deleting an account keeps the team and its milestones, without their name', async () => {
    const teamId = await pair();
    await save(teamId, 'u1', await drawPage(teamId), ['company-picked']);
    await deleteAccount(db, 'u1');
    const row = await db.select().from(teamMilestones).where(eq(teamMilestones.teamId, teamId)).get();
    expect(row).toMatchObject({ key: 'company-picked', doneBy: null });
  });

  it('the last member leaving deletes the milestones', async () => {
    const teamId = await pair();
    await save(teamId, 'u1', await drawPage(teamId), ['company-picked']);
    expect(await leaveTeam(db, 'u1')).toBe('left');
    expect(await keys(teamId)).toEqual(['company-picked']);
    expect(await leaveTeam(db, 'u2')).toBe('team-deleted');
    expect(await db.select().from(teamMilestones)).toEqual([]);
  });

  it('the last member deleting their account deletes the milestones', async () => {
    await member('solo');
    const created = await createTeam(db, 'solo', 'Solo');
    if (!created.ok) throw new Error('createTeam failed');
    await save(created.teamId, 'solo', await drawPage(created.teamId), ['comps']);
    await deleteAccount(db, 'solo');
    expect(await db.select().from(teamMilestones)).toEqual([]);
    expect(await db.select().from(teams)).toEqual([]);
  });
});
