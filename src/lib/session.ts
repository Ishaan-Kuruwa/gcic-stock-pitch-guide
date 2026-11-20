/** Helpers shared by the routes that end a session (sign out, delete account). */
import type { AstroCookies } from 'astro';
import { NAV_HINT_COOKIE } from './navHint';

/** Forget the header's name cookie. */
export function clearNavHint(cookies: AstroCookies) {
  cookies.delete(NAV_HINT_COOKIE, { path: '/' });
}
