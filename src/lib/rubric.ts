import type { RubricCategory, RubricCategoryId, RubricLine } from '../data/competition';

export interface RubricGroup<C extends RubricCategory, L extends RubricLine> {
  category: C;
  lines: L[];
  total: number;
}

export function rubricTotal(lines: readonly RubricLine[]): number {
  return lines.reduce((sum, line) => sum + line.points, 0);
}

export function categoryTotal(
  lines: readonly RubricLine[],
  categoryId: RubricCategoryId,
): number {
  return rubricTotal(lines.filter((line) => line.category === categoryId));
}

export function groupRubric<C extends RubricCategory, L extends RubricLine>(
  categories: readonly C[],
  lines: readonly L[],
): RubricGroup<C, L>[] {
  return categories.map((category) => {
    const own = lines.filter((line) => line.category === category.id);
    return { category, lines: own, total: rubricTotal(own) };
  });
}
