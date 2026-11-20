/**
 * Server-only Better Auth instance, backed by the D1 database bound as `DB`.
 * Import only from on-demand routes and middleware, never from a prerendered
 * page or a client component.
 *
 * Settings live in src/lib/authOptions.ts. The secrets come from Wrangler:
 * .dev.vars locally, `npx wrangler secret put` in production.
 */
import { env } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { drizzle } from 'drizzle-orm/d1';
import { authSchema } from './db/schema';
import { buildAuthOptions } from './lib/authOptions';

function createAuth() {
  const db = drizzle(env.DB, { schema: authSchema });
  return betterAuth(
    buildAuthOptions(
      {
        baseURL: env.BETTER_AUTH_URL,
        secret: env.BETTER_AUTH_SECRET,
        googleClientId: env.GOOGLE_CLIENT_ID,
        googleClientSecret: env.GOOGLE_CLIENT_SECRET,
      },
      drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
    ),
  );
}

let instance: ReturnType<typeof createAuth> | undefined;

/** The Better Auth instance, created on first use and reused by the isolate. */
export function getAuth() {
  instance ??= createAuth();
  return instance;
}
