// P/E valuation math for module 5 and the P/E calculator. Pure functions
// only: components call these and render the results.

import { formatCurrency, formatMultiple, formatPercent } from './format';

/** Which input a validation message belongs to. */
export type ValuationField = 'eps' | 'pe' | 'price' | 'target' | 'peers';

/** Thrown when an input can't be used. `message` is written for students. */
export class ValuationError extends Error {
  readonly field: ValuationField;

  constructor(field: ValuationField, message: string) {
    super(message);
    this.name = 'ValuationError';
    this.field = field;
  }
}

const labels: Record<ValuationField, { name: string; missing: string; positive?: string }> = {
  eps: {
    name: 'Forecast EPS',
    missing: 'Enter a forecast EPS.',
    positive: 'Forecast EPS must be greater than zero. A P/E target price needs positive earnings.',
  },
  pe: { name: 'Target P/E', missing: 'Enter a target P/E.' },
  price: { name: 'Current price', missing: 'Enter the current price.' },
  target: { name: 'Target price', missing: 'Enter a target price.' },
  peers: { name: 'Peer P/E', missing: 'Enter a peer P/E.' },
};

/**
 * Check that a value is a usable positive number and return it.
 * `name` overrides the field's label, e.g. "EPS value 3" in a list.
 */
function requirePositive(value: unknown, field: ValuationField, name?: string): number {
  const label = labels[field];
  const shown = name ?? label.name;
  if (value === null || value === undefined) {
    throw new ValuationError(field, name ? `${shown} is missing.` : label.missing);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValuationError(field, `${shown} must be a number.`);
  }
  if (value <= 0) {
    throw new ValuationError(
      field,
      !name && label.positive ? label.positive : `${shown} must be greater than zero.`,
    );
  }
  return value;
}

/** Target price = forecast EPS × target P/E. */
export function targetPrice(forecastEps: number, targetPe: number): number {
  const eps = requirePositive(forecastEps, 'eps');
  const pe = requirePositive(targetPe, 'pe');
  return eps * pe;
}

/**
 * Upside (or downside, if negative) as a fraction: 0.17 means 17%.
 * (target − current price) ÷ current price.
 */
export function upside(target: number, currentPrice: number): number {
  const t = requirePositive(target, 'target');
  const p = requirePositive(currentPrice, 'price');
  return (t - p) / p;
}

function requireList(values: unknown, field: ValuationField, itemName: string): number[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new ValuationError(field, `Enter at least one ${itemName}.`);
  }
  return values.map((v, i) => requirePositive(v, field, `${itemName} ${i + 1}`));
}

/**
 * Grid of target prices: one row per EPS value, one column per P/E value.
 * grid[row][col] = epsValues[row] × peValues[col].
 */
export function sensitivity(epsValues: number[], peValues: number[]): number[][] {
  const eps = requireList(epsValues, 'eps', 'EPS value');
  const pes = requireList(peValues, 'pe', 'P/E value');
  return eps.map((e) => pes.map((p) => e * p));
}

/** Percent steps around the student's number: −20%, −10%, as entered, +10%, +20%. */
export const SENSITIVITY_STEPS = [-0.2, -0.1, 0, 0.1, 0.2] as const;

/** Values around `center`, one per step, in ascending order. */
export function sensitivityAxis(
  center: number,
  { field = 'pe', steps = SENSITIVITY_STEPS }: { field?: ValuationField; steps?: readonly number[] } = {},
): number[] {
  const c = requirePositive(center, field);
  return [...steps].sort((a, b) => a - b).map((step) => c * (1 + step));
}

export interface PeerStats {
  count: number;
  average: number;
  median: number;
}

/** Average and median of peer P/E ratios. */
export function peerStats(pes: number[]): PeerStats {
  const values = requireList(pes, 'peers', 'Peer P/E');
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const average = values.reduce((sum, v) => sum + v, 0) / values.length;
  return { count: values.length, average, median };
}

/**
 * Read a number a student typed. Allows "$", ",", "%", and spaces.
 * Returns null for a blank box and NaN for anything that isn't a number.
 */
export function parseNumberInput(text: string): number | null {
  const cleaned = text.replace(/[\s$,%]/g, '');
  if (cleaned === '') return null;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

/** Round half away from zero to `dp` decimal places, avoiding float drift (1.005 → 1.01). */
export function roundTo(value: number, dp: number): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const text = String(abs);
  if (text.includes('e')) {
    const f = 10 ** dp;
    return (sign * Math.round(abs * f)) / f;
  }
  const rounded = Number(`${Math.round(Number(`${text}e${dp}`))}e-${dp}`);
  return rounded === 0 ? 0 : sign * rounded;
}

/** Decimal places shown for prices, EPS, and P/E ratios. */
export const VALUE_DP = 2;
/** Upside is shown as a percent with one decimal, so the fraction keeps three. */
export const UPSIDE_DP = 3;

export type FieldErrors = Partial<Record<ValuationField, string>>;

export interface DisplayedValuation {
  eps: number;
  pe: number;
  target: number;
  /** Null when the current price is blank or invalid. */
  price: number | null;
  /** Fraction, rounded to 0.1%. Null when price is null. */
  upside: number | null;
}

export type ValuationCheck =
  | { ok: true; value: DisplayedValuation; errors: FieldErrors }
  | { ok: false; errors: FieldErrors };

/** Validate, then round to what's displayed. Rejects values that round to zero. */
function displayedInput(value: number | null, field: ValuationField): number {
  requirePositive(value, field);
  const rounded = roundTo(value as number, VALUE_DP);
  if (rounded <= 0) {
    throw new ValuationError(field, `${labels[field].name} must be at least 0.01.`);
  }
  return rounded;
}

function attempt<T>(errors: FieldErrors, run: () => T): T | null {
  try {
    return run();
  } catch (error) {
    if (error instanceof ValuationError) {
      errors[error.field] ??= error.message;
      return null;
    }
    throw error;
  }
}

/**
 * The numbers the calculator shows, computed from the rounded values on screen
 * so that every "show the math" line adds up exactly:
 * target = shown EPS × shown P/E (to the cent);
 * upside = (shown target − shown price) ÷ shown price (to 0.1%).
 * The target needs EPS and P/E; upside also needs the price.
 */
export function displayedValuation(input: {
  price: number | null;
  eps: number | null;
  pe: number | null;
}): ValuationCheck {
  const errors: FieldErrors = {};
  const eps = attempt(errors, () => displayedInput(input.eps, 'eps'));
  const pe = attempt(errors, () => displayedInput(input.pe, 'pe'));
  const price = attempt(errors, () => displayedInput(input.price, 'price'));
  if (eps === null || pe === null) return { ok: false, errors };
  const target = roundTo(targetPrice(eps, pe), VALUE_DP);
  const up = price === null ? null : roundTo(upside(target, price), UPSIDE_DP);
  return { ok: true, value: { eps, pe, target, price, upside: up }, errors };
}

export interface DisplayedSensitivity {
  /** Row headings, ascending. */
  epsAxis: number[];
  /** Column headings, ascending. */
  peAxis: number[];
  /** grid[row][col], rounded to the cent. */
  grid: number[][];
  /** Position of the student's own EPS and P/E. */
  centerRow: number;
  centerCol: number;
}

/**
 * 5×5 grid around the shown EPS and P/E. Axis values are rounded as shown and
 * each cell is shown EPS × shown P/E, so the center equals the shown target.
 */
export function displayedSensitivity(eps: number, pe: number): DisplayedSensitivity {
  const epsAxis = sensitivityAxis(eps, { field: 'eps' }).map((v) => roundTo(v, VALUE_DP));
  const peAxis = sensitivityAxis(pe, { field: 'pe' }).map((v) => roundTo(v, VALUE_DP));
  const grid = sensitivity(epsAxis, peAxis).map((row) => row.map((v) => roundTo(v, VALUE_DP)));
  const center = SENSITIVITY_STEPS.indexOf(0);
  return { epsAxis, peAxis, grid, centerRow: center, centerCol: center };
}

export interface DisplayedPeers {
  /** One message (or null) per row typed, blank rows included. */
  rowErrors: (string | null)[];
  /** Usable peer P/Es as shown, in the order typed. */
  values: number[];
  /** Stats from the shown values, each rounded as shown. Null if no usable peers. */
  stats: PeerStats | null;
}

/** Peer P/E rows as typed. Blank rows are ignored; bad rows get a message. */
export function displayedPeers(rows: string[]): DisplayedPeers {
  const rowErrors: (string | null)[] = [];
  const values: number[] = [];
  rows.forEach((row, i) => {
    const parsed = parseNumberInput(row);
    if (parsed === null) {
      rowErrors.push(null);
      return;
    }
    try {
      requirePositive(parsed, 'peers', `Peer ${i + 1} P/E`);
      const rounded = roundTo(parsed, VALUE_DP);
      if (rounded <= 0) throw new ValuationError('peers', `Peer ${i + 1} P/E must be at least 0.01.`);
      values.push(rounded);
      rowErrors.push(null);
    } catch (error) {
      if (!(error instanceof ValuationError)) throw error;
      rowErrors.push(error.message);
    }
  });
  if (values.length === 0) return { rowErrors, values, stats: null };
  const raw = peerStats(values);
  return {
    rowErrors,
    values,
    stats: {
      count: raw.count,
      average: roundTo(raw.average, VALUE_DP),
      median: roundTo(raw.median, VALUE_DP),
    },
  };
}

/** Saved through storage.ts, so the real key is "ghic-pe-calculator". */
export const PE_KEY = 'pe-calculator';

/** What the calculator saves: the text in each box, exactly as typed. */
export interface PECalculatorState {
  price: string;
  eps: string;
  pe: string;
  peers: string[];
}

export function emptyPECalculator(): PECalculatorState {
  return { price: '', eps: '', pe: '', peers: [] };
}

/** Most peer rows kept from saved data. */
export const MAX_PEERS = 20;

/** Turn saved data back into calculator state. Anything malformed is reset. */
export function parsePECalculator(raw: unknown): PECalculatorState {
  const state = emptyPECalculator();
  if (typeof raw !== 'object' || raw === null) return state;
  const { price, eps, pe, peers } = raw as Record<string, unknown>;
  if (typeof price === 'string') state.price = price;
  if (typeof eps === 'string') state.eps = eps;
  if (typeof pe === 'string') state.pe = pe;
  if (Array.isArray(peers)) {
    state.peers = peers.filter((p): p is string => typeof p === 'string').slice(0, MAX_PEERS);
  }
  return state;
}

/** Short result label, e.g. "17.0% upside", "3.1% downside", "No upside or downside". */
export function upsideLabel(fraction: number): string {
  if (fraction === 0) return 'No upside or downside';
  return `${formatPercent(Math.abs(fraction))} ${fraction > 0 ? 'upside' : 'downside'}`;
}

/**
 * The formulas with the student's shown numbers filled in, one line each.
 * Every number comes from the same rounded values displayed elsewhere.
 */
export function mathLines(value: DisplayedValuation, peers: DisplayedPeers | null = null): string[] {
  const lines = [
    `Target price = forecast EPS × target P/E = ${formatCurrency(value.eps)} × ${formatMultiple(value.pe)} = ${formatCurrency(value.target)}`,
  ];
  if (value.price !== null && value.upside !== null) {
    const t = formatCurrency(value.target);
    const p = formatCurrency(value.price);
    lines.push(
      `Upside or downside = (target price − current price) ÷ current price = (${t} − ${p}) ÷ ${p} = ${formatPercent(value.upside)}`,
    );
  }
  if (peers?.stats) {
    lines.push(...peerMathLines(peers));
  }
  return lines;
}

/** Peer average and median with the shown peer values filled in. */
export function peerMathLines(peers: DisplayedPeers): string[] {
  if (!peers.stats) return [];
  const { count, average, median } = peers.stats;
  const listed = peers.values.map((v) => formatMultiple(v));
  const sorted = [...peers.values].sort((a, b) => a - b).map((v) => formatMultiple(v));
  return [
    `Peer average P/E = (${listed.join(' + ')}) ÷ ${count} = ${formatMultiple(average)}`,
    `Peer median P/E = middle of ${sorted.join(', ')} = ${formatMultiple(median)}`,
  ];
}
