/**
 * Test helper (not app code): render on-demand pages and API routes for real,
 * with Astro's container API, as a chosen viewer.
 *
 * The middleware isn't run. Instead each call builds Astro.locals exactly as
 * src/middleware.ts does (session user, and their profile read from the
 * database), so the route's own checks are what's being tested.
 *
 * Callers must mock `astro:content` and `src/auth.ts` (see permissions.test.ts)
 * and point `env.DB` at a test database (cloudflareWorkersStub.ts).
 */
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { getContainerRenderer } from '@astrojs/preact/container-renderer';
import type { Session, User } from 'better-auth';
import { eq } from 'drizzle-orm';
import { getProfile, type Db } from '../db/accounts';
import { user as userTable } from '../db/schema';

export const ORIGIN = 'http://localhost';

/** Every on-demand route, by its URL pattern. */
const routes = {
  '/403': { load: () => import('../pages/403.astro'), type: 'page' },
  '/account': { load: () => import('../pages/account.astro'), type: 'page' },
  '/join': { load: () => import('../pages/join.astro'), type: 'page' },
  '/account/delete': { load: () => import('../pages/account/delete.astro'), type: 'page' },
  '/account/sign-in': { load: () => import('../pages/account/sign-in'), type: 'endpoint' },
  '/account/sign-out': { load: () => import('../pages/account/sign-out'), type: 'endpoint' },
  '/api/auth/[...all]': { load: () => import('../pages/api/auth/[...all]'), type: 'endpoint' },
  '/api/progress': { load: () => import('../pages/api/progress'), type: 'endpoint' },
  '/mentor': { load: () => import('../pages/mentor.astro'), type: 'page' },
  '/admin/teams': { load: () => import('../pages/admin/teams.astro'), type: 'page' },
  '/admin/teams.csv': { load: () => import('../pages/admin/teams.csv'), type: 'endpoint' },
  '/admin/mentors': { load: () => import('../pages/admin/mentors.astro'), type: 'page' },
  '/admin/season': { load: () => import('../pages/admin/season.astro'), type: 'page' },
  '/team/new': { load: () => import('../pages/team/new.astro'), type: 'page' },
  '/team/join': { load: () => import('../pages/team/join.astro'), type: 'page' },
  '/team/[id]': { load: () => import('../pages/team/[id]/index.astro'), type: 'page' },
  '/team/[id]/leave': { load: () => import('../pages/team/[id]/leave.astro'), type: 'page' },
} as const;

export type RoutePattern = keyof typeof routes;

let container: AstroContainer | undefined;

async function getContainer(): Promise<AstroContainer> {
  if (container) return container;
  const renderers = await loadRenderers([getContainerRenderer()]);
  container = await AstroContainer.create({ renderers });
  // denied() answers a wrong role with Astro.rewrite('/403').
  container.insertPageRoute('/403', (await routes['/403'].load()).default);
  return container;
}

export interface CallOptions {
  /** The signed-in user's id, or null for signed out. */
  userId: string | null;
  method?: 'GET' | 'POST';
  /** Real path, e.g. /team/abc. Defaults to the pattern. */
  path?: string;
  params?: Record<string, string>;
  form?: Record<string, string | string[]>;
  json?: unknown;
  /** Origin header on a POST. Defaults to this site. null sends none. */
  origin?: string | null;
}

/** The parts of Astro.locals our middleware sets (the adapter adds cfContext, unused by these routes). */
export type TestLocals = Pick<App.Locals, 'user' | 'session' | 'profile'>;

/** Astro.locals as the middleware would set them for this user. */
export async function localsFor(db: Db, userId: string | null): Promise<TestLocals> {
  if (!userId) return { user: null, session: null, profile: null };
  const row = await db.select().from(userTable).where(eq(userTable.id, userId)).get();
  if (!row) return { user: null, session: null, profile: null };
  const user: User = { ...row, image: row.image ?? null };
  const now = new Date();
  const session: Session = {
    id: `sess-${userId}`,
    token: `tok-${userId}`,
    userId,
    expiresAt: new Date(now.getTime() + 86_400_000),
    createdAt: now,
    updatedAt: now,
    ipAddress: null,
    userAgent: null,
  };
  return { user, session, profile: await getProfile(db, userId) };
}

/** Request a route as a viewer. Redirects are returned, not followed. */
export async function call(db: Db, pattern: RoutePattern, options: CallOptions): Promise<Response> {
  const { method = 'GET', path = pattern, params, form, json, origin = ORIGIN } = options;
  const headers = new Headers();
  let body: BodyInit | undefined;
  if (method === 'POST') {
    if (origin !== null) headers.set('Origin', origin);
    if (json !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(json);
    } else {
      const data = new URLSearchParams();
      for (const [key, value] of Object.entries(form ?? {})) {
        for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
      }
      headers.set('Content-Type', 'application/x-www-form-urlencoded');
      body = data;
    }
  }
  const request = new Request(new URL(path, ORIGIN), { method, headers, body });
  const route = routes[pattern];
  const mod = await route.load();
  const c = await getContainer();
  const locals = (await localsFor(db, options.userId)) as App.Locals;
  if (route.type === 'endpoint') {
    return c.renderToResponse(mod as never, { request, locals, params, routeType: 'endpoint' });
  }
  return c.renderToResponse((mod as unknown as { default: never }).default, { request, locals, params, partial: false });
}

/**
 * Every row of every table, as one string, so a test can check that a request
 * changed nothing.
 */
export async function snapshotDb(d1: D1Database): Promise<string> {
  const { results: tables } = await d1
    .prepare(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '_cf_%' and name not like 'd1_%' order by name",
    )
    .all<{ name: string }>();
  const out: Record<string, string[]> = {};
  for (const { name } of tables) {
    const { results } = await d1.prepare(`select * from "${name}"`).all();
    out[name] = results.map((r) => JSON.stringify(r)).sort();
  }
  return JSON.stringify(out);
}
