import { describe, expect, it } from 'vitest';
import { rubricLines } from '../data/competition';
import {
  assertParts,
  formatDue,
  isoDay,
  moduleSchema,
  moduleSlug,
  prevNext,
  sortModules,
  trackerItems,
  type ModuleLike,
  type ModuleStatus,
} from './modules';
import { rubricLinesFor, rubricTotal } from './rubric';

const valid = {
  number: 5,
  title: 'Value the company',
  summary: 'P/E and comparable companies',
  rubric: ['idea-logic', 'report-financials'],
  deliverable: 'Valuation section',
  due: '2027-01-12',
  tools: [],
  templates: [],
  status: 'draft',
  reviewedBy: '',
};

function mod(number: number, status: ModuleStatus = 'draft'): ModuleLike {
  return { id: `${String(number).padStart(2, '0')}-m${number}`, data: { number, status } };
}

describe('moduleSchema', () => {
  it('accepts valid frontmatter', () => {
    expect(moduleSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an unknown rubric id', () => {
    const result = moduleSchema.safeParse({ ...valid, rubric: ['idea-logic', 'not-a-line'] });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('not-a-line');
  });

  it('rejects a bad status and a bad template url', () => {
    expect(moduleSchema.safeParse({ ...valid, status: 'published' }).success).toBe(false);
    expect(
      moduleSchema.safeParse({ ...valid, templates: [{ label: 'x', url: 'not a url' }] }).success,
    ).toBe(false);
  });

  it('requires reviewedBy once a module is reviewed or live', () => {
    expect(moduleSchema.safeParse({ ...valid, status: 'live' }).success).toBe(false);
    expect(moduleSchema.safeParse({ ...valid, status: 'reviewed', reviewedBy: ' ' }).success).toBe(false);
    expect(moduleSchema.safeParse({ ...valid, status: 'live', reviewedBy: 'Ishaan' }).success).toBe(true);
  });
});

describe('sortModules', () => {
  it('sorts by number numerically, not as text', () => {
    const sorted = sortModules([mod(10), mod(0), mod(2), mod(1)]);
    expect(sorted.map((m) => m.data.number)).toEqual([0, 1, 2, 10]);
  });

  it('throws on duplicate numbers', () => {
    expect(() => sortModules([mod(3), mod(3)])).toThrow(/both use number 3/);
  });
});

describe('prevNext', () => {
  const all = sortModules(Array.from({ length: 11 }, (_, i) => mod(i)));

  it('first module has no prev and links to module 1', () => {
    const { prev, next } = prevNext(all, 0);
    expect(prev).toBeUndefined();
    expect(next?.data.number).toBe(1);
  });

  it('last module links back and has no next', () => {
    const { prev, next } = prevNext(all, all.length - 1);
    expect(prev?.data.number).toBe(9);
    expect(next).toBeUndefined();
  });

  it('middle module has both', () => {
    const { prev, next } = prevNext(all, 5);
    expect(prev?.data.number).toBe(4);
    expect(next?.data.number).toBe(6);
  });

  it('a live module skips drafts to the nearest live module', () => {
    const list = [mod(0, 'live'), mod(1, 'draft'), mod(2, 'live'), mod(3, 'reviewed'), mod(4, 'live')];
    const { prev, next } = prevNext(list, 2);
    expect(prev?.data.number).toBe(0);
    expect(next?.data.number).toBe(4);
  });

  it('a live module with no live neighbor gets no link on that side', () => {
    const list = [mod(0, 'draft'), mod(1, 'live'), mod(2, 'draft'), mod(3, 'draft')];
    const { prev, next } = prevNext(list, 1);
    expect(prev).toBeUndefined();
    expect(next).toBeUndefined();
  });

  it('a draft module links to its immediate neighbors whatever their status', () => {
    const list = [mod(0, 'live'), mod(1, 'draft'), mod(2, 'reviewed')];
    const { prev, next } = prevNext(list, 1);
    expect(prev?.data.number).toBe(0);
    expect(next?.data.number).toBe(2);
  });
});

// vitest.config.ts runs tests with TZ=America/Los_Angeles so these catch off-by-one-day bugs.
describe('due dates display in UTC', () => {
  it('2026-12-18 never shows as Dec 17 in a US time zone', () => {
    const due = moduleSchema.parse(valid).due; // parsed the same way as frontmatter
    const dec18 = moduleSchema.parse({ ...valid, due: '2026-12-18' }).due;
    // Sanity check: in Los Angeles local time this instant is still Dec 17.
    expect(dec18.getDate()).toBe(17);
    expect(isoDay(dec18)).toBe('2026-12-18');
    expect(formatDue(dec18)).toBe('December 18, 2026');
    expect(formatDue(due)).toBe('January 12, 2027');
  });

  it('also works for a Date object (how YAML dates arrive)', () => {
    expect(formatDue(new Date(Date.UTC(2027, 1, 19)))).toBe('February 19, 2027');
  });
});

describe('moduleSlug', () => {
  it('drops the number prefix', () => {
    expect(moduleSlug('00-start-here')).toBe('start-here');
    expect(moduleSlug('10-submit')).toBe('submit');
  });
});

describe('assertParts', () => {
  const part = (id: string) => `<Part id="${id}">\n  x\n</Part>\n`;

  it('accepts the five parts in order', () => {
    const body = ['why', 'learn', 'see', 'do', 'check'].map(part).join('\n');
    expect(() => assertParts('m', body)).not.toThrow();
  });

  it('rejects a missing or out-of-order part', () => {
    expect(() => assertParts('m', ['why', 'learn', 'see', 'do'].map(part).join(''))).toThrow(/m/);
    expect(() => assertParts('m', ['learn', 'why', 'see', 'do', 'check'].map(part).join(''))).toThrow();
  });
});

describe('rubricLinesFor', () => {
  it('returns lines in rubric order and totals module 9 at 40 points', () => {
    const ids = [
      'slides-bullets',
      'slides-pace',
      'video-clear-time',
      'video-knowledge',
      'video-professional',
      'video-delivery',
    ];
    const lines = rubricLinesFor(rubricLines, ids);
    expect(lines).toHaveLength(6);
    expect(rubricTotal(lines)).toBe(40);
  });

  it('returns nothing for an empty list and throws on an unknown id', () => {
    expect(rubricLinesFor(rubricLines, [])).toEqual([]);
    expect(() => rubricLinesFor(rubricLines, ['bogus'])).toThrow(/bogus/);
  });
});

describe('trackerItems', () => {
  const entry = (number: number, status: ModuleStatus) => ({
    id: `0${number}-m${number}`,
    data: { number, status, title: `T${number}`, deliverable: `D${number}`, due: new Date('2027-01-04T00:00:00Z') },
  });

  it('sorts modules and links only live ones', () => {
    expect(trackerItems([entry(2, 'draft'), entry(1, 'live')])).toEqual([
      { number: 1, title: 'T1', deliverable: 'D1', due: '2027-01-04', href: '/learn/m1' },
      { number: 2, title: 'T2', deliverable: 'D2', due: '2027-01-04' },
    ]);
  });
});
