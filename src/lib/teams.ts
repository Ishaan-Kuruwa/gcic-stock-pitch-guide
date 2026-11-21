/**
 * Team rules: join codes, form checks and the link rule. Pure functions; the
 * queries live in src/db/teams.ts and the pages only render.
 */
import { TEAM_LINK_KINDS, type MentorshipStatus, type TeamLinkKind } from '../db/schema';

export { TEAM_LINK_KINDS, type TeamLinkKind };

// ---------------------------------------------------------------------------
// Join codes
// ---------------------------------------------------------------------------

/** Capital letters and digits without look-alikes: no 0/O and no 1/I/L. */
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;

/** Wrong join codes allowed per account per hour (window from src/lib/clubCode.ts). */
export const MAX_JOIN_TRIES = 10;

type RandomFill = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
const cryptoFill: RandomFill = (bytes) => crypto.getRandomValues(bytes);

/**
 * A new random join code. Bytes at or above the largest multiple of the
 * alphabet size are thrown away, so every character is equally likely.
 */
export function generateJoinCode(fill: RandomFill = cryptoFill): string {
  const size = JOIN_CODE_ALPHABET.length;
  const limit = 256 - (256 % size);
  let code = '';
  while (code.length < JOIN_CODE_LENGTH) {
    for (const byte of fill(new Uint8Array(16))) {
      if (byte < limit) code += JOIN_CODE_ALPHABET[byte % size];
      if (code.length === JOIN_CODE_LENGTH) break;
    }
  }
  return code;
}

/** " ab-c d23 " → "ABCD23": capital letters, spaces and dashes don't matter. */
export function normalizeJoinCode(input: string): string {
  return input.replace(/[\s-]+/g, '').toUpperCase();
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export const MAX_TEAM_NAME = 60;
export const MAX_COMPANY = 100;
export const MAX_TICKER = 10;
export const MAX_LINK_LENGTH = 2000;

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

function field(form: FormData, name: string): string {
  const raw = form.get(name);
  return typeof raw === 'string' ? raw : '';
}

/** Trims and collapses spaces. */
function clean(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export function parseTeamName(raw: string): FieldResult<string> {
  const name = clean(raw);
  if (name === '') return { ok: false, error: 'Enter a team name.' };
  if (name.length > MAX_TEAM_NAME) {
    return { ok: false, error: `Keep the team name to ${MAX_TEAM_NAME} characters or fewer.` };
  }
  return { ok: true, value: name };
}

/** Company name. Empty means "not chosen yet" (null). */
export function parseCompany(raw: string): FieldResult<string | null> {
  const company = clean(raw);
  if (company === '') return { ok: true, value: null };
  if (company.length > MAX_COMPANY) {
    return { ok: false, error: `Keep the company name to ${MAX_COMPANY} characters or fewer.` };
  }
  return { ok: true, value: company };
}

/** Ticker, uppercased. Letters and dots only (BRK.B). Empty → null. */
export function parseTicker(raw: string): FieldResult<string | null> {
  const ticker = raw.trim().toUpperCase();
  if (ticker === '') return { ok: true, value: null };
  if (!/^[A-Z.]+$/.test(ticker)) {
    return { ok: false, error: 'A ticker can only have letters and dots, like AAPL or BRK.B.' };
  }
  if (ticker.length > MAX_TICKER) {
    return { ok: false, error: `Keep the ticker to ${MAX_TICKER} characters or fewer.` };
  }
  return { ok: true, value: ticker };
}

export type DetailsErrors = Partial<Record<'company' | 'ticker', string>>;
export type DetailsParse =
  | { ok: true; value: { company: string | null; ticker: string | null } }
  | { ok: false; errors: DetailsErrors };

/** The company and ticker form on /team/[id]. */
export function parseDetailsForm(form: FormData): DetailsParse {
  const company = parseCompany(field(form, 'company'));
  const ticker = parseTicker(field(form, 'ticker'));
  const errors: DetailsErrors = {};
  if (!company.ok) errors.company = company.error;
  if (!ticker.ok) errors.ticker = ticker.error;
  if (!company.ok || !ticker.ok) return { ok: false, errors };
  return { ok: true, value: { company: company.value, ticker: ticker.value } };
}

// ---------------------------------------------------------------------------
// Links to the team's own files
// ---------------------------------------------------------------------------

export const teamLinkLabels: Record<TeamLinkKind, string> = {
  report: 'Report',
  slides: 'Slides',
  financials: 'Financials',
  comps: 'Comps',
  video: 'Video',
};

/**
 * Hosts a team link may point to: Google Docs and Drive, and YouTube.
 * www. and m.youtube.com are the same site as youtube.com.
 */
export const ALLOWED_LINK_HOSTS = [
  'docs.google.com',
  'drive.google.com',
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
] as const;

/** The rule in words, shown above the links form. */
export const LINK_RULE =
  'Links must start with https:// and be on docs.google.com, drive.google.com, youtube.com or youtu.be.';

/** A link to the team's own file. Empty means "no link" (null). */
export function parseTeamLink(raw: string): FieldResult<string | null> {
  const text = raw.trim();
  if (text === '') return { ok: true, value: null };
  const error = LINK_RULE;
  if (text.length > MAX_LINK_LENGTH) return { ok: false, error: 'That link is too long.' };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error };
  }
  if (url.protocol !== 'https:') return { ok: false, error };
  if (url.username || url.password || url.port) return { ok: false, error };
  if (!(ALLOWED_LINK_HOSTS as readonly string[]).includes(url.hostname)) return { ok: false, error };
  return { ok: true, value: url.href };
}

export type LinksParse =
  | { ok: true; value: Record<TeamLinkKind, string | null> }
  | { ok: false; errors: Partial<Record<TeamLinkKind, string>>; values: Record<TeamLinkKind, string> };

/** The links form on /team/[id]: one field per kind, named `link-<kind>`. */
export function parseLinksForm(form: FormData): LinksParse {
  const value = {} as Record<TeamLinkKind, string | null>;
  const values = {} as Record<TeamLinkKind, string>;
  const errors: Partial<Record<TeamLinkKind, string>> = {};
  for (const kind of TEAM_LINK_KINDS) {
    const raw = field(form, `link-${kind}`);
    values[kind] = raw;
    const parsed = parseTeamLink(raw);
    if (parsed.ok) value[kind] = parsed.value;
    else errors[kind] = `${teamLinkLabels[kind]}: ${parsed.error}`;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors, values };
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export const mentorshipLabels: Record<MentorshipStatus, string> = {
  'self-guided': 'Self-guided (no mentor)',
  applied: 'Applied for a mentor',
  mentored: 'Has a mentor',
  declined: 'Mentor request declined',
};
