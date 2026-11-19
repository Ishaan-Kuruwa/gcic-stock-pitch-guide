import { describe, expect, it } from 'vitest';
import {
  contentRules,
  fileNames,
  firstPageFields,
  limits,
  requiredItems,
  requiredSections,
} from '../data/competition';
import { glossary } from '../data/glossary';
import {
  REPORT_CHECK_KEY,
  allItemIds,
  parseReportCheck,
  progressLabel,
  reportChecklist,
  toggleItem,
} from './reportCheck';
import { createStore, type StorageLike } from './storage';

const groups = reportChecklist();
const labels = groups.flatMap((g) => g.items.map((i) => i.label));

function memoryBacking(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const blocked: StorageLike = {
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

describe('reportChecklist', () => {
  it('has the three groups in order', () => {
    expect(groups.map((g) => g.label)).toEqual(['First page', 'Sections', 'Format and files']);
  });

  it('includes every first-page field', () => {
    const firstPage = groups.find((g) => g.id === 'first-page')!;
    expect(firstPage.items.map((i) => i.label)).toEqual(firstPageFields.map((f) => f.label));
  });

  it('includes every required section', () => {
    const sections = groups.find((g) => g.id === 'sections')!;
    expect(sections.items).toHaveLength(requiredSections.length);
    requiredSections.forEach((s, i) => {
      expect(sections.items[i]!.label).toContain(s.label);
      if ('detail' in s) expect(sections.items[i]!.label).toContain(s.detail);
    });
  });

  it('includes every report and slides constraint, including the page limit and appendix rule', () => {
    for (const id of ['report', 'slides'] as const) {
      const required = requiredItems.find((r) => r.id === id)!;
      for (const c of required.constraints) {
        expect(labels.some((l) => l.includes(c))).toBe(true);
      }
    }
    expect(labels.some((l) => l.includes(`${limits.reportMaxPages} pages`) && /appendix/i.test(l))).toBe(
      true,
    );
    expect(labels.some((l) => l.includes('PDF'))).toBe(true);
  });

  it('includes every content rule in Format and files', () => {
    const format = groups.find((g) => g.id === 'format')!;
    for (const rule of contentRules) {
      expect(format.items.map((i) => i.label)).toContain(rule);
    }
  });

  it('includes both file names', () => {
    for (const f of fileNames) {
      expect(labels.some((l) => l.includes(f.pattern))).toBe(true);
    }
  });

  it('has unique ids and the right total', () => {
    const ids = allItemIds();
    expect(new Set(ids).size).toBe(ids.length);
    const slides = requiredItems.find((r) => r.id === 'slides')!;
    const report = requiredItems.find((r) => r.id === 'report')!;
    expect(ids).toHaveLength(
      firstPageFields.length +
        requiredSections.length +
        report.constraints.length +
        contentRules.length +
        fileNames.length +
        slides.constraints.length,
    );
  });

  it('only links to glossary entries that exist', () => {
    const known = new Set<string>(glossary.map((g) => g.id));
    for (const g of groups) {
      for (const i of g.items) {
        if (i.glossaryId) expect(known.has(i.glossaryId)).toBe(true);
      }
    }
  });
});

describe('toggleItem and progress', () => {
  it('ticks and unticks, keeping checklist order', () => {
    const ids = allItemIds();
    let checked = toggleItem([], ids[3]!, true);
    checked = toggleItem(checked, ids[0]!, true);
    expect(checked).toEqual([ids[0], ids[3]]);
    checked = toggleItem(checked, ids[0]!, false);
    expect(checked).toEqual([ids[3]]);
  });

  it('counts done items', () => {
    expect(progressLabel(['a', 'b'], 20)).toBe('2 of 20 done');
  });
});

describe('saving', () => {
  it('survives a reload', () => {
    const backing = memoryBacking();
    const ids = allItemIds();
    const checked = toggleItem(toggleItem([], ids[1]!, true), ids[5]!, true);
    expect(createStore(() => backing).setJson(REPORT_CHECK_KEY, checked)).toBe(true);

    // A new store over the same backing is a fresh page load.
    const reloaded = createStore(() => backing);
    expect(parseReportCheck(reloaded.getJson(REPORT_CHECK_KEY))).toEqual(checked);
  });

  it('works in memory when storage is blocked', () => {
    const store = createStore(() => blocked);
    const ids = allItemIds();
    expect(store.setJson(REPORT_CHECK_KEY, [ids[2]])).toBe(false);
    expect(parseReportCheck(store.getJson(REPORT_CHECK_KEY))).toEqual([ids[2]]);
  });

  it('drops junk and unknown ids', () => {
    const ids = allItemIds();
    expect(parseReportCheck(null)).toEqual([]);
    expect(parseReportCheck({ a: 1 })).toEqual([]);
    expect(parseReportCheck([ids[0], 'not-an-item', 7])).toEqual([ids[0]]);
  });
});
