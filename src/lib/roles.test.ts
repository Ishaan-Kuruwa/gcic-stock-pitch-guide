import { describe, expect, it } from 'vitest';
import { hasRole, looksLikeEmail, normalizeEmail, parseEmailList, roleForEmail } from './roles';

describe('parseEmailList', () => {
  it('splits, trims, lowercases and drops blanks', () => {
    expect(parseEmailList(' Ada@Example.com, b@y.org ,,')).toEqual(['ada@example.com', 'b@y.org']);
  });
  it('is empty for a missing or empty value', () => {
    expect(parseEmailList(undefined)).toEqual([]);
    expect(parseEmailList('')).toEqual([]);
    expect(parseEmailList(' , ')).toEqual([]);
  });
});

describe('roleForEmail', () => {
  const admins = ['officer@example.com'];
  const mentors = ['mentor@example.com'];

  it('gives admin to ADMIN_EMAILS, ignoring case and spaces', () => {
    expect(roleForEmail(' Officer@Example.COM ', admins, mentors)).toBe('admin');
  });
  it('gives mentor to the mentor list, ignoring case', () => {
    expect(roleForEmail('MENTOR@example.com', admins, mentors)).toBe('mentor');
  });
  it('admin beats mentor when an email is on both lists', () => {
    expect(roleForEmail('officer@example.com', admins, ['officer@example.com'])).toBe('admin');
  });
  it('everyone else is a mentee', () => {
    expect(roleForEmail('student@gmail.com', admins, mentors)).toBe('mentee');
    expect(roleForEmail('student@gmail.com', [], [])).toBe('mentee');
  });
  it('an empty email is never an admin, even with an empty entry', () => {
    expect(roleForEmail('', [''], [''])).toBe('mentee');
  });
  it('does not match part of an email', () => {
    expect(roleForEmail('xofficer@example.com', admins, mentors)).toBe('mentee');
  });
});

describe('hasRole', () => {
  it('ranks admin over mentor over mentee', () => {
    expect(hasRole('admin', 'mentor')).toBe(true);
    expect(hasRole('mentor', 'mentor')).toBe(true);
    expect(hasRole('mentee', 'mentor')).toBe(false);
    expect(hasRole('mentor', 'admin')).toBe(false);
  });
});

describe('normalizeEmail / looksLikeEmail', () => {
  it('normalizes', () => expect(normalizeEmail('  A@B.C ')).toBe('a@b.c'));
  it('accepts plain addresses and rejects junk', () => {
    expect(looksLikeEmail('mentor@example.com')).toBe(true);
    expect(looksLikeEmail('not an email')).toBe(false);
    expect(looksLikeEmail('a@b')).toBe(false);
    expect(looksLikeEmail('')).toBe(false);
  });
});
