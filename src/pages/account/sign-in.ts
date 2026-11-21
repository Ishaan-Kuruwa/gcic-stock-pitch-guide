import type { APIRoute } from 'astro';
import { getAuth } from '../../auth';
import { redirectWithCookies } from '../../lib/cookies';
import { crossSiteResponse, isSameOrigin } from '../../lib/origin';

export const prerender = false;

/**
 * "Sign in with Google" form target. Works without JavaScript: Better Auth
 * builds the Google URL and sets a short-lived state cookie, and we redirect
 * the browser there. Astro's cookie helpers don't see Better Auth's cookies,
 * so redirectWithCookies copies them onto our redirect. Like every form here,
 * it only accepts a POST sent from this site (no sign-in started by another site).
 */
export const POST: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) return crossSiteResponse();
  try {
    const res = await getAuth().api.signInSocial({
      body: { provider: 'google', callbackURL: '/account', errorCallbackURL: '/account?error=signin' },
      headers: request.headers,
      asResponse: true,
    });
    const data: unknown = res.ok ? await res.json() : null;
    const url = data && typeof data === 'object' && 'url' in data ? data.url : null;
    if (typeof url === 'string' && url.startsWith('https://accounts.google.com/')) {
      return redirectWithCookies(url, res.headers);
    }
  } catch (error) {
    console.error('Google sign-in could not start', error);
  }
  return redirectWithCookies('/account?error=signin', new Headers());
};
