import { describe, expect, it } from 'vitest';
import { firstName, isProfileComplete, parseJoinForm } from './profile';

const base = { name: 'Ada Lovelace', grade: 10, role: 'mentee' as const, clubCodeAt: new Date() };

describe('isProfileComplete', () => {
  it('needs a profile, a name and a grade from 9 to 12', () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(base)).toBe(true);
    expect(isProfileComplete({ ...base, name: null })).toBe(false);
    expect(isProfileComplete({ ...base, name: '  ' })).toBe(false);
    expect(isProfileComplete({ ...base, grade: null })).toBe(false);
    expect(isProfileComplete({ ...base, grade: 8 })).toBe(false);
  });
  it('mentees need the club code; mentors and admins do not', () => {
    expect(isProfileComplete({ ...base, clubCodeAt: null })).toBe(false);
    expect(isProfileComplete({ ...base, role: 'mentor', clubCodeAt: null })).toBe(true);
    expect(isProfileComplete({ ...base, role: 'admin', clubCodeAt: null })).toBe(true);
  });
});

describe('firstName', () => {
  it('takes the first word', () => {
    expect(firstName('  Ada   Lovelace ')).toBe('Ada');
    expect(firstName('Cher')).toBe('Cher');
  });
});

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe('parseJoinForm', () => {
  it('accepts a full form and tidies the name', () => {
    const r = parseJoinForm(form({ name: '  Ada   Lovelace ', grade: '11', code: 'x' }), true);
    expect(r).toEqual({ ok: true, value: { name: 'Ada Lovelace', grade: 11, code: 'x' } });
  });
  it('explains every problem in words', () => {
    const r = parseJoinForm(form({ name: '', grade: '13', code: ' ' }), true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['code', 'grade', 'name']);
  });
  it('rejects odd grade values', () => {
    for (const grade of ['', '9.5', 'ten', '-10']) {
      const r = parseJoinForm(form({ name: 'Ada', grade, code: 'x' }), true);
      expect(r.ok).toBe(false);
    }
  });
  it('does not need a code from mentors and admins', () => {
    expect(parseJoinForm(form({ name: 'Ada', grade: '12' }), false).ok).toBe(true);
  });
  it('rejects a very long name', () => {
    expect(parseJoinForm(form({ name: 'a'.repeat(81), grade: '9', code: 'x' }), true).ok).toBe(false);
  });
});
