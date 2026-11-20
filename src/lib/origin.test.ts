import { describe, expect, it } from 'vitest';
import { crossSiteResponse, isSameOrigin } from './origin';

const post = (origin?: string) =>
  new Request('https://guide.example.dev/admin/mentors', {
    method: 'POST',
    headers: origin ? { Origin: origin } : {},
  });

describe('isSameOrigin', () => {
  it('accepts a POST from the site itself', () => expect(isSameOrigin(post('https://guide.example.dev'))).toBe(true));
  it('rejects another site', () => expect(isSameOrigin(post('https://evil.example'))).toBe(false));
  it('rejects http when the site is https', () => expect(isSameOrigin(post('http://guide.example.dev'))).toBe(false));
  it('rejects a missing Origin', () => expect(isSameOrigin(post())).toBe(false));
  it('rejects "null" (sandboxed or privacy-redirected forms)', () => expect(isSameOrigin(post('null'))).toBe(false));
});

describe('crossSiteResponse', () => {
  it('is a 403', () => expect(crossSiteResponse().status).toBe(403));
});
