import { describe, expect, it, vi } from 'vitest';
import type { User } from 'better-auth';
import type { Profile } from '../db/schema';
import {
  denied,
  requireMentee,
  requireProfile,
  requireRole,
  requireUser,
  teamViewAccess,
  teamCapabilities,
  allowedTeamActions,
  type GuardLocals,
} from './guards';

const user = { id: 'u1', name: 'Ada', email: 'ada@example.com' } as User;
const profile = (over: Partial<Profile> = {}): Profile => ({
  userId: 'u1',
  name: 'Ada',
  grade: 10,
  role: 'mentee',
  clubCodeAt: new Date(),
  createdAt: new Date(),
  ...over,
});

const signedOut: GuardLocals = { user: null, profile: null };
const noProfile: GuardLocals = { user, profile: null };
const unfinished: GuardLocals = { user, profile: profile({ grade: null }) };
const mentee: GuardLocals = { user, profile: profile() };
const mentor: GuardLocals = { user, profile: profile({ role: 'mentor', clubCodeAt: null }) };
const admin: GuardLocals = { user, profile: profile({ role: 'admin', clubCodeAt: null }) };

describe('requireUser', () => {
  it('signed out → sign in', () => expect(requireUser(signedOut)).toEqual({ ok: false, reason: 'signin' }));
  it('signed in without a profile → allowed', () => {
    expect(requireUser(noProfile)).toEqual({ ok: true, user, profile: null });
  });
  it('signed in with a profile → allowed', () => expect(requireUser(mentee).ok).toBe(true));
});

describe('requireProfile', () => {
  it('signed out → sign in', () => expect(requireProfile(signedOut)).toEqual({ ok: false, reason: 'signin' }));
  it('no profile → /join', () => expect(requireProfile(noProfile)).toEqual({ ok: false, reason: 'join' }));
  it('unfinished profile → /join', () => expect(requireProfile(unfinished)).toEqual({ ok: false, reason: 'join' }));
  it('mentee without the club code → /join', () => {
    expect(requireProfile({ user, profile: profile({ clubCodeAt: null }) })).toEqual({ ok: false, reason: 'join' });
  });
  it('finished profile → allowed with the profile', () => {
    const access = requireProfile(mentee);
    expect(access.ok).toBe(true);
    if (access.ok) expect(access.profile.role).toBe('mentee');
  });
});

describe('requireRole', () => {
  it('signed out → sign in', () => expect(requireRole(signedOut, 'admin')).toEqual({ ok: false, reason: 'signin' }));
  it('no profile → /join', () => expect(requireRole(noProfile, 'mentor')).toEqual({ ok: false, reason: 'join' }));
  it('wrong role → forbidden', () => {
    expect(requireRole(mentee, 'mentor')).toEqual({ ok: false, reason: 'forbidden' });
    expect(requireRole(mentee, 'admin')).toEqual({ ok: false, reason: 'forbidden' });
    expect(requireRole(mentor, 'admin')).toEqual({ ok: false, reason: 'forbidden' });
  });
  it('right role → allowed', () => {
    expect(requireRole(mentor, 'mentor').ok).toBe(true);
    expect(requireRole(admin, 'admin').ok).toBe(true);
  });
  it('admins pass a mentor check', () => expect(requireRole(admin, 'mentor').ok).toBe(true));
});

describe('denied', () => {
  const context = () => ({
    redirect: vi.fn((path: string, status?: number) => new Response(null, { status, headers: { Location: path } })),
    rewrite: vi.fn(async () => new Response('no access', { status: 403 })),
  });

  it('sends signed-out visitors to /account and unfinished profiles to /join', () => {
    const ctx = context();
    denied(ctx, { ok: false, reason: 'signin' });
    denied(ctx, { ok: false, reason: 'join' });
    expect(ctx.redirect.mock.calls).toEqual([
      ['/account', 303],
      ['/join', 303],
    ]);
  });

  it('shows the 403 page for the wrong role', async () => {
    const ctx = context();
    const res = await denied(ctx, { ok: false, reason: 'forbidden' });
    expect(ctx.rewrite).toHaveBeenCalledWith('/403');
    expect(res.status).toBe(403);
  });
});

describe('requireMentee', () => {
  it('signed out → sign in', () => expect(requireMentee(signedOut)).toEqual({ ok: false, reason: 'signin' }));
  it('unfinished → /join', () => expect(requireMentee(unfinished)).toEqual({ ok: false, reason: 'join' }));
  it('mentee → allowed', () => expect(requireMentee(mentee).ok).toBe(true));
  it('mentor → forbidden', () => expect(requireMentee(mentor)).toEqual({ ok: false, reason: 'forbidden' }));
  it('admin → forbidden', () => expect(requireMentee(admin)).toEqual({ ok: false, reason: 'forbidden' }));
});

describe('teamViewAccess', () => {
  const members = ['u1', 'u2'];
  it('member → ok', () => expect(teamViewAccess(profile(), members, null)).toBe('ok'));
  it('non-member mentee → not found (404, not 403)', () => {
    expect(teamViewAccess(profile({ userId: 'u9' }), members, null)).toBe('notfound');
  });
  it('assigned mentor → ok', () => {
    expect(teamViewAccess(profile({ userId: 'm1', role: 'mentor' }), members, 'm1')).toBe('ok');
  });
  it("another team's mentor → not found", () => {
    expect(teamViewAccess(profile({ userId: 'm2', role: 'mentor' }), members, 'm1')).toBe('notfound');
  });
  it('mentor of a team with no mentor → not found', () => {
    expect(teamViewAccess(profile({ userId: 'm1', role: 'mentor' }), members, null)).toBe('notfound');
  });
  it('removed mentor (now a mentee) still named on the team → not found', () => {
    expect(teamViewAccess(profile({ userId: 'm1', role: 'mentee' }), members, 'm1')).toBe('notfound');
  });
  it('admin → ok', () => expect(teamViewAccess(profile({ userId: 'u9', role: 'admin' }), members, null)).toBe('ok'));
});

describe('teamCapabilities and allowedTeamActions', () => {
  const members = ['u1', 'u2'];
  const actions = (p: Parameters<typeof profile>[0], mentorId: string | null) =>
    [...allowedTeamActions(teamCapabilities(profile(p), members, mentorId))].sort();

  it('member: team details, links, join code and milestones', () => {
    expect(teamCapabilities(profile(), members, 'm1')).toEqual({ member: true, mentor: false, admin: false });
    expect(actions({}, 'm1')).toEqual(['details', 'links', 'milestones', 'new-code']);
  });

  it("assigned mentor: milestones (mentor review only) and check-ins, not the team's details or links", () => {
    expect(actions({ userId: 'm1', role: 'mentor' }, 'm1')).toEqual(['checkin-add', 'checkin-edit', 'milestones']);
  });

  it('a mentor not assigned to the team: nothing', () => {
    expect(actions({ userId: 'm2', role: 'mentor' }, 'm1')).toEqual([]);
  });

  it('admin not assigned: mentorship only (no ticks, no check-ins)', () => {
    expect(teamCapabilities(profile({ userId: 'a1', role: 'admin' }), members, 'm1')).toEqual({
      member: false,
      mentor: false,
      admin: true,
    });
    expect(actions({ userId: 'a1', role: 'admin' }, 'm1')).toEqual(['mentorship']);
  });

  it('admin assigned as mentor: mentorship plus mentor actions', () => {
    expect(teamCapabilities(profile({ userId: 'a1', role: 'admin' }), members, 'a1')).toEqual({
      member: false,
      mentor: true,
      admin: true,
    });
    expect(actions({ userId: 'a1', role: 'admin' }, 'a1')).toEqual([
      'checkin-add',
      'checkin-edit',
      'mentorship',
      'milestones',
    ]);
  });

  it('only admins can change mentorship', () => {
    expect(actions({}, null)).not.toContain('mentorship');
    expect(actions({ userId: 'm1', role: 'mentor' }, 'm1')).not.toContain('mentorship');
  });
});
