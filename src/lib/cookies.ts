/**
 * Copy every Set-Cookie header from one response's headers to another's.
 *
 * Better Auth's server API (`auth.api.*` with `asResponse: true`) returns a
 * Response whose Set-Cookie headers Astro's `cookies` helper never sees. When
 * we answer with our own redirect instead of that Response, the cookies (the
 * OAuth state cookie on sign-in, the cleared session cookie on sign-out) must
 * be copied across or they're lost.
 *
 * Uses `getSetCookie()` so several cookies stay separate headers instead of
 * being joined with commas (cookie dates contain commas).
 */
export function copySetCookies(from: Headers, to: Headers): number {
  const cookies = from.getSetCookie();
  for (const cookie of cookies) {
    to.append('Set-Cookie', cookie);
  }
  return cookies.length;
}

/**
 * A 303 See Other redirect (so the browser follows with GET after a form
 * POST) that carries the Set-Cookie headers of `source`.
 */
export function redirectWithCookies(location: string, source: Headers): Response {
  const headers = new Headers({ Location: location });
  copySetCookies(source, headers);
  return new Response(null, { status: 303, headers });
}
