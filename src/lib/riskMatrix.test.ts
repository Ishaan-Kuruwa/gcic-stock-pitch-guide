import { describe, expect, it } from 'vitest';
import {
  RISK_KEY,
  addRisk,
  nextRiskId,
  parseRisks,
  ratingLabel,
  removeRisk,
  riskGrid,
  riskScore,
  riskTableText,
  sortRisks,
  updateRisk,
  type Rating,
  type Risk,
} from './riskMatrix';
import { createStore, type StorageLike } from './storage';

function risk(id: string, likelihood: Rating | null, impact: Rating | null, text = id): Risk {
  return { id, text, likelihood, impact, mitigant: `m-${id}` };
}

describe('riskScore', () => {
  it('multiplies likelihood by impact', () => {
    expect(riskScore({ likelihood: 3, impact: 2 })).toBe(6);
    expect(riskScore({ likelihood: 1, impact: 1 })).toBe(1);
  });

  it('is null until both are rated', () => {
    expect(riskScore({ likelihood: null, impact: 3 })).toBeNull();
    expect(riskScore({ likelihood: 2, impact: null })).toBeNull();
  });
});

describe('ratingLabel', () => {
  it('names each rating', () => {
    expect([1, 2, 3, null].map((r) => ratingLabel(r as Rating | null))).toEqual([
      'Low',
      'Medium',
      'High',
      'Not rated',
    ]);
  });
});

describe('add, update, remove', () => {
  it('adds a blank, unrated risk with a fresh id', () => {
    const list = addRisk(addRisk([]));
    expect(list).toEqual([
      { id: 'risk-1', text: '', likelihood: null, impact: null, mitigant: '' },
      { id: 'risk-2', text: '', likelihood: null, impact: null, mitigant: '' },
    ]);
  });

  it('never reuses an id after a removal', () => {
    const list = removeRisk(addRisk(addRisk([])), 'risk-1');
    expect(nextRiskId(list)).toBe('risk-3');
  });

  it('updates only the matching risk', () => {
    const list = updateRisk([risk('a', 1, 1), risk('b', 1, 1)], 'b', { text: 'New', impact: 3 });
    expect(list[0]).toEqual(risk('a', 1, 1));
    expect(list[1]).toEqual({ ...risk('b', 1, 1), text: 'New', impact: 3 });
  });

  it('removes by id', () => {
    expect(removeRisk([risk('a', 1, 1), risk('b', 2, 2)], 'a').map((r) => r.id)).toEqual(['b']);
  });
});

describe('sortRisks', () => {
  it('puts the highest likelihood x impact first', () => {
    const sorted = sortRisks([risk('low', 1, 2), risk('high', 3, 3), risk('mid', 2, 2)]);
    expect(sorted.map((r) => r.id)).toEqual(['high', 'mid', 'low']);
  });

  it('breaks score ties by impact, then entry order', () => {
    const sorted = sortRisks([risk('a', 3, 1), risk('b', 1, 3), risk('c', 3, 1)]);
    expect(sorted.map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('puts unrated risks last, in entry order', () => {
    const sorted = sortRisks([risk('u1', null, 3), risk('r', 1, 1), risk('u2', 2, null)]);
    expect(sorted.map((r) => r.id)).toEqual(['r', 'u1', 'u2']);
  });

  it('does not change the input', () => {
    const input = [risk('a', 1, 1), risk('b', 3, 3)];
    sortRisks(input);
    expect(input.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('riskGrid', () => {
  it('places rated risks by rank, High likelihood on top and Low impact on the left', () => {
    const sorted = sortRisks([risk('a', 3, 3), risk('b', 1, 1), risk('c', 3, 3), risk('u', null, 2)]);
    const grid = riskGrid(sorted);
    expect(grid.map((row) => row.map((c) => [c.likelihood, c.impact]))).toEqual([
      [
        [3, 1],
        [3, 2],
        [3, 3],
      ],
      [
        [2, 1],
        [2, 2],
        [2, 3],
      ],
      [
        [1, 1],
        [1, 2],
        [1, 3],
      ],
    ]);
    expect(grid[0]![2]!.ranks).toEqual([1, 2]);
    expect(grid[2]![0]!.ranks).toEqual([3]);
    const placed = grid.flat().reduce((n, c) => n + c.ranks.length, 0);
    expect(placed).toBe(3);
  });
});

describe('riskTableText', () => {
  it('is a tab-separated table of exactly what the student typed', () => {
    const sorted = sortRisks([
      { id: 'a', text: 'Line one\nline two', likelihood: 2, impact: 3, mitigant: 'Has\tcash' },
      risk('b', null, 1, 'Unrated'),
    ]);
    expect(riskTableText(sorted)).toBe(
      [
        '#\tRisk\tLikelihood\tImpact\tScore\tMitigant',
        '1\tLine one line two\tMedium\tHigh\t6\tHas cash',
        '2\tUnrated\tNot rated\tLow\t\tm-b',
      ].join('\n'),
    );
  });

  it('is just the header with no risks', () => {
    expect(riskTableText([])).toBe('#\tRisk\tLikelihood\tImpact\tScore\tMitigant');
  });
});

describe('parseRisks and saving', () => {
  it('drops junk and resets bad fields', () => {
    expect(parseRisks(null)).toEqual([]);
    expect(
      parseRisks([
        { id: 'a', text: 'T', likelihood: 4, impact: 2, mitigant: 5 },
        { id: 'a', text: 'duplicate' },
        { text: 'no id' },
        'nope',
      ]),
    ).toEqual([{ id: 'a', text: 'T', likelihood: null, impact: 2, mitigant: '' }]);
  });

  it('survives a reload', () => {
    const map = new Map<string, string>();
    const backing: StorageLike = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
    };
    const list = [risk('risk-1', 2, 3), risk('risk-2', null, null)];
    expect(createStore(() => backing).setJson(RISK_KEY, list)).toBe(true);
    expect(parseRisks(createStore(() => backing).getJson(RISK_KEY))).toEqual(list);
  });

  it('works in memory when storage is blocked', () => {
    const store = createStore(() => {
      throw new Error('blocked');
    });
    const list = [risk('risk-1', 1, 2)];
    expect(store.setJson(RISK_KEY, list)).toBe(false);
    expect(parseRisks(store.getJson(RISK_KEY))).toEqual(list);
  });
});
