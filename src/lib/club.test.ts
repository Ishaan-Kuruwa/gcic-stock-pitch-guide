import { describe, expect, it } from 'vitest';
import { templates } from '../data/club';

describe('club templates', () => {
  it.each(Object.entries(templates))('%s is a Google Docs "make a copy" link', (_id, t) => {
    const url = new URL(t.url);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('docs.google.com');
    expect(url.pathname).toMatch(/^\/(spreadsheets|presentation)\/d\/[\w-]+\/copy$/);
    expect(t.label).toMatch(/Template$/);
  });
});
