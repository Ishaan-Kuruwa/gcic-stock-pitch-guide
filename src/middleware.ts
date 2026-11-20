import { defineMiddleware } from 'astro:middleware';
import type { AstroCookies } from 'astro';
import type { Profile } from './db/schema';
import { encodeNavHint, NAV_HINT_COOKIE, NAV_HINT_MAX_AGE } from './lib/navHint';
import { firstName, isProfileComplete } from './lib/profile';

/**
 * Loads the signed-in user and their club profile into Astro.locals for
 * on-demand routes. The require* helpers in src/lib/guards.ts read these.
 *
 * Prerendered pages (everything except the account, join, admin and auth
 * routes) are skipped: they're built once with no visitor, and the auth code
 * (which needs Cloudflare bindings) is never imported at build time.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;
  context.locals.profile = null;
  if (context.isPrerendered) return next();

  const { getAuth } = await import('./auth');
  const result = await getAuth().api.getSession({ headers: context.request.headers });
  if (result) {
    context.locals.user = result.user;
    context.locals.session = result.session;
    const { getDb } = await import('./db/client');
    const { getProfile } = await import('./db/accounts');
    context.locals.profile = await getProfile(getDb(), result.user.id);
  }
  syncNavHint(context.cookies, context.url, context.locals.profile);
  return next();
});

/**
 * Keep the header's name cookie in step with the session: set it once the
 * profile is complete, remove it otherwise. Only writes when it changes.
 * Routes that sign out delete it again after this runs.
 */
function syncNavHint(cookies: AstroCookies, url: URL, profile: Profile | null) {
  const current = cookies.get(NAV_HINT_COOKIE, { decode: (v) => v })?.value;
  if (profile && profile.name && isProfileComplete(profile)) {
    const value = encodeNavHint({
      name: firstName(profile.name),
      href: profile.role === 'admin' ? '/admin/mentors' : '/account',
    });
    if (current === value) return;
    cookies.set(NAV_HINT_COOKIE, value, {
      path: '/',
      sameSite: 'lax',
      secure: url.protocol === 'https:',
      httpOnly: false,
      maxAge: NAV_HINT_MAX_AGE,
      encode: (v) => v,
    });
  } else if (current !== undefined) {
    cookies.delete(NAV_HINT_COOKIE, { path: '/' });
  }
}
