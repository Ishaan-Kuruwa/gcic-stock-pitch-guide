/** Profile rules for /join and the account pages. */
import type { Profile } from '../db/schema';

export const GRADES = [9, 10, 11, 12] as const;
export const MAX_NAME_LENGTH = 80;

type ProfileFields = Pick<Profile, 'name' | 'grade' | 'role' | 'clubCodeAt'>;

/**
 * Complete = has a name and a grade from 9 to 12, and (for mentees) has
 * entered the right club code. Mentors and admins skip the code.
 */
export function isProfileComplete(profile: ProfileFields | null | undefined): boolean {
  if (!profile) return false;
  if (!profile.name || profile.name.trim() === '') return false;
  if (profile.grade === null || !(GRADES as readonly number[]).includes(profile.grade)) return false;
  if (profile.role === 'mentee' && !profile.clubCodeAt) return false;
  return true;
}

/** "Ada  Lovelace" → "Ada". Falls back to the whole name. */
export function firstName(name: string): string {
  const trimmed = name.trim();
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export interface JoinInput {
  name: string;
  grade: number;
  code: string;
}

export type JoinErrors = Partial<Record<'name' | 'grade' | 'code', string>>;

export type JoinParse = { ok: true; value: JoinInput } | { ok: false; errors: JoinErrors; name: string };

/** Read and check the /join form. `needsCode` is false for mentors and admins. */
export function parseJoinForm(form: FormData, needsCode: boolean): JoinParse {
  const rawName = form.get('name');
  const rawGrade = form.get('grade');
  const rawCode = form.get('code');
  const name = typeof rawName === 'string' ? rawName.trim().replace(/\s+/g, ' ') : '';
  const code = typeof rawCode === 'string' ? rawCode : '';
  const grade = typeof rawGrade === 'string' && /^\d+$/.test(rawGrade) ? Number(rawGrade) : NaN;

  const errors: JoinErrors = {};
  if (name === '') errors.name = 'Enter your name.';
  else if (name.length > MAX_NAME_LENGTH) errors.name = `Keep your name under ${MAX_NAME_LENGTH} characters.`;
  if (!(GRADES as readonly number[]).includes(grade)) errors.grade = 'Choose your grade (9 to 12).';
  if (needsCode && code.trim() === '') errors.code = 'Enter the club code.';

  if (Object.keys(errors).length > 0) return { ok: false, errors, name };
  return { ok: true, value: { name, grade, code } };
}
