import type { APIRoute } from 'astro';
import { getAuth } from '../../auth';
import { redirectWithCookies } from '../../lib/cookies';

export const prerender = false;

/**
 * "Sign out" form target. Better Auth deletes the session and clears its
 * cookies; redirectWithCookies copies those cleared cookies onto our redirect
 * so the browser actually forgets them.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const res = await getAuth().api.signOut({ headers: request.headers, asResponse: true });
    return redirectWithCookies('/account', res.headers);
  } catch (error) {
    console.error('Sign-out failed', error);
    return redirectWithCookies('/account?error=signout', new Headers());
  }
};
