/**
 * Server-side access checks for on-demand pages and API routes. Every
 * protected route calls one of these first; hiding links is never the check.
 *
 *   const access = requireRole(Astro.locals, 'admin');
 *   if (!access.ok) return denied(Astro, access);
 *
 * The middleware has already loaded the session user and their profile into
 * locals, so these functions are pure and take no database.
 */
import type { User } from 'better-auth';
import type { Profile, Role } from '../db/schema';
import { hasRole } from './roles';
import { isProfileComplete } from './profile';

export interface GuardLocals {
  user: User | null;
  profile: Profile | null;
}

export type DeniedReason = 'signin' | 'join' | 'forbidden';
export type Denied = { ok: false; reason: DeniedReason };
export type UserAccess = { ok: true; user: User; profile: Profile | null } | Denied;
export type ProfileAccess = { ok: true; user: User; profile: Profile } | Denied;

/** Signed in. The profile may still be unfinished (used by /join and delete). */
export function requireUser(locals: GuardLocals): UserAccess {
  if (!locals.user) return { ok: false, reason: 'signin' };
  return { ok: true, user: locals.user, profile: locals.profile };
}

/** Signed in with a finished profile (name, grade, club code if a mentee). */
export function requireProfile(locals: GuardLocals): ProfileAccess {
  const access = requireUser(locals);
  if (!access.ok) return access;
  if (!access.profile || !isProfileComplete(access.profile)) return { ok: false, reason: 'join' };
  return { ok: true, user: access.user, profile: access.profile };
}

/** Finished profile and at least `role` (admins pass a mentor check). */
export function requireRole(locals: GuardLocals, role: Extract<Role, 'mentor' | 'admin'>): ProfileAccess {
  const access = requireProfile(locals);
  if (!access.ok) return access;
  if (!hasRole(access.profile.role, role)) return { ok: false, reason: 'forbidden' };
  return access;
}

/** Finished profile and the mentee role (members only: teams are for students). */
export function requireMentee(locals: GuardLocals): ProfileAccess {
  const access = requireProfile(locals);
  if (!access.ok) return access;
  if (access.profile.role !== 'mentee') return { ok: false, reason: 'forbidden' };
  return access;
}

/**
 * What the viewer is to a team. More than one can be true: an admin who is
 * the team's assigned mentor gets both admin and mentor actions there.
 */
export interface TeamCapabilities {
  /** On the team. */
  member: boolean;
  /** The team's assigned mentor (a mentor, or an admin assigned as one). */
  mentor: boolean;
  /** A club officer. */
  admin: boolean;
}

export function teamCapabilities(
  profile: Pick<Profile, 'userId' | 'role'>,
  memberUserIds: readonly string[],
  mentorId: string | null,
): TeamCapabilities {
  return {
    member: memberUserIds.includes(profile.userId),
    mentor: mentorId !== null && mentorId === profile.userId && hasRole(profile.role, 'mentor'),
    admin: profile.role === 'admin',
  };
}

/**
 * Who may open a team page: its members, its assigned mentor and admins.
 * Everyone else gets the same answer as for a team that doesn't exist, so
 * team ids aren't confirmed.
 */
export function teamViewAccess(
  profile: Pick<Profile, 'userId' | 'role'>,
  memberUserIds: readonly string[],
  mentorId: string | null,
): 'ok' | 'notfound' {
  const caps = teamCapabilities(profile, memberUserIds, mentorId);
  return caps.member || caps.mentor || caps.admin ? 'ok' : 'notfound';
}

/** The forms on the team page, by their `action` field. */
export const TEAM_ACTIONS = [
  'details',
  'links',
  'new-code',
  'milestones',
  'checkin-add',
  'checkin-edit',
  'mentorship',
] as const;
export type TeamAction = (typeof TEAM_ACTIONS)[number];

const actionsFor: Record<keyof TeamCapabilities, readonly TeamAction[]> = {
  member: ['details', 'links', 'new-code', 'milestones'],
  // Milestones here means only the mentor review (see canTick in milestones.ts).
  mentor: ['milestones', 'checkin-add', 'checkin-edit'],
  admin: ['mentorship'],
};

/** Every team-page form this viewer may send: what each of their capabilities allows. */
export function allowedTeamActions(caps: TeamCapabilities): Set<TeamAction> {
  const allowed = new Set<TeamAction>();
  for (const key of Object.keys(actionsFor) as (keyof TeamCapabilities)[]) {
    if (caps[key]) for (const action of actionsFor[key]) allowed.add(action);
  }
  return allowed;
}

/** Where each denial goes. Forbidden is answered in place with a 403 page. */
export const deniedRedirects = { signin: '/account', join: '/join' } as const;

interface DeniedContext {
  redirect(path: string, status?: 301 | 302 | 303 | 307 | 308): Response;
  rewrite(path: string): Promise<Response>;
}

/** Turn a denial into a response: redirect to sign in or /join, or a 403 page. */
export function denied(context: DeniedContext, access: Denied): Response | Promise<Response> {
  if (access.reason === 'forbidden') return context.rewrite('/403');
  return context.redirect(deniedRedirects[access.reason], 303);
}
