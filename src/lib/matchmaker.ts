import type { Company, InterestId, StyleChoice } from '../data/matchmaker';

/** Most interests a student can pick at once. */
export const MAX_INTERESTS = 3;
/** Most companies shown in one set of matches. */
export const MAX_RESULTS = 8;

export interface ToggleResult {
  picked: InterestId[];
  /** True when the student tried to pick past the limit; `picked` is unchanged. */
  atLimit: boolean;
}

/** Pick or unpick an interest, keeping the order they were picked in. */
export function toggleInterest(
  picked: readonly InterestId[],
  id: InterestId,
  max = MAX_INTERESTS,
): ToggleResult {
  if (picked.includes(id)) {
    return { picked: picked.filter((p) => p !== id), atLimit: false };
  }
  if (picked.length >= max) {
    return { picked: [...picked], atLimit: true };
  }
  return { picked: [...picked, id], atLimit: false };
}

/**
 * Companies that match the picked interests and style.
 *
 * - If the style filter leaves nothing, the style is ignored so the student
 *   still sees companies for their interests.
 * - Results are interleaved: one from each picked interest in pick order,
 *   then the next from each, and so on, so every interest gets a turn.
 * - At most `max` companies are returned.
 */
export function matchCompanies(
  all: readonly Company[],
  picked: readonly InterestId[],
  style: StyleChoice,
  max = MAX_RESULTS,
): Company[] {
  const forInterests = all.filter((c) => picked.includes(c.interest));
  let matches = forInterests.filter((c) => style === 'both' || c.style === style);
  if (matches.length === 0) matches = forInterests;

  const buckets = picked.map((id) => matches.filter((c) => c.interest === id));
  const ordered: Company[] = [];
  const longest = Math.max(0, ...buckets.map((b) => b.length));
  for (let round = 0; round < longest; round++) {
    for (const bucket of buckets) {
      if (round < bucket.length) ordered.push(bucket[round]);
    }
  }
  return ordered.slice(0, Math.max(0, max));
}

/** Add a ticker to the shortlist, or remove it if it's already there. */
export function toggleShortlist(list: readonly string[], ticker: string): string[] {
  return list.includes(ticker) ? list.filter((t) => t !== ticker) : [...list, ticker];
}

/**
 * Turn saved data back into a shortlist: keeps only known tickers, once each,
 * in saved order. Anything that isn't an array gives an empty list.
 */
export function parseShortlist(raw: unknown, all: readonly Company[]): string[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set(all.map((c) => c.ticker));
  const out: string[] = [];
  for (const t of raw) {
    if (typeof t === 'string' && known.has(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

/** The text the Copy button puts on the clipboard. */
export function shortlistText(list: readonly string[], all: readonly Company[]): string {
  const byTicker = new Map(all.map((c) => [c.ticker, c]));
  const items = list
    .map((t) => byTicker.get(t))
    .filter((c): c is Company => c !== undefined)
    .map((c) => `${c.ticker} (${c.name})`);
  return `My GHIC stock pitch shortlist: ${items.join(', ')}`;
}
