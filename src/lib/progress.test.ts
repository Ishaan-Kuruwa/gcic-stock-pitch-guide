import { describe, expect, it } from 'vitest';
import {
  loadProgress,
  nextModule,
  parseProgress,
  progressSummary,
  saveProgress,
  toggleDone,
} from './progress';
import { createStore, type StorageLike } from './storage';

const modules = [
  { number: 0, due: '2026-12-18' },
  { number: 1, due: '2026-12-18' },
  { number: 2, due: '2027-01-04' },
  { number: 3, due: '2027-01-07' },
];

class FakeStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const throwing: StorageLike = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('SecurityError');
  },
  removeItem() {
    throw new Error('SecurityError');
  },
};

describe('toggleDone', () => {
  it('marks a module done, then not done', () => {
    const once = toggleDone(new Set(), 2);
    expect([...once]).toEqual([2]);
    expect([...toggleDone(once, 2)]).toEqual([]);
  });

  it('does not change the set it was given', () => {
    const start = new Set([1]);
    toggleDone(start, 2);
    expect([...start]).toEqual([1]);
  });
});

describe('nextModule', () => {
  it('is module 0 at the start', () => {
    expect(nextModule(modules, new Set())).toBe(0);
  });

  it('is the lowest module not done in the middle', () => {
    expect(nextModule(modules, new Set([0, 1]))).toBe(2);
    expect(nextModule(modules, new Set([0, 2]))).toBe(1);
  });

  it('works when modules are out of order', () => {
    expect(nextModule([...modules].reverse(), new Set([0]))).toBe(1);
  });

  it('is undefined when all are done', () => {
    expect(nextModule(modules, new Set([0, 1, 2, 3]))).toBeUndefined();
  });
});

describe('progressSummary', () => {
  it('marks done modules, the next step, and the rest', () => {
    expect(progressSummary(modules, new Set([0, 1]))).toBe(
      'GHIC progress: Module 0 ✓, Module 1 ✓, Module 2 (next, due Jan 4, 2027), Module 3 (due Jan 7, 2027)',
    );
  });

  it('starts with module 0 as next', () => {
    expect(progressSummary(modules, new Set())).toBe(
      'GHIC progress: Module 0 (next, due Dec 18, 2026), Module 1 (due Dec 18, 2026), Module 2 (due Jan 4, 2027), Module 3 (due Jan 7, 2027)',
    );
  });

  it('says when everything is done', () => {
    expect(progressSummary(modules, new Set([0, 1, 2, 3]))).toBe(
      'GHIC progress: Module 0 ✓, Module 1 ✓, Module 2 ✓, Module 3 ✓. All modules done.',
    );
  });
});

describe('parseProgress', () => {
  it('reads saved module numbers', () => {
    expect([...parseProgress({ '0': true, '2': true })]).toEqual([0, 2]);
  });

  it('ignores junk', () => {
    expect([...parseProgress({ '1': false, x: true, '-1': true, '1.5': true, '3': 'yes' })]).toEqual([]);
    expect([...parseProgress(null)]).toEqual([]);
    expect([...parseProgress([0, 1])]).toEqual([]);
    expect([...parseProgress('0')]).toEqual([]);
    expect([...parseProgress(undefined)]).toEqual([]);
  });
});

describe('saving and loading', () => {
  it('round-trips under the ghic-progress key', () => {
    const backing = new FakeStorage();
    const store = createStore(() => backing);
    expect(saveProgress(new Set([1, 0]), store)).toBe(true);
    expect(backing.data.get('ghic-progress')).toBe('{"0":true,"1":true}');
    expect([...loadProgress(store)]).toEqual([0, 1]);
  });

  it('starts empty when nothing is saved', () => {
    expect([...loadProgress(createStore(() => new FakeStorage()))]).toEqual([]);
  });

  it('keeps working in memory when storage is blocked', () => {
    const store = createStore(() => throwing);
    expect([...loadProgress(store)]).toEqual([]);
    const done = toggleDone(loadProgress(store), 0);
    expect(saveProgress(done, store)).toBe(false);
    expect([...loadProgress(store)]).toEqual([0]);
  });

  it('keeps working when there is no storage at all', () => {
    const store = createStore(() => null);
    expect(saveProgress(new Set([3]), store)).toBe(false);
    expect([...loadProgress(store)]).toEqual([3]);
  });
});
