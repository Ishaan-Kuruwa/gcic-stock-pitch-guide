import { defineMiddleware } from 'astro:middleware';

/**
 * Loads the signed-in user into Astro.locals for on-demand routes.
 *
 * Prerendered pages (every page except /account and the auth routes) are
 * skipped: they're built once with no visitor, and the auth code (which
 * needs Cloudflare bindings) is never imported at build time.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;
  context.locals.session = null;
  if (context.isPrerendered) return next();

  const { getAuth } = await import('./auth');
  const result = await getAuth().api.getSession({ headers: context.request.headers });
  if (result) {
    context.locals.user = result.user;
    context.locals.session = result.session;
  }
  return next();
});
