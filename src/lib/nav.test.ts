import { describe, expect, it } from 'vitest';
import { isCurrentPath, normalizePath } from './nav';

describe('normalizePath', () => {
  it('strips trailing slashes', () => {
    expect(normalizePath('/learn/')).toBe('/learn');
    expect(normalizePath('/learn//')).toBe('/learn');
    expect(normalizePath('/learn')).toBe('/learn');
  });

  it('keeps the root as "/"', () => {
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
  });
});

describe('isCurrentPath', () => {
  it('matches with or without a trailing slash', () => {
    expect(isCurrentPath('/learn', '/learn')).toBe(true);
    expect(isCurrentPath('/learn/', '/learn')).toBe(true);
    expect(isCurrentPath('/learn', '/learn/')).toBe(true);
  });

  it('matches pages inside a section', () => {
    expect(isCurrentPath('/learn/valuation/', '/learn')).toBe(true);
  });

  it('does not match a different page that shares a prefix', () => {
    expect(isCurrentPath('/learning', '/learn')).toBe(false);
    expect(isCurrentPath('/tools', '/learn')).toBe(false);
  });

  it('only matches home on the home page', () => {
    expect(isCurrentPath('/', '/')).toBe(true);
    expect(isCurrentPath('/learn', '/')).toBe(false);
  });
});
