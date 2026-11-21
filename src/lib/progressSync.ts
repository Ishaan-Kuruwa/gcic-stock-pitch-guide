/**
 * Progress saved to an account (signed in only). The tracker keeps its
 * localStorage behaviour (src/lib/progress.ts) and, when the header's hint
 * cookie says someone is signed in, syncs with /api/progress:
 *
 * - The first time a user signs in on a device, local ticks and the account's
 *   ticks are merged (union) and saved to the account. A per-user flag in
 *   localStorage remembers that this happened.
 * - After that the account is the source of truth: each page load takes the
 *   account's ticks and localStorage mirrors them; each tick is sent to the
 *   server as it happens.
 * - localStorage also remembers whose account it mirrors (the "owner"). Ticks
 *   mirrored from someone else's account are never merged into yours, and when
 *   the owner has signed out the mirrored ticks are cleared, so the next person
 *   on a shared Chromebook starts from an empty tracker.
 *
 * Locally, ticks are module numbers; the server keys them by module slug. The
 * server sends the number ↔ slug catalog with every answer, so the tracker's
 * props (and the prerendered pages) stay unchanged.
 */
import { loadProgress, PROGRESS_KEY, saveProgress, type Done } from './progress';
import { storage as defaultStore, type Store } from './storage';

/** localStorage keys (through storage.ts, so "ghic-progress-merged" etc.). */
export const MERGED_KEY = 'progress-merged';
export const OWNER_KEY = 'progress-owner';

export const PROGRESS_URL = '/api/progress';

/**
 * The header's hint cookie (NAV_HINT_COOKIE in navHint.ts). Repeated here, not
 * imported: sharing navHint.ts with this island would move the header's
 * inline script into a separate file and change every prerendered page.
 * progressSync.test.ts checks the two stay the same.
 */
export const HINT_COOKIE = 'ghic_nav';

/**
 * Does the cookie string carry the signed-in hint? Presence is enough: the
 * hint grants nothing, and /api/progress checks the real session.
 */
export function hasSignInHint(cookieString: string): boolean {
  return cookieString.split(';').some((part) => {
    const eq = part.indexOf('=');
    return eq !== -1 && part.slice(0, eq).trim() === HINT_COOKIE && part.slice(eq + 1).trim() !== '';
  });
}

export interface CatalogEntry {
  slug: string;
  number: number;
}

/** What /api/progress answers: whose progress, which slugs are done, and the catalog. */
export interface ProgressState {
  userId: string;
  done: string[];
  modules: CatalogEntry[];
}

/** Check the shape of an /api/progress answer. Anything odd → null. */
export function parseProgressState(raw: unknown): ProgressState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { userId, done, modules } = raw as Record<string, unknown>;
  if (typeof userId !== 'string' || userId === '') return null;
  if (!Array.isArray(done) || !done.every((s) => typeof s === 'string')) return null;
  if (!Array.isArray(modules)) return null;
  const catalog: CatalogEntry[] = [];
  for (const m of modules) {
    if (typeof m !== 'object' || m === null) return null;
    const { slug, number } = m as Record<string, unknown>;
    if (typeof slug !== 'string' || typeof number !== 'number' || !Number.isInteger(number)) return null;
    catalog.push({ slug, number });
  }
  return { userId, done: done as string[], modules: catalog };
}

/** Slugs → module numbers, dropping slugs the catalog doesn't know. */
export function slugsToNumbers(catalog: readonly CatalogEntry[], slugs: readonly string[]): Set<number> {
  const bySlug = new Map(catalog.map((m) => [m.slug, m.number]));
  const out = new Set<number>();
  for (const slug of slugs) {
    const n = bySlug.get(slug);
    if (n !== undefined) out.add(n);
  }
  return out;
}

/** Module numbers → slugs, dropping numbers the catalog doesn't know. */
export function numbersToSlugs(catalog: readonly CatalogEntry[], numbers: Iterable<number>): string[] {
  const byNumber = new Map(catalog.map((m) => [m.number, m.slug]));
  const out: string[] = [];
  for (const n of numbers) {
    const slug = byNumber.get(n);
    if (slug !== undefined) out.push(slug);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-device flags
// ---------------------------------------------------------------------------

function mergedFlags(store: Store): Record<string, true> {
  const raw = store.getJson(MERGED_KEY);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const out: Record<string, true> = {};
  for (const [id, v] of Object.entries(raw)) if (v === true) out[id] = true;
  return out;
}

/** Has this user's first-sign-in merge already happened on this device? */
export function hasMerged(store: Store, userId: string): boolean {
  return mergedFlags(store)[userId] === true;
}

export function markMerged(store: Store, userId: string): void {
  store.setJson(MERGED_KEY, { ...mergedFlags(store), [userId]: true });
}

/** The user whose account the local progress mirrors, or null if it was made signed out. */
export function getOwner(store: Store): string | null {
  const owner = store.get(OWNER_KEY);
  return owner && owner !== '' ? owner : null;
}

export function setOwner(store: Store, userId: string): void {
  store.set(OWNER_KEY, userId);
}

/**
 * Signed out (no hint cookie) but the local progress mirrors an account:
 * that person signed out, deleted their account or their session ran out.
 * Clear the mirrored ticks so the next person starts empty. Ticks made while
 * signed out have no owner and are kept. Returns true if it cleared anything.
 */
export function clearIfSignedOut(store: Store, hinted: boolean): boolean {
  if (hinted || getOwner(store) === null) return false;
  store.remove(PROGRESS_KEY);
  store.remove(OWNER_KEY);
  return true;
}

// ---------------------------------------------------------------------------
// Merge once, then the server wins
// ---------------------------------------------------------------------------

export interface ReconcileInput {
  local: Done;
  server: Done;
  userId: string;
  merged: boolean;
  owner: string | null;
}

/**
 * What to show after loading the account's progress, and which local ticks
 * to upload (null: nothing to upload).
 */
export function reconcile({ local, server, userId, merged, owner }: ReconcileInput): {
  done: Set<number>;
  upload: number[] | null;
} {
  if (merged || (owner !== null && owner !== userId)) return { done: new Set(server), upload: null };
  const extra = [...local].filter((n) => !server.has(n)).sort((a, b) => a - b);
  return { done: new Set([...server, ...extra]), upload: extra.length > 0 ? extra : null };
}

// ---------------------------------------------------------------------------
// Talking to /api/progress
// ---------------------------------------------------------------------------

export interface ProgressClient {
  load(): Promise<ProgressState | null>;
  merge(slugs: string[]): Promise<ProgressState | null>;
  set(slug: string, done: boolean): Promise<ProgressState | null>;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** Every call returns the account's progress, or null on any failure. */
export function createProgressClient(
  fetchFn: FetchFn = (i, init) => fetch(i, init),
  url = PROGRESS_URL,
): ProgressClient {
  async function call(init?: RequestInit): Promise<ProgressState | null> {
    try {
      const res = await fetchFn(url, { credentials: 'same-origin', cache: 'no-store', ...init });
      if (!res.ok) return null;
      return parseProgressState(await res.json());
    } catch {
      return null;
    }
  }
  const post = (body: unknown) =>
    call({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return {
    load: () => call(),
    merge: (slugs) => post({ merge: slugs }),
    set: (slug, done) => post({ slug, done }),
  };
}

export interface Synced {
  userId: string;
  catalog: CatalogEntry[];
  done: Set<number>;
  /** False if the merge upload failed (the union is kept locally and retried next load). */
  saved: boolean;
}

/**
 * Load the account's progress and reconcile it with this device. Returns null
 * if the account can't be reached (the tracker then stays local-only).
 */
export async function syncOnLoad(client: ProgressClient, store: Store = defaultStore): Promise<Synced | null> {
  const state = await client.load();
  if (!state) return null;
  const { userId, modules: catalog } = state;
  const { done, upload } = reconcile({
    local: loadProgress(store),
    server: slugsToNumbers(catalog, state.done),
    userId,
    merged: hasMerged(store, userId),
    owner: getOwner(store),
  });

  let result: Synced = { userId, catalog, done, saved: true };
  if (upload) {
    const merged = await client.merge(numbersToSlugs(catalog, upload));
    if (merged) {
      markMerged(store, userId);
      result = { userId, catalog: merged.modules, done: slugsToNumbers(merged.modules, merged.done), saved: true };
    } else {
      // Keep the union locally and try again next time; don't mark the merge done.
      result = { ...result, saved: false };
    }
  } else {
    markMerged(store, userId);
  }
  // The local copy now holds this account's ticks: remember whose they are,
  // so signing out clears them (even if the upload failed).
  setOwner(store, userId);
  saveProgress(result.done, store);
  return result;
}

/**
 * Send one tick or untick to the account. The tracker has already saved it
 * locally, so a failure never loses it. The answer isn't copied over the
 * local ticks: a later success must not wipe out an earlier tick that failed.
 * The next page load brings in changes made on other devices.
 * Returns true if the account saved it.
 */
export async function pushTick(
  client: ProgressClient,
  catalog: readonly CatalogEntry[],
  moduleNumber: number,
  done: boolean,
): Promise<boolean> {
  const [slug] = numbersToSlugs(catalog, [moduleNumber]);
  if (slug === undefined) return false;
  return (await client.set(slug, done)) !== null;
}
