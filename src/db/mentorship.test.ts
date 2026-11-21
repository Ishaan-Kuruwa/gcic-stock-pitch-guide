/**
 * Mentorship and check-ins against a real local D1 (see testDb.ts).
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { allowedTeamActions, teamCapabilities, teamViewAccess } from '../lib/guards';
import { overviewRows } from '../lib/mentorship';
import { addMentor, completeProfile, deleteAccount, getProfile, removeMentor, syncRole, type Db } from './accounts';
import { addCheckin, listCheckins, updateCheckin } from './checkins';
import { getTeamsOverview, listAssignableMentors, setMentorship } from './mentorship';
import { checkins, teams } from './schema';
import { createTeam, getTeam, leaveTeam } from './teams';
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

const ADMINS = ['officer@example.com'];
const NOTE = { metOn: '2026-12-03', covered: 'Went over the comps.', nextStep: 'Draft the thesis.', status: 'on-track' as const };

async function person(id: string, email: string, admins = ADMINS) {
  await signUp(db, id, email);
  await syncRole(db, id, admins);
  await completeProfile(db, id, { name: `Person ${id}`, grade: 12, codeOk: true });
}

/** A student, a mentor and an admin, and the student's team. */
async function setup() {
  await person('s1', 's1@gmail.com');
  await addMentor(db, 'mentor@gmail.com');
  await person('m1', 'mentor@gmail.com');
  await person('a1', 'officer@example.com');
  const created = await createTeam(db, 's1', 'Bulls');
  if (!created.ok) throw new Error('createTeam failed');
  return created.teamId;
}

async function accessOf(userId: string, teamId: string) {
  const view = (await getTeam(db, teamId))!;
  const profile = (await getProfile(db, userId))!;
  return teamViewAccess(profile, view.members.map((m) => m.userId), view.team.mentorId);
}

async function capsOf(userId: string, teamId: string) {
  const view = (await getTeam(db, teamId))!;
  const profile = (await getProfile(db, userId))!;
  return teamCapabilities(profile, view.members.map((m) => m.userId), view.team.mentorId);
}

describe('assigning a mentor', () => {
  it('lists mentors and admins who finished sign-up', async () => {
    await setup();
    expect((await listAssignableMentors(db)).map((m) => m.userId).sort()).toEqual(['a1', 'm1']);
  });

  it('gives the assigned mentor access; a mentor of another team gets 404', async () => {
    const teamId = await setup();
    await addMentor(db, 'other@gmail.com');
    await person('m2', 'other@gmail.com');
    expect(await accessOf('m1', teamId)).toBe('notfound');
    await setMentorship(db, teamId, 'mentored', 'm1');
    expect(await accessOf('m1', teamId)).toBe('ok');
    expect(await accessOf('m2', teamId)).toBe('notfound');
  });

  it('removing the mentor on /admin/mentors takes away access and shows "Needs a mentor"', async () => {
    const teamId = await setup();
    await setMentorship(db, teamId, 'mentored', 'm1');
    await addCheckin(db, teamId, 'm1', NOTE);
    await removeMentor(db, 'mentor@gmail.com');
    const view = (await getTeam(db, teamId))!;
    expect(view.team).toMatchObject({ mentorshipStatus: 'mentored', mentorId: null });
    expect(await accessOf('m1', teamId)).toBe('notfound');
    const [row] = overviewRows(await getTeamsOverview(db), '2026-12-05');
    expect(row).toMatchObject({ mentor: null, flagText: 'Needs a mentor' });
    // The notes stay with the team.
    expect(await listCheckins(db, teamId)).toHaveLength(1);
  });

  it('an admin assigned as mentor keeps the team when the admin list changes back', async () => {
    const teamId = await setup();
    await setMentorship(db, teamId, 'mentored', 'a1');
    expect(await accessOf('a1', teamId)).toBe('ok');
    // Signing in again as an admin keeps the assignment...
    await syncRole(db, 'a1', ADMINS);
    expect((await getTeam(db, teamId))!.team.mentorId).toBe('a1');
    // ...but taken off ADMIN_EMAILS they're a member, and stop mentoring.
    await syncRole(db, 'a1', []);
    expect((await getTeam(db, teamId))!.team.mentorId).toBeNull();
  });

  it('changing the mentor keeps past check-ins, and only the writer can edit them', async () => {
    const teamId = await setup();
    await addMentor(db, 'other@gmail.com');
    await person('m2', 'other@gmail.com');
    await setMentorship(db, teamId, 'mentored', 'm1');
    const id = await addCheckin(db, teamId, 'm1', NOTE);
    await setMentorship(db, teamId, 'mentored', 'm2');
    const [kept] = await listCheckins(db, teamId);
    expect(kept).toMatchObject({ id, mentorId: 'm1', mentorName: 'Person m1', covered: NOTE.covered });
    expect(await accessOf('m1', teamId)).toBe('notfound');
    // The new mentor (and an admin) can't edit the old mentor's notes.
    expect(await updateCheckin(db, id, teamId, 'm2', { ...NOTE, covered: 'Changed' })).toBe(false);
    expect(await updateCheckin(db, id, teamId, 'a1', { ...NOTE, covered: 'Changed' })).toBe(false);
    expect((await listCheckins(db, teamId))[0]!.covered).toBe(NOTE.covered);
  });
});

describe('what each person can do on the team page', () => {
  it("mentors can't change details, links or regular milestones; members can't log check-ins", async () => {
    const teamId = await setup();
    await setMentorship(db, teamId, 'mentored', 'm1');
    const mentor = allowedTeamActions(await capsOf('m1', teamId));
    for (const action of ['details', 'links', 'new-code', 'mentorship'] as const) expect(mentor.has(action)).toBe(false);
    expect(mentor.has('checkin-add')).toBe(true);
    const member = allowedTeamActions(await capsOf('s1', teamId));
    expect(member.has('checkin-add')).toBe(false);
    expect(member.has('mentorship')).toBe(false);
    expect(allowedTeamActions(await capsOf('a1', teamId))).toEqual(new Set(['mentorship']));
  });

  it('an admin assigned as mentor can log and edit their own check-ins', async () => {
    const teamId = await setup();
    await setMentorship(db, teamId, 'mentored', 'a1');
    const actions = allowedTeamActions(await capsOf('a1', teamId));
    expect([...actions].sort()).toEqual(['checkin-add', 'checkin-edit', 'mentorship', 'milestones']);
    const id = await addCheckin(db, teamId, 'a1', NOTE);
    expect(await updateCheckin(db, id, teamId, 'a1', { ...NOTE, status: 'behind' }, new Date('2026-12-04T15:00:00Z'))).toBe(true);
    expect((await listCheckins(db, teamId))[0]!.status).toBe('behind');
  });
});

describe('check-ins', () => {
  it('lists newest meeting first and defaults the day to today in New York', async () => {
    const teamId = await setup();
    await setMentorship(db, teamId, 'mentored', 'm1');
    await addCheckin(db, teamId, 'm1', { ...NOTE, metOn: '2026-11-20' });
    await addCheckin(db, teamId, 'm1', { ...NOTE, metOn: '' }, new Date('2026-12-06T03:00:00Z'));
    await addCheckin(db, teamId, 'm1', { ...NOTE, metOn: '2026-12-01' });
    expect((await listCheckins(db, teamId)).map((c) => c.metOn)).toEqual(['2026-12-05', '2026-12-01', '2026-11-20']);
  });

  it('the database refuses notes over the length limits and bad statuses', async () => {
    const teamId = await setup();
    await expect(addCheckin(db, teamId, 'm1', { ...NOTE, covered: 'a'.repeat(1001) })).rejects.toThrow();
    await expect(addCheckin(db, teamId, 'm1', { ...NOTE, nextStep: 'b'.repeat(501) })).rejects.toThrow();
    await expect(addCheckin(db, teamId, 'm1', { ...NOTE, status: 'great' as 'stuck' })).rejects.toThrow();
    await expect(addCheckin(db, teamId, 'm1', { ...NOTE, covered: 'a'.repeat(1000), nextStep: 'b'.repeat(500) })).resolves.toBeTypeOf('string');
  });

  it('deleting a team deletes its check-ins', async () => {
    const teamId = await setup();
    await setMentorship(db, teamId, 'mentored', 'm1');
    await addCheckin(db, teamId, 'm1', NOTE);
    expect(await leaveTeam(db, 's1')).toBe('team-deleted');
    expect(await db.select().from(teams)).toEqual([]);
    expect(await db.select().from(checkins)).toEqual([]);
  });

  it("deleting a mentor's account keeps their check-ins without the name", async () => {
    const teamId = await setup();
    await setMentorship(db, teamId, 'mentored', 'm1');
    await addCheckin(db, teamId, 'm1', NOTE);
    await deleteAccount(db, 'm1');
    const [note] = await listCheckins(db, teamId);
    expect(note).toMatchObject({ mentorId: null, mentorName: null, covered: NOTE.covered });
    expect((await db.select().from(teams).where(eq(teams.id, teamId)).get())!.mentorId).toBeNull();
  });
});

describe('getTeamsOverview', () => {
  it("reads each team's latest check-in, members and milestones; a mentor sees only their teams", async () => {
    const teamId = await setup();
    await person('s2', 's2@gmail.com');
    const other = await createTeam(db, 's2', 'Bears');
    if (!other.ok) throw new Error('createTeam failed');
    await setMentorship(db, teamId, 'mentored', 'm1');
    await addCheckin(db, teamId, 'm1', { ...NOTE, metOn: '2026-11-01', status: 'stuck' });
    await addCheckin(db, teamId, 'm1', { ...NOTE, metOn: '2026-11-15', status: 'behind' });

    const all = await getTeamsOverview(db);
    expect(all.map((t) => t.name).sort()).toEqual(['Bears', 'Bulls']);
    const bulls = all.find((t) => t.id === teamId)!;
    expect(bulls).toMatchObject({
      mentorName: 'Person m1',
      members: [{ name: 'Person s1', grade: 12 }],
      lastCheckin: { metOn: '2026-11-15', status: 'behind' },
    });

    const mine = await getTeamsOverview(db, { mentorId: 'm1' });
    expect(mine.map((t) => t.name)).toEqual(['Bulls']);
    expect(await getTeamsOverview(db, { mentorId: 'a1' })).toEqual([]);
    // Nov 15 to Dec 1 is 16 days: flagged.
    expect(overviewRows(mine, '2026-12-01')[0]!.flagText).toBe('No check-in in 14+ days');
  });
});
