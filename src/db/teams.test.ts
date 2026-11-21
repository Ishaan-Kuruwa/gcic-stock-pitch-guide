/**
 * Runs the team queries against a real local D1 database (see testDb.ts).
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { limits } from '../data/competition';
import { isLockedOut, triesLeft } from '../lib/clubCode';
import { teamViewAccess } from '../lib/guards';
import { MAX_JOIN_TRIES } from '../lib/teams';
import { completeProfile, deleteAccount, syncRole, type Db } from './accounts';
import { teamCodeAttempts, teamLinks, teamMembers, teams, user } from './schema';
import {
  createTeam,
  getTeam,
  getTeamIdForUser,
  joinTeam,
  leaveTeam,
  recentWrongTeamCodes,
  recordWrongTeamCode,
  regenerateJoinCode,
  setTeamLinks,
  updateTeamDetails,
} from './teams';
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
const MAX = limits.maxTeamSize;

/** A signed-up member with a finished profile. */
async function member(id: string, email = `${id}@gmail.com`) {
  await signUp(db, id, email);
  await syncRole(db, id, ADMINS);
  await completeProfile(db, id, { name: `Student ${id}`, grade: 10, codeOk: true });
}

async function newTeam(userId: string, name = 'Team') {
  const result = await createTeam(db, userId, name);
  if (!result.ok) throw new Error('createTeam failed');
  return result.teamId;
}

async function joinCodeOf(teamId: string) {
  return (await getTeam(db, teamId))!.team.joinCode;
}

const allLinks = {
  report: 'https://docs.google.com/document/d/r',
  slides: 'https://docs.google.com/presentation/d/s',
  financials: null,
  comps: null,
  video: 'https://youtu.be/v',
};

describe('createTeam', () => {
  it('makes a self-guided team and adds the creator', async () => {
    await member('u1');
    const teamId = await newTeam('u1', 'Bulls');
    const view = await getTeam(db, teamId);
    expect(view?.team).toMatchObject({ name: 'Bulls', mentorshipStatus: 'self-guided', mentorId: null });
    expect(view?.team.joinCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(view?.members).toEqual([{ userId: 'u1', name: 'Student u1', grade: 10 }]);
    expect(await getTeamIdForUser(db, 'u1')).toBe(teamId);
  });
});

describe('one team per student', () => {
  it('refuses creating or joining a second team', async () => {
    await member('u1');
    await member('u2');
    const first = await newTeam('u1');
    const second = await newTeam('u2');
    expect(await createTeam(db, 'u1', 'Again')).toEqual({ ok: false, reason: 'already-on-team' });
    expect(await joinTeam(db, 'u1', await joinCodeOf(second), MAX)).toEqual({ ok: false, reason: 'already-on-team' });
    expect(await getTeamIdForUser(db, 'u1')).toBe(first);
  });

  it('the database refuses a second membership row', async () => {
    await member('u1');
    await newTeam('u1');
    const teamB = crypto.randomUUID();
    await db.insert(teams).values({ id: teamB, name: 'B', joinCode: 'ZZZZZZ' });
    await expect(db.insert(teamMembers).values({ teamId: teamB, userId: 'u1' })).rejects.toThrow();
  });
});

describe('joinTeam', () => {
  it('joins with the code in any case, with spaces', async () => {
    await member('u1');
    await member('u2');
    const teamId = await newTeam('u1');
    const code = await joinCodeOf(teamId);
    const typed = ` ${code.slice(0, 3).toLowerCase()} ${code.slice(3)} `;
    expect(await joinTeam(db, 'u2', typed, MAX)).toEqual({ ok: true, teamId });
    expect((await getTeam(db, teamId))?.members.map((m) => m.userId)).toEqual(['u1', 'u2']);
  });

  it('refuses a full team', async () => {
    expect(MAX).toBe(2);
    await member('u1');
    await member('u2');
    await member('u3');
    const teamId = await newTeam('u1');
    const code = await joinCodeOf(teamId);
    expect((await joinTeam(db, 'u2', code, MAX)).ok).toBe(true);
    expect(await joinTeam(db, 'u3', code, MAX)).toEqual({ ok: false, reason: 'full' });
    expect(await getTeamIdForUser(db, 'u3')).toBeNull();
  });

  it('a wrong code is not found', async () => {
    await member('u1');
    expect(await joinTeam(db, 'u1', 'ABCDEF', MAX)).toEqual({ ok: false, reason: 'not-found' });
  });
});

describe('wrong join codes', () => {
  it('counts only this user’s tries in the last hour and locks at 10', async () => {
    await member('u1');
    await member('u2');
    const now = new Date('2026-12-01T12:00:00Z');
    const ago = (m: number) => new Date(now.getTime() - m * 60_000);
    await recordWrongTeamCode(db, 'u1', ago(61));
    await recordWrongTeamCode(db, 'u2', ago(1));
    for (let i = 0; i < 9; i++) await recordWrongTeamCode(db, 'u1', ago(50 - i));
    let tries = await recentWrongTeamCodes(db, 'u1', now);
    expect(tries).toHaveLength(9);
    expect(isLockedOut(tries, now, MAX_JOIN_TRIES)).toBe(false);
    expect(triesLeft(tries, now, MAX_JOIN_TRIES)).toBe(1);

    await recordWrongTeamCode(db, 'u1', ago(1));
    tries = await recentWrongTeamCodes(db, 'u1', now);
    expect(isLockedOut(tries, now, MAX_JOIN_TRIES)).toBe(true);
    expect(isLockedOut(await recentWrongTeamCodes(db, 'u2', now), now, MAX_JOIN_TRIES)).toBe(false);
  });
});

describe('team page access', () => {
  it('members and admins can view; anyone else, and a missing team, get not found', async () => {
    await member('u1');
    await member('u2');
    await member('a', 'officer@example.com');
    const teamId = await newTeam('u1');
    const memberIds = (await getTeam(db, teamId))!.members.map((m) => m.userId);
    const profileOf = async (id: string) => (await db.query.profiles.findFirst({ where: (p, { eq }) => eq(p.userId, id) }))!;

    expect(teamViewAccess(await profileOf('u1'), memberIds)).toBe('ok');
    expect(teamViewAccess(await profileOf('u2'), memberIds)).toBe('notfound');
    expect(teamViewAccess(await profileOf('a'), memberIds)).toBe('ok');
    expect(await getTeam(db, crypto.randomUUID())).toBeNull();
  });
});

describe('details, links and join code', () => {
  it('saves company, ticker and links; empty links are removed', async () => {
    await member('u1');
    const teamId = await newTeam('u1');
    await updateTeamDetails(db, teamId, { company: 'Apple Inc.', ticker: 'AAPL' });
    await setTeamLinks(db, teamId, allLinks);
    let view = await getTeam(db, teamId);
    expect(view?.team).toMatchObject({ company: 'Apple Inc.', ticker: 'AAPL' });
    expect(view?.links).toEqual({ report: allLinks.report, slides: allLinks.slides, video: allLinks.video });

    await setTeamLinks(db, teamId, { ...allLinks, report: null, comps: 'https://drive.google.com/file/d/c' });
    view = await getTeam(db, teamId);
    expect(view?.links).toEqual({ slides: allLinks.slides, comps: 'https://drive.google.com/file/d/c', video: allLinks.video });
  });

  it('a new join code replaces the old one', async () => {
    await member('u1');
    await member('u2');
    const teamId = await newTeam('u1');
    const old = await joinCodeOf(teamId);
    const fresh = await regenerateJoinCode(db, teamId);
    expect(fresh).not.toBe(old);
    expect(await joinTeam(db, 'u2', old, MAX)).toEqual({ ok: false, reason: 'not-found' });
    expect(await joinTeam(db, 'u2', fresh, MAX)).toEqual({ ok: true, teamId });
  });
});

describe('leaveTeam', () => {
  it('keeps the team while someone is left, and deletes it with its links when the last member leaves', async () => {
    await member('u1');
    await member('u2');
    const teamId = await newTeam('u1');
    await joinTeam(db, 'u2', await joinCodeOf(teamId), MAX);
    await setTeamLinks(db, teamId, allLinks);

    expect(await leaveTeam(db, 'u1')).toBe('left');
    expect((await getTeam(db, teamId))?.members.map((m) => m.userId)).toEqual(['u2']);

    expect(await leaveTeam(db, 'u2')).toBe('team-deleted');
    expect(await getTeam(db, teamId)).toBeNull();
    expect(await db.select().from(teamLinks)).toEqual([]);
    expect(await leaveTeam(db, 'u2')).toBe('not-on-team');
  });
});

describe('deleteAccount and teams', () => {
  it('removes the member and their join-code tries; deletes the team only when it is empty', async () => {
    await member('u1');
    await member('u2');
    await member('u3');
    const shared = await newTeam('u1', 'Shared');
    await joinTeam(db, 'u2', await joinCodeOf(shared), MAX);
    const solo = await newTeam('u3', 'Solo');
    await setTeamLinks(db, shared, allLinks);
    await setTeamLinks(db, solo, allLinks);
    await db.update(teams).set({ mentorId: 'u3' }).where(eq(teams.id, shared));
    await recordWrongTeamCode(db, 'u1');
    await recordWrongTeamCode(db, 'u3');

    // u1 leaves a team that still has u2: the team and its links stay.
    await deleteAccount(db, 'u1');
    expect(await getTeamIdForUser(db, 'u1')).toBeNull();
    expect((await getTeam(db, shared))?.members.map((m) => m.userId)).toEqual(['u2']);
    expect(Object.keys((await getTeam(db, shared))!.links)).toHaveLength(3);

    // u3 was alone: their team and its links go; they're no longer anyone's mentor.
    await deleteAccount(db, 'u3');
    expect(await getTeam(db, solo)).toBeNull();
    expect(await db.select().from(teamLinks).where(eq(teamLinks.teamId, solo))).toEqual([]);
    expect((await getTeam(db, shared))?.team.mentorId).toBeNull();

    expect(await db.select().from(teamCodeAttempts)).toEqual([]);
    expect((await db.select().from(teamMembers)).map((m) => m.userId)).toEqual(['u2']);
    expect((await db.select().from(user)).map((u) => u.id)).toEqual(['u2']);
  });
});
