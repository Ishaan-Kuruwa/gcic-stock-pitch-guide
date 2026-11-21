import { describe, expect, it } from 'vitest';
import { encodeNavHint, NAV_HINT_COOKIE } from './navHint';
import { loadProgress, saveProgress } from './progress';
import {
  clearIfSignedOut,
  createProgressClient,
  getOwner,
  hasSignInHint,
  HINT_COOKIE,
  hasMerged,
  markMerged,
  numbersToSlugs,
  parseProgressState,
  pushTick,
  reconcile,
  setOwner,
  slugsToNumbers,
  syncOnLoad,
  type CatalogEntry,
  type ProgressClient,
  type ProgressState,
} from './progressSync';
import { createStore, type StorageLike } from './storage';

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

/** A store over one fake localStorage. */
function newStore() {
  const backing = new FakeStorage();
  return createStore(() => backing);
}

const catalog: CatalogEntry[] = [
  { slug: 'start-here', number: 0 },
  { slug: 'pick-your-company', number: 1 },
  { slug: 'understand-the-business', number: 2 },
  { slug: 'industry-and-competition', number: 3 },
];

/** A fake /api/progress for one or more users, with switchable failures. */
function fakeServer() {
  const accounts = new Map<string, Set<string>>();
  let current = '';
  const server = {
    accounts,
    online: true,
    mergeFails: false,
    signIn(id: string) {
      current = id;
      if (!accounts.has(id)) accounts.set(id, new Set());
    },
    client(): ProgressClient {
      const state = (): ProgressState | null =>
        server.online ? { userId: current, done: [...accounts.get(current)!], modules: catalog } : null;
      return {
        load: async () => state(),
        merge: async (slugs) => {
          if (!server.online || server.mergeFails) return null;
          for (const s of slugs) accounts.get(current)!.add(s);
          return state();
        },
        set: async (slug, done) => {
          if (!server.online) return null;
          if (done) accounts.get(current)!.add(slug);
          else accounts.get(current)!.delete(slug);
          return state();
        },
      };
    },
  };
  return server;
}

describe('hasSignInHint', () => {
  it('uses the same cookie name as the header', () => {
    expect(HINT_COOKIE).toBe(NAV_HINT_COOKIE);
  });

  it('finds the hint cookie among others', () => {
    const value = encodeNavHint({ name: 'Ada', href: '/account' });
    expect(hasSignInHint(`a=1; ${NAV_HINT_COOKIE}=${value}; b=2`)).toBe(true);
    expect(hasSignInHint(`${NAV_HINT_COOKIE}=`)).toBe(false);
    expect(hasSignInHint(`x${NAV_HINT_COOKIE}=1; other=2`)).toBe(false);
    expect(hasSignInHint('')).toBe(false);
  });
});

describe('catalog mapping', () => {
  it('maps both ways and drops unknown values', () => {
    expect([...slugsToNumbers(catalog, ['pick-your-company', 'gone', 'start-here'])]).toEqual([1, 0]);
    expect(numbersToSlugs(catalog, [3, 9, 0])).toEqual(['industry-and-competition', 'start-here']);
  });
});

describe('parseProgressState', () => {
  it('accepts the API shape', () => {
    const state = { userId: 'u1', done: ['start-here'], modules: catalog };
    expect(parseProgressState(state)).toEqual(state);
  });

  it.each([
    null,
    'x',
    {},
    { userId: '', done: [], modules: [] },
    { userId: 'u', done: [1], modules: [] },
    {
      userId: 'u',
      done: [],
      modules: [{ slug: 's', number: 1.5 }],
    },
  ])('rejects %j', (raw) => {
    expect(parseProgressState(raw)).toBeNull();
  });
});

describe('per-device flags', () => {
  it('remembers the merge per user, and the owner', () => {
    const store = newStore();
    markMerged(store, 'a');
    markMerged(store, 'b');
    expect(hasMerged(store, 'a')).toBe(true);
    expect(hasMerged(store, 'b')).toBe(true);
    expect(hasMerged(store, 'c')).toBe(false);
    expect(getOwner(store)).toBeNull();
    setOwner(store, 'a');
    expect(getOwner(store)).toBe('a');
  });

  it('still works when storage is blocked', () => {
    const store = createStore(() => {
      throw new Error('SecurityError');
    });
    markMerged(store, 'a');
    expect(hasMerged(store, 'a')).toBe(true);
  });
});

describe('reconcile', () => {
  const base = { userId: 'a', owner: null, merged: false };

  it('first sign-in: union, uploading only what the account lacks', () => {
    expect(reconcile({ ...base, local: new Set([0, 2]), server: new Set([1, 2]) })).toEqual({
      done: new Set([0, 1, 2]),
      upload: [0],
    });
  });

  it('first sign-in with nothing new: nothing to upload', () => {
    expect(reconcile({ ...base, local: new Set([1]), server: new Set([1, 2]) }).upload).toBeNull();
  });

  it('after the merge: the server wins', () => {
    expect(reconcile({ ...base, merged: true, local: new Set([0, 3]), server: new Set([1]) })).toEqual({
      done: new Set([1]),
      upload: null,
    });
  });

  it("never merges ticks mirrored from another user's account", () => {
    expect(reconcile({ ...base, owner: 'b', local: new Set([0, 3]), server: new Set([1]) })).toEqual({
      done: new Set([1]),
      upload: null,
    });
  });
});

describe('clearIfSignedOut', () => {
  it('clears mirrored ticks once the owner is signed out, keeping merge flags', () => {
    const store = newStore();
    saveProgress(new Set([0, 1]), store);
    setOwner(store, 'a');
    markMerged(store, 'a');
    expect(clearIfSignedOut(store, true)).toBe(false);
    expect(loadProgress(store)).toEqual(new Set([0, 1]));
    expect(clearIfSignedOut(store, false)).toBe(true);
    expect(loadProgress(store)).toEqual(new Set());
    expect(getOwner(store)).toBeNull();
    expect(hasMerged(store, 'a')).toBe(true);
  });

  it('keeps ticks made while signed out', () => {
    const store = newStore();
    saveProgress(new Set([2]), store);
    expect(clearIfSignedOut(store, false)).toBe(false);
    expect(loadProgress(store)).toEqual(new Set([2]));
  });
});

describe('syncOnLoad', () => {
  it('merges once (union), then the server wins', async () => {
    const store = newStore();
    const server = fakeServer();
    server.signIn('a');
    server.accounts.get('a')!.add('pick-your-company');
    saveProgress(new Set([0]), store);

    const first = await syncOnLoad(server.client(), store);
    expect(first?.done).toEqual(new Set([0, 1]));
    expect([...server.accounts.get('a')!].sort()).toEqual(['pick-your-company', 'start-here']);
    expect(hasMerged(store, 'a')).toBe(true);
    expect(getOwner(store)).toBe('a');
    expect(loadProgress(store)).toEqual(new Set([0, 1]));

    // Unticked on another device; a stray local tick doesn't come back.
    server.accounts.get('a')!.delete('start-here');
    saveProgress(new Set([0, 1, 3]), store);
    const second = await syncOnLoad(server.client(), store);
    expect(second?.done).toEqual(new Set([1]));
    expect(loadProgress(store)).toEqual(new Set([1]));
    expect([...server.accounts.get('a')!]).toEqual(['pick-your-company']);
  });

  it('returns null and changes nothing when the account is unreachable', async () => {
    const store = newStore();
    const server = fakeServer();
    server.signIn('a');
    server.online = false;
    saveProgress(new Set([2]), store);
    expect(await syncOnLoad(server.client(), store)).toBeNull();
    expect(loadProgress(store)).toEqual(new Set([2]));
    expect(getOwner(store)).toBeNull();
  });

  it("failed merge: owner is set, sign-out clears it, and the next user's first sign-in merges nothing", async () => {
    const store = newStore();
    const server = fakeServer();
    server.signIn('a');
    server.accounts.get('a')!.add('pick-your-company');
    saveProgress(new Set([0]), store);
    server.mergeFails = true;

    const a = await syncOnLoad(server.client(), store);
    expect(a).toMatchObject({ saved: false, done: new Set([0, 1]) });
    expect(loadProgress(store)).toEqual(new Set([0, 1]));
    expect(getOwner(store)).toBe('a');
    expect(hasMerged(store, 'a')).toBe(false);

    // A signs out: the hint cookie is gone on the next page load.
    expect(clearIfSignedOut(store, false)).toBe(true);
    expect(loadProgress(store)).toEqual(new Set());

    // B signs in on the same device for the first time.
    server.mergeFails = false;
    server.signIn('b');
    const b = await syncOnLoad(server.client(), store);
    expect(b?.done).toEqual(new Set());
    expect(server.accounts.get('b')!.size).toBe(0);
  });

  it('retries a failed merge on the next load for the same user', async () => {
    const store = newStore();
    const server = fakeServer();
    server.signIn('a');
    saveProgress(new Set([3]), store);
    server.mergeFails = true;
    await syncOnLoad(server.client(), store);
    server.mergeFails = false;
    const again = await syncOnLoad(server.client(), store);
    expect(again).toMatchObject({ saved: true, done: new Set([3]) });
    expect([...server.accounts.get('a')!]).toEqual(['industry-and-competition']);
  });
});

describe('pushTick', () => {
  it('sends the slug and reports success or failure', async () => {
    const server = fakeServer();
    server.signIn('a');
    expect(await pushTick(server.client(), catalog, 2, true)).toBe(true);
    expect([...server.accounts.get('a')!]).toEqual(['understand-the-business']);
    expect(await pushTick(server.client(), catalog, 2, false)).toBe(true);
    expect(server.accounts.get('a')!.size).toBe(0);
    server.online = false;
    expect(await pushTick(server.client(), catalog, 2, true)).toBe(false);
    expect(await pushTick(server.client(), catalog, 99, true)).toBe(false);
  });
});

describe('createProgressClient', () => {
  const ok = { userId: 'u', done: [], modules: catalog };

  it('GETs and POSTs JSON to /api/progress', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const client = createProgressClient(async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(ok), { status: 200 });
    });
    expect(await client.load()).toEqual(ok);
    expect(await client.set('start-here', true)).toEqual(ok);
    expect(await client.merge(['start-here'])).toEqual(ok);
    expect(calls[0]).toMatchObject({ url: '/api/progress', init: { credentials: 'same-origin' } });
    expect(calls[1].init).toMatchObject({ method: 'POST', body: '{"slug":"start-here","done":true}' });
    expect(calls[2].init).toMatchObject({ method: 'POST', body: '{"merge":["start-here"]}' });
  });

  it('returns null on a network failure, an error status or a bad body', async () => {
    expect(await createProgressClient(async () => Promise.reject(new TypeError('offline'))).load()).toBeNull();
    expect(await createProgressClient(async () => new Response('{}', { status: 401 })).load()).toBeNull();
    expect(await createProgressClient(async () => new Response('not json', { status: 200 })).load()).toBeNull();
  });
});
