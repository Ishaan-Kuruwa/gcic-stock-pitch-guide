/**
 * A small cookie that tells prerendered pages (which the server builds once,
 * for everyone) who is signed in, so the header can show their first name.
 * It holds only a first name and which page the name links to. It grants
 * nothing: every account page checks the real session on the server.
 */
export const NAV_HINT_COOKIE = 'ghic_nav';
/** Same as Better Auth's default session length: 7 days. */
export const NAV_HINT_MAX_AGE = 60 * 60 * 24 * 7;
export const NAV_HINT_HREFS = ['/account', '/admin/mentors'] as const;
const MAX_NAME = 40;

export interface NavHint {
  name: string;
  href: (typeof NAV_HINT_HREFS)[number];
}

export function encodeNavHint(hint: NavHint): string {
  return encodeURIComponent(JSON.stringify({ n: hint.name.slice(0, MAX_NAME), h: hint.href }));
}

/** Parse a raw cookie value. Anything odd → null. */
export function decodeNavHint(value: string | undefined | null): NavHint | null {
  if (!value) return null;
  try {
    const data: unknown = JSON.parse(decodeURIComponent(value));
    if (!data || typeof data !== 'object') return null;
    const { n, h } = data as Record<string, unknown>;
    if (typeof n !== 'string' || n.trim() === '') return null;
    if (typeof h !== 'string' || !(NAV_HINT_HREFS as readonly string[]).includes(h)) return null;
    return { name: n.trim().slice(0, MAX_NAME), href: h as NavHint['href'] };
  } catch {
    return null;
  }
}

/** Find and parse the hint in a `document.cookie` string. */
export function readNavHint(cookieString: string): NavHint | null {
  for (const part of cookieString.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === NAV_HINT_COOKIE) return decodeNavHint(part.slice(eq + 1).trim());
  }
  return null;
}
