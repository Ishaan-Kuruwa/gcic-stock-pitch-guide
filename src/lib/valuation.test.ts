import { describe, expect, it } from 'vitest';
import { formatCurrency, formatPercent } from './format';
import { createStore, type StorageLike } from './storage';
import {
  SENSITIVITY_STEPS,
  ValuationError,
  displayedPeers,
  displayedSensitivity,
  displayedValuation,
  emptyPECalculator,
  mathLines,
  peerMathLines,
  upsideLabel,
  parseNumberInput,
  parsePECalculator,
  peerStats,
  roundTo,
  sensitivity,
  sensitivityAxis,
  targetPrice,
  upside,
  type ValuationField,
} from './valuation';

/** Run `fn`, expect a ValuationError, and return it. */
function rejects(fn: () => unknown): ValuationError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ValuationError);
    return error as ValuationError;
  }
  throw new Error('Expected a ValuationError, but nothing was thrown.');
}

function expectRejects(fn: () => unknown, field: ValuationField, message: string | RegExp) {
  const error = rejects(fn);
  expect(error.field).toBe(field);
  if (typeof message === 'string') expect(error.message).toBe(message);
  else expect(error.message).toMatch(message);
}

// Simulates values that arrive untyped (e.g. from a form) to check runtime guards.
const loose = <T>(value: unknown) => value as T;

describe('targetPrice', () => {
  it('multiplies forecast EPS by target P/E', () => {
    expect(targetPrice(5, 20)).toBe(100);
    expect(targetPrice(5.2, 18)).toBeCloseTo(93.6, 10);
    expect(targetPrice(0.37, 41.5)).toBeCloseTo(15.355, 10);
  });

  it('handles very small and very large values', () => {
    expect(targetPrice(0.01, 0.5)).toBeCloseTo(0.005, 12);
    expect(targetPrice(1_000, 250)).toBe(250_000);
  });

  it('rejects a zero or negative P/E', () => {
    expectRejects(() => targetPrice(5, 0), 'pe', 'Target P/E must be greater than zero.');
    expectRejects(() => targetPrice(5, -12), 'pe', 'Target P/E must be greater than zero.');
    expectRejects(() => targetPrice(5, -0), 'pe', 'Target P/E must be greater than zero.');
  });

  it('rejects a missing P/E', () => {
    expectRejects(() => targetPrice(5, loose(null)), 'pe', 'Enter a target P/E.');
    expectRejects(() => targetPrice(5, loose(undefined)), 'pe', 'Enter a target P/E.');
  });

  it('rejects a P/E that is not a real number', () => {
    for (const bad of [NaN, Infinity, -Infinity, loose<number>('18')]) {
      expectRejects(() => targetPrice(5, bad), 'pe', 'Target P/E must be a number.');
    }
  });

  it('rejects a zero or negative EPS', () => {
    const message = 'Forecast EPS must be greater than zero. A P/E target price needs positive earnings.';
    expectRejects(() => targetPrice(0, 20), 'eps', message);
    expectRejects(() => targetPrice(-1.5, 20), 'eps', message);
  });

  it('rejects a missing or non-numeric EPS', () => {
    expectRejects(() => targetPrice(loose(null), 20), 'eps', 'Enter a forecast EPS.');
    expectRejects(() => targetPrice(loose(undefined), 20), 'eps', 'Enter a forecast EPS.');
    for (const bad of [NaN, Infinity, -Infinity]) {
      expectRejects(() => targetPrice(bad, 20), 'eps', 'Forecast EPS must be a number.');
    }
  });

  it('reports EPS first when both are bad', () => {
    expect(rejects(() => targetPrice(0, 0)).field).toBe('eps');
  });
});

describe('upside', () => {
  it('is positive when the target is above the price', () => {
    expect(upside(93.6, 80)).toBeCloseTo(0.17, 10);
    expect(upside(200, 100)).toBe(1);
  });

  it('is negative (downside) when the target is below the price', () => {
    expect(upside(60, 80)).toBe(-0.25);
    expect(upside(1, 100)).toBeCloseTo(-0.99, 10);
  });

  it('is exactly zero when the target equals the price', () => {
    expect(upside(80, 80)).toBe(0);
  });

  it('rejects a zero, negative, or missing current price', () => {
    expectRejects(() => upside(100, 0), 'price', 'Current price must be greater than zero.');
    expectRejects(() => upside(100, -5), 'price', 'Current price must be greater than zero.');
    expectRejects(() => upside(100, loose(null)), 'price', 'Enter the current price.');
    expectRejects(() => upside(100, loose(undefined)), 'price', 'Enter the current price.');
    expectRejects(() => upside(100, NaN), 'price', 'Current price must be a number.');
    expectRejects(() => upside(100, Infinity), 'price', 'Current price must be a number.');
  });

  it('rejects a zero, negative, or missing target (no −100% from a blank target)', () => {
    expectRejects(() => upside(0, 80), 'target', 'Target price must be greater than zero.');
    expectRejects(() => upside(-10, 80), 'target', 'Target price must be greater than zero.');
    expectRejects(() => upside(loose(null), 80), 'target', 'Enter a target price.');
    expectRejects(() => upside(NaN, 80), 'target', 'Target price must be a number.');
  });
});

describe('sensitivity', () => {
  const eps = [4, 4.5, 5, 5.5, 6];
  const pes = [16, 18, 20, 22, 24];

  it('returns a 5×5 grid for five EPS and five P/E values', () => {
    const grid = sensitivity(eps, pes);
    expect(grid).toHaveLength(5);
    grid.forEach((row) => expect(row).toHaveLength(5));
  });

  it('puts EPS on rows and P/E on columns', () => {
    const grid = sensitivity(eps, pes);
    eps.forEach((e, r) => {
      pes.forEach((p, c) => {
        expect(grid[r][c]).toBe(targetPrice(e, p));
      });
    });
    expect(grid[0][4]).toBe(4 * 24);
    expect(grid[4][0]).toBe(6 * 16);
  });

  it('handles 1×1 and non-square grids', () => {
    expect(sensitivity([5], [20])).toEqual([[100]]);
    expect(sensitivity([1, 2], [10, 20, 30])).toEqual([
      [10, 20, 30],
      [20, 40, 60],
    ]);
  });

  it('does not change the input arrays', () => {
    const e = [6, 4];
    const p = [20, 10];
    sensitivity(e, p);
    expect(e).toEqual([6, 4]);
    expect(p).toEqual([20, 10]);
  });

  it('rejects empty or missing lists', () => {
    expectRejects(() => sensitivity([], pes), 'eps', 'Enter at least one EPS value.');
    expectRejects(() => sensitivity(eps, []), 'pe', 'Enter at least one P/E value.');
    expectRejects(() => sensitivity(loose(undefined), pes), 'eps', 'Enter at least one EPS value.');
    expectRejects(() => sensitivity(eps, loose(null)), 'pe', 'Enter at least one P/E value.');
  });

  it('names the bad entry', () => {
    expectRejects(() => sensitivity([4, 5, 0], pes), 'eps', 'EPS value 3 must be greater than zero.');
    expectRejects(() => sensitivity(eps, [16, -18]), 'pe', 'P/E value 2 must be greater than zero.');
    expectRejects(() => sensitivity(eps, [16, NaN]), 'pe', 'P/E value 2 must be a number.');
    expectRejects(() => sensitivity([4, loose(null)], pes), 'eps', 'EPS value 2 is missing.');
  });
});

describe('sensitivityAxis', () => {
  it('steps −20%, −10%, 0, +10%, +20% around the center', () => {
    const axis = sensitivityAxis(20);
    expect(axis).toHaveLength(5);
    [16, 18, 20, 22, 24].forEach((v, i) => expect(axis[i]).toBeCloseTo(v, 10));
  });

  it('puts the exact center value in the middle', () => {
    expect(sensitivityAxis(17.77)[SENSITIVITY_STEPS.indexOf(0)]).toBe(17.77);
  });

  it('is ascending and all positive, even for tiny values', () => {
    const axis = sensitivityAxis(0.01);
    expect(axis.every((v) => v > 0)).toBe(true);
    expect([...axis].sort((a, b) => a - b)).toEqual(axis);
  });

  it('accepts custom steps and sorts them', () => {
    expect(sensitivityAxis(10, { steps: [0.5, -0.5, 0] })).toEqual([5, 10, 15]);
  });

  it('rejects a center that is zero, negative, or missing', () => {
    expectRejects(() => sensitivityAxis(0), 'pe', 'Target P/E must be greater than zero.');
    expectRejects(() => sensitivityAxis(-3, { field: 'eps' }), 'eps', /greater than zero/);
    expectRejects(() => sensitivityAxis(loose(null), { field: 'eps' }), 'eps', 'Enter a forecast EPS.');
  });
});

describe('peerStats', () => {
  it('works for a single peer', () => {
    expect(peerStats([21])).toEqual({ count: 1, average: 21, median: 21 });
  });

  it('uses the middle value for an odd count', () => {
    expect(peerStats([30, 10, 20])).toEqual({ count: 3, average: 20, median: 20 });
  });

  it('averages the two middle values for an even count', () => {
    expect(peerStats([10, 40, 20, 30])).toEqual({ count: 4, average: 25, median: 25 });
    expect(peerStats([12, 100]).median).toBe(56);
  });

  it('differs from the average when there is an outlier', () => {
    const stats = peerStats([15, 16, 17, 90]);
    expect(stats.median).toBe(16.5);
    expect(stats.average).toBe(34.5);
  });

  it('handles decimals', () => {
    const stats = peerStats([17.5, 18.25, 22.1]);
    expect(stats.average).toBeCloseTo(57.85 / 3, 10);
    expect(stats.median).toBe(18.25);
  });

  it('does not reorder the input', () => {
    const pes = [30, 10, 20];
    peerStats(pes);
    expect(pes).toEqual([30, 10, 20]);
  });

  it('rejects an empty list', () => {
    expectRejects(() => peerStats([]), 'peers', 'Enter at least one Peer P/E.');
  });

  it('rejects a zero, negative, or non-numeric peer P/E', () => {
    expectRejects(() => peerStats([20, 0]), 'peers', 'Peer P/E 2 must be greater than zero.');
    expectRejects(() => peerStats([-8]), 'peers', 'Peer P/E 1 must be greater than zero.');
    expectRejects(() => peerStats([20, Infinity]), 'peers', 'Peer P/E 2 must be a number.');
  });
});

describe('parseNumberInput', () => {
  it('returns null for a blank box', () => {
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('   ')).toBeNull();
    expect(parseNumberInput('$')).toBeNull();
  });

  it('reads plain and formatted numbers', () => {
    expect(parseNumberInput('80')).toBe(80);
    expect(parseNumberInput(' 5.20 ')).toBe(5.2);
    expect(parseNumberInput('$1,234.50')).toBe(1234.5);
    expect(parseNumberInput('17.5%')).toBe(17.5);
    expect(parseNumberInput('.5')).toBe(0.5);
    expect(parseNumberInput('5.')).toBe(5);
  });

  it('keeps negatives so validation can explain them', () => {
    expect(parseNumberInput('-3')).toBe(-3);
  });

  it('returns NaN for anything that is not a number', () => {
    for (const bad of ['abc', '1.2.3', '12x', '1e3', '--4', '.']) {
      expect(parseNumberInput(bad)).toBeNaN();
    }
  });
});

describe('roundTo', () => {
  it('rounds half away from zero without float drift', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(2.675, 2)).toBe(2.68);
    expect(roundTo(-1.005, 2)).toBe(-1.01);
    expect(roundTo(0.1235, 3)).toBe(0.124);
    expect(roundTo(93.6, 2)).toBe(93.6);
  });

  it('handles very small values and leaves non-finite values alone', () => {
    expect(roundTo(1e-9, 2)).toBe(0);
    expect(roundTo(-0.001, 2)).toBe(0);
    expect(roundTo(NaN, 2)).toBeNaN();
  });
});

describe('displayedValuation', () => {
  it('computes the shown target and upside', () => {
    const check = displayedValuation({ price: 80, eps: 5.2, pe: 18 });
    expect(check).toEqual({
      ok: true,
      value: { eps: 5.2, pe: 18, target: 93.6, price: 80, upside: 0.17 },
      errors: {},
    });
  });

  it('makes every shown number add up for awkward inputs', () => {
    const check = displayedValuation({ price: 61.119, eps: 3.333, pe: 17.777 });
    if (!check.ok) throw new Error('expected ok');
    const { eps, pe, target, price, upside: up } = check.value;
    // Inputs are shown at 2 dp.
    expect([eps, pe, price]).toEqual([3.33, 17.78, 61.12]);
    // Shown target = shown EPS × shown P/E, to the cent.
    expect(target).toBe(roundTo(3.33 * 17.78, 2));
    expect(target).toBe(59.21);
    // Shown upside = (shown target − shown price) ÷ shown price, to 0.1%.
    expect(up).toBe(roundTo((target - (price as number)) / (price as number), 3));
    expect(up).toBe(-0.031);
  });

  it('keeps the shown upside consistent across many inputs', () => {
    for (let i = 1; i <= 200; i++) {
      const input = { price: 7.777 * i, eps: 0.123 * i, pe: 9.999 + i / 7 };
      const check = displayedValuation(input);
      if (!check.ok) throw new Error('expected ok');
      const v = check.value;
      expect(v.target).toBe(roundTo(v.eps * v.pe, 2));
      expect(v.upside).toBe(roundTo((v.target - (v.price as number)) / (v.price as number), 3));
    }
  });

  it('shows the target without upside when the price is blank', () => {
    const check = displayedValuation({ price: null, eps: 5, pe: 20 });
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.value.target).toBe(100);
    expect(check.value.price).toBeNull();
    expect(check.value.upside).toBeNull();
    expect(check.errors).toEqual({ price: 'Enter the current price.' });
  });

  it('collects an error for every bad field at once', () => {
    const check = displayedValuation({ price: 0, eps: null, pe: -4 });
    expect(check.ok).toBe(false);
    expect(check.errors).toEqual({
      price: 'Current price must be greater than zero.',
      eps: 'Enter a forecast EPS.',
      pe: 'Target P/E must be greater than zero.',
    });
  });

  it('rejects values that would show as 0.00', () => {
    const check = displayedValuation({ price: 0.004, eps: 0.001, pe: 0.002 });
    expect(check.ok).toBe(false);
    expect(check.errors).toEqual({
      price: 'Current price must be at least 0.01.',
      eps: 'Forecast EPS must be at least 0.01.',
      pe: 'Target P/E must be at least 0.01.',
    });
  });

  it('reports a typed non-number', () => {
    const check = displayedValuation({ price: 80, eps: NaN, pe: 18 });
    expect(check.errors.eps).toBe('Forecast EPS must be a number.');
  });
});

describe('displayedSensitivity', () => {
  it('has a 5×5 grid whose center equals the shown target', () => {
    const check = displayedValuation({ price: 61.119, eps: 3.333, pe: 17.777 });
    if (!check.ok) throw new Error('expected ok');
    const s = displayedSensitivity(check.value.eps, check.value.pe);
    expect(s.grid).toHaveLength(5);
    s.grid.forEach((row) => expect(row).toHaveLength(5));
    expect(s.epsAxis[s.centerRow]).toBe(check.value.eps);
    expect(s.peAxis[s.centerCol]).toBe(check.value.pe);
    expect(s.grid[s.centerRow][s.centerCol]).toBe(check.value.target);
  });

  it('builds every cell from the shown axis values', () => {
    const s = displayedSensitivity(3.33, 17.78);
    expect(s.epsAxis).toEqual([2.66, 3, 3.33, 3.66, 4]);
    expect(s.peAxis).toEqual([14.22, 16, 17.78, 19.56, 21.34]);
    s.epsAxis.forEach((e, r) =>
      s.peAxis.forEach((p, c) => expect(s.grid[r][c]).toBe(roundTo(e * p, 2))),
    );
  });

  it('rejects a bad center', () => {
    expectRejects(() => displayedSensitivity(0, 18), 'eps', /greater than zero/);
  });
});

describe('displayedPeers', () => {
  it('ignores blank rows and rounds stats as shown', () => {
    const peers = displayedPeers(['17', '', '18', '  ', '17']);
    expect(peers.rowErrors).toEqual([null, null, null, null, null]);
    expect(peers.values).toEqual([17, 18, 17]);
    expect(peers.stats).toEqual({ count: 3, average: 17.33, median: 17 });
  });

  it('computes stats from the shown (rounded) peer values', () => {
    const peers = displayedPeers(['10.005', '20.004']);
    expect(peers.values).toEqual([10.01, 20]);
    expect(peers.stats?.average).toBe(roundTo((10.01 + 20) / 2, 2));
    expect(peers.stats?.median).toBe(15.01);
  });

  it('gives "use average" the same rounded number that is shown', () => {
    const peers = displayedPeers(['14.1', '22.33', '19.07']);
    const shown = peers.stats?.average as number;
    expect(shown).toBe(18.5);
    // The button copies String(shown), which reads back as the same value.
    expect(parseNumberInput(String(shown))).toBe(shown);
    const median = peers.stats?.median as number;
    expect(parseNumberInput(String(median))).toBe(19.07);
  });

  it('flags bad rows by number and leaves them out', () => {
    const peers = displayedPeers(['20', '-5', 'abc', '0', '0.001', '24']);
    expect(peers.rowErrors).toEqual([
      null,
      'Peer 2 P/E must be greater than zero.',
      'Peer 3 P/E must be a number.',
      'Peer 4 P/E must be greater than zero.',
      'Peer 5 P/E must be at least 0.01.',
      null,
    ]);
    expect(peers.values).toEqual([20, 24]);
    expect(peers.stats).toEqual({ count: 2, average: 22, median: 22 });
  });

  it('has no stats when nothing usable is entered', () => {
    expect(displayedPeers([]).stats).toBeNull();
    expect(displayedPeers(['', 'x']).stats).toBeNull();
  });
});

describe('parsePECalculator', () => {
  it('reads saved state', () => {
    const saved = { price: '80', eps: '5.20', pe: '18', peers: ['17', '', '19'] };
    expect(parsePECalculator(saved)).toEqual(saved);
  });

  it('resets malformed data', () => {
    expect(parsePECalculator(null)).toEqual(emptyPECalculator());
    expect(parsePECalculator('oops')).toEqual(emptyPECalculator());
    expect(parsePECalculator({ price: 80, eps: null, pe: ['18'], peers: 'x' })).toEqual(
      emptyPECalculator(),
    );
  });

  it('drops non-string peers and caps the list', () => {
    expect(parsePECalculator({ peers: ['1', 2, null, '3'] }).peers).toEqual(['1', '3']);
    expect(parsePECalculator({ peers: Array.from({ length: 50 }, () => '1') }).peers).toHaveLength(20);
  });

  it('round-trips through a blocked store in memory', () => {
    const throwing: StorageLike = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      },
    };
    const store = createStore(() => throwing);
    const state = { price: '80', eps: '5.2', pe: '18', peers: ['17'] };
    expect(store.setJson('pe-calculator', state)).toBe(false);
    expect(parsePECalculator(store.getJson('pe-calculator'))).toEqual(state);
  });
});

describe('upsideLabel', () => {
  it('says upside, downside, or neither', () => {
    expect(upsideLabel(0.17)).toBe('17.0% upside');
    expect(upsideLabel(-0.031)).toBe('3.1% downside');
    expect(upsideLabel(0)).toBe('No upside or downside');
  });
});

describe('mathLines', () => {
  it('fills the formulas with the shown numbers', () => {
    const check = displayedValuation({ price: 80, eps: 5.2, pe: 18 });
    if (!check.ok) throw new Error('expected ok');
    expect(mathLines(check.value)).toEqual([
      'Target price = forecast EPS × target P/E = $5.20 × 18 = $93.60',
      'Upside or downside = (target price − current price) ÷ current price = ($93.60 − $80.00) ÷ $80.00 = 17.0%',
    ]);
  });

  it('adds up exactly when the copied numbers are recomputed', () => {
    const check = displayedValuation({ price: 61.119, eps: 3.333, pe: 17.777 });
    if (!check.ok) throw new Error('expected ok');
    const [targetLine, upsideLine] = mathLines(check.value);
    expect(targetLine).toBe('Target price = forecast EPS × target P/E = $3.33 × 17.78 = $59.21');
    expect(upsideLine).toBe(
      'Upside or downside = (target price − current price) ÷ current price = ($59.21 − $61.12) ÷ $61.12 = -3.1%',
    );
    // Recompute from the text a student would copy.
    const nums = (line: string) => [...line.matchAll(/-?[\d,]+\.?\d*/g)].map((m) => Number(m[0].replace(/,/g, '')));
    const [e, p, t] = nums(targetLine);
    expect(formatCurrency(roundTo(e * p, 2))).toBe(formatCurrency(t));
    const [t2, p2] = nums(upsideLine);
    expect(formatPercent(roundTo((t2 - p2) / p2, 3))).toBe(formatPercent(check.value.upside as number));
  });

  it('leaves out the upside line without a price', () => {
    const check = displayedValuation({ price: null, eps: 5, pe: 20 });
    if (!check.ok) throw new Error('expected ok');
    expect(mathLines(check.value)).toEqual(['Target price = forecast EPS × target P/E = $5.00 × 20 = $100.00']);
  });

  it('adds peer lines when peers are entered', () => {
    const check = displayedValuation({ price: 80, eps: 5, pe: 20 });
    if (!check.ok) throw new Error('expected ok');
    const peers = displayedPeers(['18', '', '17', '17']);
    expect(mathLines(check.value, peers).slice(2)).toEqual([
      'Peer average P/E = (18 + 17 + 17) ÷ 3 = 17.33',
      'Peer median P/E = middle of 17, 17, 18 = 17',
    ]);
    expect(peerMathLines(displayedPeers(['10', '30', '20', '40']))[1]).toBe(
      'Peer median P/E = middle of 10, 20, 30, 40 = 25',
    );
    expect(peerMathLines(displayedPeers(['']))).toEqual([]);
  });
});
