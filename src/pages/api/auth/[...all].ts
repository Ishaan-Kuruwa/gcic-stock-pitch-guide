import type { APIRoute } from 'astro';
import { getAuth } from '../../../auth';

export const prerender = false;

/** Better Auth's own routes, including the Google callback at /api/auth/callback/google. */
export const ALL: APIRoute = ({ request }) => getAuth().handler(request);
