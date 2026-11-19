import { describe, expect, it } from 'vitest';
import { rubricCategories, rubricLines, rubricTotalPoints } from '../data/competition';
import { categoryTotal, groupRubric, rubricTotal } from './rubric';

describe('rubric', () => {
  it('totals 100 points', () => {
    expect(rubricTotal(rubricLines)).toBe(100);
    expect(rubricTotalPoints).toBe(100);
  });

  it('category points add up to 100', () => {
    expect(rubricCategories.reduce((s, c) => s + c.points, 0)).toBe(100);
  });

  it('each category sums to its stated points (50/25/25)', () => {
    expect(categoryTotal(rubricLines, 'investment-idea')).toBe(50);
    expect(categoryTotal(rubricLines, 'presentation')).toBe(25);
    expect(categoryTotal(rubricLines, 'video')).toBe(25);
    for (const group of groupRubric(rubricCategories, rubricLines)) {
      expect(group.total).toBe(group.category.points);
    }
  });

  it('has unique line ids', () => {
    const ids = rubricLines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every line belongs to a known category', () => {
    const known = new Set<string>(rubricCategories.map((c) => c.id));
    for (const line of rubricLines) expect(known.has(line.category)).toBe(true);
  });

  it('grouping keeps every line exactly once', () => {
    const grouped = groupRubric(rubricCategories, rubricLines).flatMap((g) => g.lines);
    expect(grouped).toHaveLength(rubricLines.length);
  });
});
