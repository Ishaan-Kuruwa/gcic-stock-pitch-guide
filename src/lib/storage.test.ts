import { describe, expect, it } from 'vitest';
import { createStore, KEY_PREFIX, storage, type StorageLike } from './storage';

/** A store over one shared FakeStorage. */
function fakeStore() {
  const backing = new FakeStorage();
  return { backing, store: createStore(() => backing) };
}

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

/** Storage that throws on every call, like Safari with storage blocked. */
const throwing: StorageLike = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
  removeItem() {
    throw new Error('SecurityError');
  },
};

describe('createStore with working storage', () => {
  it('saves under a ghic- prefix and reads back', () => {
    const backing = new FakeStorage();
    const store = createStore(() => backing);
    expect(store.set('a', '1')).toBe(true);
    expect(backing.data.get(`${KEY_PREFIX}a`)).toBe('1');
    expect(store.get('a')).toBe('1');
  });

  it('returns null for missing keys', () => {
    expect(fakeStore().store.get('missing')).toBeNull();
  });

  it('removes keys', () => {
    const { backing, store } = fakeStore();
    store.set('a', '1');
    store.remove('a');
    expect(store.get('a')).toBeNull();
    expect(backing.data.size).toBe(0);
  });

  it('round-trips JSON', () => {
    const { store } = fakeStore();
    expect(store.setJson('list', ['NKE', 'AAPL'])).toBe(true);
    expect(store.getJson('list')).toEqual(['NKE', 'AAPL']);
  });

  it('gives undefined for missing or broken JSON', () => {
    const backing = new FakeStorage();
    const store = createStore(() => backing);
    expect(store.getJson('none')).toBeUndefined();
    backing.setItem(`${KEY_PREFIX}bad`, '{not json');
    expect(store.getJson('bad')).toBeUndefined();
  });

  it('refuses values JSON cannot represent', () => {
    const { store } = fakeStore();
    const loop: { self?: unknown } = {};
    loop.self = loop;
    expect(store.setJson('loop', loop)).toBe(false);
  });
});

describe('createStore when storage is blocked', () => {
  it('falls back to memory when every call throws', () => {
    const store = createStore(() => throwing);
    expect(store.set('a', '1')).toBe(false);
    expect(store.get('a')).toBe('1');
    store.remove('a');
    expect(store.get('a')).toBeNull();
  });

  it('falls back to memory when getting storage throws', () => {
    const store = createStore(() => {
      throw new Error('SecurityError');
    });
    expect(store.setJson('list', ['NKE'])).toBe(false);
    expect(store.getJson('list')).toEqual(['NKE']);
  });

  it('falls back to memory when there is no storage', () => {
    const store = createStore(() => null);
    expect(store.set('a', '1')).toBe(false);
    expect(store.get('a')).toBe('1');
  });
});

describe('default storage', () => {
  it('works without window.localStorage (as in tests and server rendering)', () => {
    storage.setJson('test-key', [1]);
    expect(storage.getJson('test-key')).toEqual([1]);
    storage.remove('test-key');
    expect(storage.get('test-key')).toBeNull();
  });
});
