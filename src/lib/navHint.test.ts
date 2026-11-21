import { describe, expect, it } from 'vitest';
import { accountHrefFor, decodeNavHint, encodeNavHint, NAV_HINT_COOKIE, readNavHint } from './navHint';

describe('nav hint cookie', () => {
  it('round-trips through a cookie string', () => {
    const value = encodeNavHint({ name: 'Zoë', href: '/admin/mentors' });
    expect(value).not.toMatch(/[;,\s"]/);
    expect(readNavHint(`a=1; ${NAV_HINT_COOKIE}=${value}; b=2`)).toEqual({ name: 'Zoë', href: '/admin/mentors' });
  });

  it('is null when missing or broken', () => {
    expect(readNavHint('')).toBeNull();
    expect(readNavHint('other=1')).toBeNull();
    expect(decodeNavHint('%E0%A4%A')).toBeNull();
    expect(decodeNavHint(encodeURIComponent('[1]'))).toBeNull();
  });

  it('only links to the account pages', () => {
    const evil = encodeURIComponent(JSON.stringify({ n: 'Ada', h: 'https://evil.example' }));
    const script = encodeURIComponent(JSON.stringify({ n: 'Ada', h: 'javascript:alert(1)' }));
    expect(decodeNavHint(evil)).toBeNull();
    expect(decodeNavHint(script)).toBeNull();
  });

  it('caps the name length and rejects blank names', () => {
    expect(decodeNavHint(encodeNavHint({ name: 'x'.repeat(100), href: '/account' }))?.name).toHaveLength(40);
    expect(decodeNavHint(encodeURIComponent(JSON.stringify({ n: ' ', h: '/account' })))).toBeNull();
  });
});

describe('accountHrefFor', () => {
  it('sends admins to all teams, mentors to their teams, members to their account', () => {
    expect(accountHrefFor('admin')).toBe('/admin/teams');
    expect(accountHrefFor('mentor')).toBe('/mentor');
    expect(accountHrefFor('mentee')).toBe('/account');
  });

  it('every link it gives survives the cookie', () => {
    for (const role of ['admin', 'mentor', 'mentee'] as const) {
      const href = accountHrefFor(role);
      expect(decodeNavHint(encodeNavHint({ name: 'Ada', href }))?.href).toBe(href);
    }
  });
});
