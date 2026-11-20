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
