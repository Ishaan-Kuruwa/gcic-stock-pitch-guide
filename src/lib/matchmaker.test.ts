import { describe, expect, it } from 'vitest';
import { companies, interests, type Company } from '../data/matchmaker';
import {
  MAX_INTERESTS,
  MAX_RESULTS,
  matchCompanies,
  parseShortlist,
  shortlistText,
  toggleInterest,
  toggleShortlist,
} from './matchmaker';

const tickers = (list: Company[]) => list.map((c) => c.ticker);

describe('matchmaker data', () => {
  it('has 12 interests and 36 companies', () => {
    expect(interests).toHaveLength(12);
    expect(companies).toHaveLength(36);
  });

  it('has unique tickers', () => {
    expect(new Set(companies.map((c) => c.ticker)).size).toBe(companies.length);
  });

  it('gives every interest at least one company', () => {
    for (const { id } of interests) {
      expect(companies.some((c) => c.interest === id)).toBe(true);
    }
  });
});

describe('toggleInterest', () => {
  it('adds in pick order and removes on a second tap', () => {
    let r = toggleInterest([], 'food');
    r = toggleInterest(r.picked, 'games');
    expect(r).toEqual({ picked: ['food', 'games'], atLimit: false });
    expect(toggleInterest(r.picked, 'food')).toEqual({ picked: ['games'], atLimit: false });
  });

  it(`stops at ${MAX_INTERESTS} and reports the limit`, () => {
    const full = ['food', 'games', 'ai'] as const;
    expect(toggleInterest(full, 'cars')).toEqual({ picked: ['food', 'games', 'ai'], atLimit: true });
  });

  it('still lets you unpick when full', () => {
    expect(toggleInterest(['food', 'games', 'ai'], 'ai')).toEqual({ picked: ['food', 'games'], atLimit: false });
  });

  it('does not change the input array', () => {
    const picked = ['food' as const];
    toggleInterest(picked, 'games');
    expect(picked).toEqual(['food']);
  });
});

describe('matchCompanies', () => {
  it('returns nothing when no interests are picked', () => {
    expect(matchCompanies(companies, [], 'both')).toEqual([]);
  });

  it('returns every company for one interest, in data order', () => {
    expect(tickers(matchCompanies(companies, ['shoes'], 'both'))).toEqual(['NKE', 'LULU', 'DECK', 'ONON']);
  });

  it('filters by style', () => {
    expect(tickers(matchCompanies(companies, ['shoes'], 'riser'))).toEqual(['DECK', 'ONON']);
    expect(tickers(matchCompanies(companies, ['shoes'], 'giant'))).toEqual(['NKE', 'LULU']);
  });

  it('ignores the style when it would leave nothing', () => {
    // Live Nation and Dick's are both household names.
    expect(tickers(matchCompanies(companies, ['live'], 'riser'))).toEqual(['LYV', 'DKS']);
  });

  it('keeps the style when only some interests have that style', () => {
    expect(tickers(matchCompanies(companies, ['live', 'shoes'], 'riser'))).toEqual(['DECK', 'ONON']);
  });

  it('interleaves across interests in pick order', () => {
    expect(tickers(matchCompanies(companies, ['stream', 'beauty'], 'both'))).toEqual([
      'NFLX',
      'ULTA',
      'DIS',
      'ELF',
      'SPOT',
    ]);
  });

  it(`caps results at ${MAX_RESULTS}`, () => {
    const result = matchCompanies(companies, ['shoes', 'food', 'shop'], 'both');
    expect(result).toHaveLength(MAX_RESULTS);
    expect(tickers(result)).toEqual(['NKE', 'MCD', 'AMZN', 'LULU', 'SBUX', 'COST', 'DECK', 'CMG']);
  });

  it('accepts a custom cap', () => {
    expect(matchCompanies(companies, ['shoes'], 'both', 2)).toHaveLength(2);
    expect(matchCompanies(companies, ['shoes'], 'both', -1)).toEqual([]);
  });
});

describe('toggleShortlist', () => {
  it('adds to the end and removes on a second tap', () => {
    expect(toggleShortlist(['NKE'], 'AAPL')).toEqual(['NKE', 'AAPL']);
    expect(toggleShortlist(['NKE', 'AAPL'], 'NKE')).toEqual(['AAPL']);
  });
});

describe('parseShortlist', () => {
  it('keeps known tickers once each, in order', () => {
    expect(parseShortlist(['NKE', 'FAKE', 'AAPL', 'NKE', 3, null], companies)).toEqual(['NKE', 'AAPL']);
  });

  it('gives an empty list for anything that is not an array', () => {
    expect(parseShortlist(undefined, companies)).toEqual([]);
    expect(parseShortlist('NKE', companies)).toEqual([]);
    expect(parseShortlist({ 0: 'NKE' }, companies)).toEqual([]);
  });
});

describe('shortlistText', () => {
  it('lists ticker and name, using GHIC', () => {
    expect(shortlistText(['NKE', 'MCD'], companies)).toBe(
      'My GHIC stock pitch shortlist: NKE (Nike), MCD (McDonald’s)',
    );
  });

  it('skips unknown tickers', () => {
    expect(shortlistText(['NOPE', 'NKE'], companies)).toBe('My GHIC stock pitch shortlist: NKE (Nike)');
  });
});
