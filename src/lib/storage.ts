/**
 * The only place the site touches localStorage.
 *
 * Every call is wrapped in try/catch. When storage is blocked or missing
 * (private browsing, locked-down school Chromebooks, server rendering), values
 * are kept in memory instead, so the page keeps working until it's closed.
 *
 * All keys are prefixed with "ghic-".
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface Store {
  /** Saved string, or null if nothing is saved. */
  get(key: string): string | null;
  /** Save a string. Returns true if it reached persistent storage, false if only memory. */
  set(key: string, value: string): boolean;
  remove(key: string): void;
  /**
   * Saved JSON, or undefined if nothing is saved or it doesn't parse.
   * The result is unknown on purpose: check its shape before using it.
   */
  getJson(key: string): unknown;
  /** Save a value as JSON. Same return value as `set`. */
  setJson(key: string, value: unknown): boolean;
}

export const KEY_PREFIX = 'ghic-';

/**
 * Build a store over a backing storage. `getBacking` is called on every access
 * (so a storage that becomes unavailable is handled) and may throw or return null.
 */
export function createStore(getBacking: () => StorageLike | null | undefined): Store {
  const memory = new Map<string, string>();

  function backing(): StorageLike | null {
    try {
      return getBacking() ?? null;
    } catch {
      return null;
    }
  }

  const store: Store = {
    get(key) {
      const k = KEY_PREFIX + key;
      const s = backing();
      if (s) {
        try {
          return s.getItem(k);
        } catch {
          // Fall through to memory.
        }
      }
      return memory.get(k) ?? null;
    },

    set(key, value) {
      const k = KEY_PREFIX + key;
      memory.set(k, value);
      const s = backing();
      if (!s) return false;
      try {
        s.setItem(k, value);
        return true;
      } catch {
        return false;
      }
    },

    remove(key) {
      const k = KEY_PREFIX + key;
      memory.delete(k);
      const s = backing();
      if (!s) return;
      try {
        s.removeItem(k);
      } catch {
        // Nothing else to do.
      }
    },

    getJson(key) {
      const raw = store.get(key);
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return undefined;
      }
    },

    setJson(key, value) {
      let raw: string;
      try {
        raw = JSON.stringify(value);
      } catch {
        return false;
      }
      return store.set(key, raw);
    },
  };

  return store;
}

/** The site-wide store, backed by window.localStorage when it's available. */
export const storage: Store = createStore(() =>
  typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage,
);
