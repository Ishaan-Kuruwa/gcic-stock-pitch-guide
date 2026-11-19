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

/** The rubric lines for the given ids, in rubric order. Throws on an unknown id. */
export function rubricLinesFor<L extends RubricLine>(
  lines: readonly L[],
  ids: readonly string[],
): L[] {
  const known = new Set(lines.map((line) => line.id));
  for (const id of ids) {
    if (!known.has(id)) throw new Error(`Unknown rubric id "${id}".`);
  }
  const wanted = new Set(ids);
  return lines.filter((line) => wanted.has(line.id));
}
