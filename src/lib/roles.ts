/**
 * Who gets which role. Roles come from email addresses only:
 * ADMIN_EMAILS (a Wrangler secret) → admin, the mentor list kept at
 * /admin/mentors → mentor, everyone else → mentee.
 */
import type { Role } from '../db/schema';

/** Lowercase and trim, so "Ada@Example.com " and "ada@example.com" match. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** "a@x.com, B@y.com,," → ['a@x.com', 'b@y.com']. Missing or empty → []. */
export function parseEmailList(list: string | undefined | null): string[] {
  if (!list) return [];
  return list
    .split(',')
    .map(normalizeEmail)
    .filter((email) => email.length > 0);
}

/** Admin beats mentor; anyone on neither list is a mentee. */
export function roleForEmail(email: string, adminEmails: string[], mentorEmails: string[]): Role {
  const target = normalizeEmail(email);
  if (target === '') return 'mentee';
  if (adminEmails.some((e) => normalizeEmail(e) === target)) return 'admin';
  if (mentorEmails.some((e) => normalizeEmail(e) === target)) return 'mentor';
  return 'mentee';
}

/** True when `role` is at least `needed` (admin can do anything a mentor can). */
export function hasRole(role: Role, needed: Role): boolean {
  const rank: Record<Role, number> = { mentee: 0, mentor: 1, admin: 2 };
  return rank[role] >= rank[needed];
}

/** A plausible email address, for the add-mentor form. Not a full RFC check. */
export function looksLikeEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const roleLabels: Record<Role, string> = {
  mentee: 'Member',
  mentor: 'Mentor',
  admin: 'Admin (club officer)',
};
