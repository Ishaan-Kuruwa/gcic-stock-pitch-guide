/**
 * Better Auth settings, kept free of Cloudflare imports so they can be tested.
 * src/auth.ts supplies the secrets and the D1 database at request time.
 *
 * Data rule (CLAUDE.md): store only what accounts need, Google name and email.
 * No profile picture and no Google tokens.
 */
import type { BetterAuthOptions } from 'better-auth';

/** The only Google scopes we ask for. */
export const GOOGLE_SCOPES = ['openid', 'email', 'profile'] as const;

export interface AuthSettings {
  /** Public URL of the site, e.g. https://example.workers.dev or http://localhost:4321 */
  baseURL: string;
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
}

/** Fields of an account row that hold Google tokens. */
const TOKEN_FIELDS = ['accessToken', 'refreshToken', 'idToken'] as const;

/** A copy of a user record with the profile picture removed. */
export function withoutImage<T extends Record<string, unknown>>(user: T): T & { image: null } {
  return { ...user, image: null };
}

/**
 * A copy of an account record with Google's tokens removed. We never call
 * Google APIs, and the ID token contains the profile picture URL.
 */
export function withoutTokens<T extends Record<string, unknown>>(account: T): T {
  const copy: Record<string, unknown> = { ...account };
  for (const field of TOKEN_FIELDS) {
    if (field in copy) copy[field] = null;
  }
  return copy as T;
}

/**
 * Runs after each sign-in (Better Auth creates a new session for every one).
 * Used to re-check the user's role. Errors are logged, not thrown, so a
 * database hiccup never blocks sign-in; /join re-checks a missing profile.
 */
export type OnSignIn = (userId: string) => Promise<unknown>;

export function buildAuthOptions(
  settings: AuthSettings,
  database: BetterAuthOptions['database'],
  onSignIn?: OnSignIn,
) {
  const origin = new URL(settings.baseURL).origin;
  return {
    appName: 'GHIC Stock Pitch Guide',
    baseURL: settings.baseURL,
    basePath: '/api/auth',
    secret: settings.secret,
    database,
    // Only the site itself may start sign-in or receive the user back.
    trustedOrigins: [origin],
    socialProviders: {
      google: {
        clientId: settings.googleClientId,
        clientSecret: settings.googleClientSecret,
        disableDefaultScope: true,
        scope: [...GOOGLE_SCOPES],
        prompt: 'select_account' as const,
        // Overrides the `picture` Better Auth would copy into user.image.
        mapProfileToUser: () => ({ image: undefined }),
      },
    },
    databaseHooks: {
      user: {
        create: { before: async (user) => ({ data: withoutImage(user) }) },
        update: { before: async (user) => ({ data: withoutImage(user) }) },
      },
      account: {
        create: { before: async (account) => ({ data: withoutTokens(account) }) },
        update: { before: async (account) => ({ data: withoutTokens(account) }) },
      },
      session: {
        create: {
          after: async (session: { userId: string }) => {
            if (!onSignIn) return;
            try {
              await onSignIn(session.userId);
            } catch (error) {
              console.error('Could not update the role after sign-in', error);
            }
          },
        },
      },
    },
  } satisfies BetterAuthOptions;
}
