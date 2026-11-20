import { describe, expect, it } from 'vitest';
import { copySetCookies, redirectWithCookies } from './cookies';

const state = 'better-auth.state=abc; Path=/; HttpOnly; SameSite=Lax; Max-Age=600';
const cleared = 'better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT';

function sourceHeaders() {
  const h = new Headers({ 'Content-Type': 'application/json' });
  h.append('Set-Cookie', state);
  h.append('Set-Cookie', cleared);
  return h;
}

describe('copySetCookies', () => {
  it('copies every Set-Cookie as its own header', () => {
    const to = new Headers();
    expect(copySetCookies(sourceHeaders(), to)).toBe(2);
    expect(to.getSetCookie()).toEqual([state, cleared]);
  });

  it('keeps cookies already on the target and copies no other headers', () => {
    const to = new Headers({ Location: '/account' });
    to.append('Set-Cookie', 'other=1');
    copySetCookies(sourceHeaders(), to);
    expect(to.getSetCookie()).toEqual(['other=1', state, cleared]);
    expect(to.get('Location')).toBe('/account');
    expect(to.has('Content-Type')).toBe(false);
  });

  it('does nothing when there are no cookies', () => {
    const to = new Headers();
    expect(copySetCookies(new Headers(), to)).toBe(0);
    expect(to.getSetCookie()).toEqual([]);
  });
});

describe('redirectWithCookies', () => {
  it('is a 303 to the location carrying the cookies', () => {
    const res = redirectWithCookies('https://accounts.google.com/o/oauth2/v2/auth?x=1', sourceHeaders());
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('https://accounts.google.com/o/oauth2/v2/auth?x=1');
    expect(res.headers.getSetCookie()).toEqual([state, cleared]);
  });
});
