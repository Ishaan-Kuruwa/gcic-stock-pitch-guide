import { describe, expect, it } from 'vitest';
import { limits } from '../data/competition';
import { isLockedOut, minutesUntilRetry, triesLeft } from './clubCode';
import {
  ALLOWED_LINK_HOSTS,
  generateJoinCode,
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  MAX_JOIN_TRIES,
  MAX_TEAM_NAME,
  normalizeJoinCode,
  parseDetailsForm,
  parseLinksForm,
  parseTeamLink,
  parseTeamName,
  parseTicker,
} from './teams';

describe('team size', () => {
  it('comes from competition.ts', () => expect(limits.maxTeamSize).toBe(2));
});

describe('join codes', () => {
  it('the alphabet has no look-alikes', () => {
    for (const c of '0O1IL') expect(JOIN_CODE_ALPHABET).not.toContain(c);
    expect(new Set(JOIN_CODE_ALPHABET).size).toBe(JOIN_CODE_ALPHABET.length);
  });

  it('generates 6 characters from the alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode();
      expect(code).toHaveLength(JOIN_CODE_LENGTH);
      for (const c of code) expect(JOIN_CODE_ALPHABET).toContain(c);
    }
  });

  it('skips biased bytes', () => {
    // 248 = 8 × 31 is the cutoff: 250 and 255 are thrown away.
    const bytes = [255, 250, 0, 1, 30, 31, 247, 62];
    const fill = (b: Uint8Array<ArrayBuffer>) => {
      b.set(bytes.slice(0, b.length));
      return b;
    };
    expect(generateJoinCode(fill)).toBe('AB9A9A');
  });

  it('normalizes case, spaces and dashes', () => {
    expect(normalizeJoinCode(' ab-c d23 ')).toBe('ABCD23');
  });
});

describe('form fields', () => {
  it('team name: required, spaces collapsed, at most 60 characters', () => {
    expect(parseTeamName('  The   Bulls ')).toEqual({ ok: true, value: 'The Bulls' });
    expect(parseTeamName('   ').ok).toBe(false);
    expect(parseTeamName('x'.repeat(MAX_TEAM_NAME)).ok).toBe(true);
    expect(parseTeamName('x'.repeat(MAX_TEAM_NAME + 1)).ok).toBe(false);
  });

  it('ticker: uppercased, letters and dots only, empty allowed', () => {
    expect(parseTicker(' brk.b ')).toEqual({ ok: true, value: 'BRK.B' });
    expect(parseTicker('')).toEqual({ ok: true, value: null });
    expect(parseTicker('AAPL1').ok).toBe(false);
    expect(parseTicker('NAS:AAPL').ok).toBe(false);
    expect(parseTicker('A'.repeat(11)).ok).toBe(false);
  });

  it('details form collects both errors', () => {
    const form = new FormData();
    form.set('company', 'x'.repeat(101));
    form.set('ticker', '12');
    const parsed = parseDetailsForm(form);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(Object.keys(parsed.errors).sort()).toEqual(['company', 'ticker']);
  });
});

describe('team links', () => {
  it.each([
    'https://docs.google.com/document/d/abc/edit',
    'https://drive.google.com/file/d/abc/view',
    'https://youtube.com/watch?v=abc',
    'https://www.youtube.com/watch?v=abc',
    'https://m.youtube.com/watch?v=abc',
    'https://youtu.be/abc',
  ])('accepts %s', (url) => {
    expect(parseTeamLink(url)).toEqual({ ok: true, value: url });
  });

  it('covers every allowed host', () => {
    for (const host of ALLOWED_LINK_HOSTS) expect(parseTeamLink(`https://${host}/x`).ok).toBe(true);
  });

  it.each([
    'http://docs.google.com/document/d/abc',
    'https://example.com/doc',
    'https://google.com/docs',
    'https://sheets.google.com/x',
    'https://docs.google.com.evil.com/x',
    'https://evil.com/docs.google.com',
    'https://user:pass@docs.google.com/x',
    'https://docs.google.com:8443/x',
    'javascript:alert(1)',
    'docs.google.com/document/d/abc',
    'not a link',
  ])('rejects %s', (url) => {
    expect(parseTeamLink(url).ok).toBe(false);
  });

  it('empty means no link', () => expect(parseTeamLink('  ')).toEqual({ ok: true, value: null }));

  it('links form: one error per bad field, labelled by kind', () => {
    const form = new FormData();
    form.set('link-report', 'https://docs.google.com/document/d/r');
    form.set('link-video', 'http://youtu.be/v');
    const parsed = parseLinksForm(form);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(Object.keys(parsed.errors)).toEqual(['video']);
      expect(parsed.errors.video).toMatch(/^Video: /);
      expect(parsed.values.report).toBe('https://docs.google.com/document/d/r');
    }
  });
});

describe('join-code rate limit', () => {
  const now = new Date('2026-12-01T12:00:00Z');
  const ago = (m: number) => new Date(now.getTime() - m * 60_000);
  it('allows 10 wrong codes per hour, then locks', () => {
    const nine = Array.from({ length: 9 }, (_, i) => ago(i + 1));
    expect(isLockedOut(nine, now, MAX_JOIN_TRIES)).toBe(false);
    expect(triesLeft(nine, now, MAX_JOIN_TRIES)).toBe(1);
    const ten = [...nine, ago(30)];
    expect(isLockedOut(ten, now, MAX_JOIN_TRIES)).toBe(true);
    expect(minutesUntilRetry(ten, now, MAX_JOIN_TRIES)).toBe(30);
    expect(isLockedOut([...nine, ago(61)], now, MAX_JOIN_TRIES)).toBe(false);
  });
});
