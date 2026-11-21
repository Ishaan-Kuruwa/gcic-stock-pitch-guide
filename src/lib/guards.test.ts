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
  it('member → ok', () => expect(teamViewAccess(profile(), members)).toBe('ok'));
  it('non-member mentee → not found (404, not 403)', () => {
    expect(teamViewAccess(profile({ userId: 'u9' }), members)).toBe('notfound');
  });
  it('non-member mentor → not found until mentors get access', () => {
    expect(teamViewAccess(profile({ userId: 'u9', role: 'mentor' }), members)).toBe('notfound');
  });
  it('admin → ok', () => expect(teamViewAccess(profile({ userId: 'u9', role: 'admin' }), members)).toBe('ok'));
});
