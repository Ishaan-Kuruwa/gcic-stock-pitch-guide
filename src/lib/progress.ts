import { formatShortDate } from './format';
import { storage, type Store } from './storage';

/** Saved through storage.ts, so the real key is "ghic-progress". */
export const PROGRESS_KEY = 'progress';

/** Module numbers whose deliverable is done. */
export type Done = ReadonlySet<number>;

/**
 * Turn saved data back into a set of done module numbers.
 * Saved shape: { "0": true, "1": true }. Anything else is ignored.
 */
export function parseProgress(raw: unknown): Set<number> {
  const done = new Set<number>();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return done;
  for (const [key, value] of Object.entries(raw)) {
    if (value !== true || !/^\d+$/.test(key)) continue;
    done.add(Number(key));
  }
  return done;
}

/** The saved shape for a set of done modules. */
export function serializeProgress(done: Done): Record<string, true> {
  const out: Record<string, true> = {};
  for (const n of [...done].sort((a, b) => a - b)) out[String(n)] = true;
  return out;
}

export function loadProgress(store: Store = storage): Set<number> {
  return parseProgress(store.getJson(PROGRESS_KEY));
}

/** Returns true if progress reached persistent storage, false if it's only in memory. */
export function saveProgress(done: Done, store: Store = storage): boolean {
  return store.setJson(PROGRESS_KEY, serializeProgress(done));
}

/** Mark a module done, or not done if it already was. */
export function toggleDone(done: Done, moduleNumber: number): Set<number> {
  const next = new Set(done);
  if (next.has(moduleNumber)) next.delete(moduleNumber);
  else next.add(moduleNumber);
  return next;
}

/** The lowest-numbered module not yet done, or undefined when all are done. */
export function nextModule(modules: readonly { number: number }[], done: Done): number | undefined {
  let next: number | undefined;
  for (const { number } of modules) {
    if (!done.has(number) && (next === undefined || number < next)) next = number;
  }
  return next;
}

/**
 * Plain-text progress for a mentor, e.g.
 * "GHIC progress: Module 0 ✓, Module 1 (next, due Dec 18, 2026), Module 2 (due Jan 4, 2027)"
 */
export function progressSummary(
  modules: readonly { number: number; due: string }[],
  done: Done,
): string {
  const sorted = [...modules].sort((a, b) => a.number - b.number);
  const next = nextModule(sorted, done);
  const parts = sorted.map(({ number, due }) => {
    if (done.has(number)) return `Module ${number} ✓`;
    const date = formatShortDate(due);
    return number === next ? `Module ${number} (next, due ${date})` : `Module ${number} (due ${date})`;
  });
  const text = `GHIC progress: ${parts.join(', ')}`;
  return next === undefined && sorted.length > 0 ? `${text}. All modules done.` : text;
}
