/**
 * /api/progress: the signed-in user's module ticks. The route file only wires
 * in the database and the modules catalog, so this is tested directly
 * (src/db/progress.test.ts).
 *
 *   GET                          → { userId, done: slug[], modules: {slug, number}[] }
 *   POST {"slug": s, "done": b}  → tick or untick one module; same answer as GET
 *   POST {"merge": [s, …]}       → tick several (first sign-in on a device)
 *
 * Signed out → 401, unfinished profile → 403, another site's POST → 403,
 * unknown slug or bad body → 400. Never cached.
 */
import type { Db } from '../db/accounts';
import { addModuleProgress, getModuleProgress, setModuleDone } from '../db/progress';
import { requireProfile, type GuardLocals } from './guards';
import { isSameOrigin } from './origin';
import type { CatalogEntry, ProgressState } from './progressSync';

/** Largest POST body we read, in characters. */
export const MAX_BODY = 4096;

export type ProgressBody =
  | { kind: 'set'; slug: string; done: boolean }
  | { kind: 'merge'; slugs: string[] }
  | { kind: 'invalid'; error: string };

/** Check a parsed POST body against the known slugs. */
export function parseProgressBody(body: unknown, validSlugs: readonly string[]): ProgressBody {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { kind: 'invalid', error: 'Expected a JSON object.' };
  }
  const known = new Set(validSlugs);
  const { slug, done, merge } = body as Record<string, unknown>;
  if (merge !== undefined) {
    if (!Array.isArray(merge) || merge.length > validSlugs.length) {
      return { kind: 'invalid', error: 'merge must be a list of module slugs.' };
    }
    for (const s of merge) {
      if (typeof s !== 'string' || !known.has(s)) return { kind: 'invalid', error: 'Unknown module.' };
    }
    return { kind: 'merge', slugs: [...new Set(merge as string[])] };
  }
  if (typeof slug !== 'string' || !known.has(slug)) return { kind: 'invalid', error: 'Unknown module.' };
  if (typeof done !== 'boolean') return { kind: 'invalid', error: 'done must be true or false.' };
  return { kind: 'set', slug, done };
}

function json(status: number, data: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', ...extra },
  });
}

export interface ProgressDeps {
  db: Db;
  catalog: readonly CatalogEntry[];
  now?: Date;
}

export async function handleProgressRequest(
  request: Request,
  locals: GuardLocals,
  { db, catalog, now = new Date() }: ProgressDeps,
): Promise<Response> {
  const method = request.method;
  if (method !== 'GET' && method !== 'POST') {
    return json(405, { error: 'method' }, { Allow: 'GET, POST' });
  }
  if (method === 'POST' && !isSameOrigin(request)) return json(403, { error: 'origin' });

  const access = requireProfile(locals);
  if (!access.ok) return json(access.reason === 'signin' ? 401 : 403, { error: access.reason });
  const userId = access.user.id;
  const slugs = catalog.map((m) => m.slug);

  if (method === 'POST') {
    const type = request.headers.get('Content-Type') ?? '';
    if (!/^application\/json\b/i.test(type)) return json(415, { error: 'Send JSON.' });
    const text = await request.text();
    if (text.length > MAX_BODY) return json(413, { error: 'Too large.' });
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return json(400, { error: 'Not valid JSON.' });
    }
    const body = parseProgressBody(raw, slugs);
    if (body.kind === 'invalid') return json(400, { error: body.error });
    if (body.kind === 'set') await setModuleDone(db, userId, body.slug, body.done, now);
    else await addModuleProgress(db, userId, body.slugs, now);
  }

  const known = new Set(slugs);
  const state: ProgressState = {
    userId,
    done: (await getModuleProgress(db, userId)).filter((s) => known.has(s)),
    modules: catalog.map(({ slug, number }) => ({ slug, number })),
  };
  return json(200, state);
}
