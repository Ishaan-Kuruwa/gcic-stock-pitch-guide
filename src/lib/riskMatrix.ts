/**
 * Risk matrix logic. The student types every risk and mitigant; this file only
 * stores, sorts, places, and formats what they typed. It never writes risk text.
 */

/** Saved through storage.ts, so the real key is "ghic-risk-matrix". */
export const RISK_KEY = 'risk-matrix';

export type Rating = 1 | 2 | 3;

export const ratings: readonly { value: Rating; label: string }[] = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'High' },
];

export interface Risk {
  id: string;
  text: string;
  /** null until the student rates it. */
  likelihood: Rating | null;
  impact: Rating | null;
  mitigant: string;
}

export function ratingLabel(r: Rating | null): string {
  return ratings.find((x) => x.value === r)?.label ?? 'Not rated';
}

function isRating(v: unknown): v is Rating {
  return v === 1 || v === 2 || v === 3;
}

/** Likelihood x impact, or null if either is unrated. */
export function riskScore(risk: Pick<Risk, 'likelihood' | 'impact'>): number | null {
  if (risk.likelihood === null || risk.impact === null) return null;
  return risk.likelihood * risk.impact;
}

/** A new id that isn't in the list yet. */
export function nextRiskId(risks: readonly Risk[]): string {
  const max = risks.reduce((m, r) => {
    const n = Number(/^risk-(\d+)$/.exec(r.id)?.[1] ?? 0);
    return Math.max(m, n);
  }, 0);
  return `risk-${max + 1}`;
}

export function addRisk(risks: readonly Risk[]): Risk[] {
  return [
    ...risks,
    { id: nextRiskId(risks), text: '', likelihood: null, impact: null, mitigant: '' },
  ];
}

export function updateRisk(
  risks: readonly Risk[],
  id: string,
  patch: Partial<Omit<Risk, 'id'>>,
): Risk[] {
  return risks.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

export function removeRisk(risks: readonly Risk[], id: string): Risk[] {
  return risks.filter((r) => r.id !== id);
}

/**
 * Highest likelihood x impact first. Ties go to the higher impact, then keep the
 * order the student entered them. Unrated risks go last.
 */
export function sortRisks(risks: readonly Risk[]): Risk[] {
  return risks
    .map((risk, index) => ({ risk, index, score: riskScore(risk) }))
    .sort((a, b) => {
      if (a.score === null || b.score === null) {
        if (a.score === b.score) return a.index - b.index;
        return a.score === null ? 1 : -1;
      }
      return b.score - a.score || (b.risk.impact ?? 0) - (a.risk.impact ?? 0) || a.index - b.index;
    })
    .map((x) => x.risk);
}

export interface GridCell {
  likelihood: Rating;
  impact: Rating;
  /** Ranks (1-based, in sorted order) of the risks in this cell. */
  ranks: number[];
}

/**
 * The 3x3 grid as rows from High likelihood down to Low, each with columns
 * from Low impact to High. Only rated risks are placed.
 */
export function riskGrid(sorted: readonly Risk[]): GridCell[][] {
  const rows: Rating[] = [3, 2, 1];
  const cols: Rating[] = [1, 2, 3];
  return rows.map((likelihood) =>
    cols.map((impact) => ({
      likelihood,
      impact,
      ranks: sorted.flatMap((r, i) =>
        r.likelihood === likelihood && r.impact === impact ? [i + 1] : [],
      ),
    })),
  );
}

/** Collapse line breaks and tabs so each risk stays on one row. */
function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Tab-separated table of the sorted risks, with a header row. Pastes as a
 * table into spreadsheets, and as text that word processors can convert.
 */
export function riskTableText(sorted: readonly Risk[]): string {
  const header = ['#', 'Risk', 'Likelihood', 'Impact', 'Score', 'Mitigant'];
  const rows = sorted.map((r, i) => {
    const score = riskScore(r);
    return [
      String(i + 1),
      oneLine(r.text),
      ratingLabel(r.likelihood),
      ratingLabel(r.impact),
      score === null ? '' : String(score),
      oneLine(r.mitigant),
    ];
  });
  return [header, ...rows].map((cols) => cols.join('\t')).join('\n');
}

/** Turn saved data back into risks. Malformed entries are dropped or reset field by field. */
export function parseRisks(raw: unknown): Risk[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Risk[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, text, likelihood, impact, mitigant } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      text: typeof text === 'string' ? text : '',
      likelihood: isRating(likelihood) ? likelihood : null,
      impact: isRating(impact) ? impact : null,
      mitigant: typeof mitigant === 'string' ? mitigant : '',
    });
  }
  return out;
}
