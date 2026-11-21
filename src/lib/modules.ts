import { z } from 'astro/zod';
import { rubricLines } from '../data/competition';
import { formatDate } from './format';

/** The five parts every module page has, in order. Titles are defined only here. */
export const MODULE_PARTS = [
  { id: 'why', title: 'Why it matters' },
  { id: 'learn', title: 'Learn' },
  { id: 'see', title: 'See it' },
  { id: 'do', title: 'Do it' },
  { id: 'check', title: 'Check it' },
] as const;

export type ModulePartId = (typeof MODULE_PARTS)[number]['id'];

export const MODULE_STATUSES = ['draft', 'reviewed', 'live'] as const;
export type ModuleStatus = (typeof MODULE_STATUSES)[number];

type RubricLineId = (typeof rubricLines)[number]['id'];
const rubricLineIds = rubricLines.map((line) => line.id) as [RubricLineId, ...RubricLineId[]];

/** Frontmatter schema for src/content/modules/*.mdx. Unknown rubric ids fail the build. */
export const moduleSchema = z
  .object({
    number: z.number().int().min(0),
    title: z.string().min(1),
    summary: z.string().min(1),
    rubric: z.array(
      z.enum(rubricLineIds, {
        error: (issue) =>
          `Unknown rubric id ${JSON.stringify(issue.input)}. Valid ids (from src/data/competition.ts): ${rubricLineIds.join(', ')}`,
      }),
    ),
    deliverable: z.string().min(1),
    due: z.coerce.date(),
    tools: z.array(z.string()),
    templates: z.array(z.object({ label: z.string().min(1), url: z.url() })),
    status: z.enum(MODULE_STATUSES),
    reviewedBy: z.string(),
  })
  .refine((data) => data.status === 'draft' || data.reviewedBy.trim() !== '', {
    message: 'A module marked "reviewed" or "live" needs a reviewedBy name.',
    path: ['reviewedBy'],
  });

export type ModuleData = z.infer<typeof moduleSchema>;

/** The shape of a collection entry that the helpers below need. */
export interface ModuleLike {
  id: string;
  data: Pick<ModuleData, 'number' | 'status'>;
}

/** Sort modules by number. Throws if two modules share a number. */
export function sortModules<T extends ModuleLike>(entries: readonly T[]): T[] {
  const sorted = [...entries].sort((a, b) => a.data.number - b.data.number);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].data.number === sorted[i - 1].data.number) {
      throw new Error(
        `Modules "${sorted[i - 1].id}" and "${sorted[i].id}" both use number ${sorted[i].data.number}.`,
      );
    }
  }
  return sorted;
}

/** "05-value-the-company" -> "value-the-company". */
export function moduleSlug(id: string): string {
  return id.replace(/^\d+-/, '');
}

/**
 * Previous and next modules for the module at `index` in a sorted list.
 * A live module only links to other live modules (skipping drafts in between);
 * a draft or reviewed module links to its immediate neighbors.
 */
export function prevNext<T extends ModuleLike>(
  sorted: readonly T[],
  index: number,
): { prev?: T; next?: T } {
  const current = sorted[index];
  if (!current) throw new Error(`No module at index ${index}.`);
  const eligible = (m: T) => current.data.status !== 'live' || m.data.status === 'live';

  let prev: T | undefined;
  for (let i = index - 1; i >= 0; i--) {
    if (eligible(sorted[i])) {
      prev = sorted[i];
      break;
    }
  }
  let next: T | undefined;
  for (let i = index + 1; i < sorted.length; i++) {
    if (eligible(sorted[i])) {
      next = sorted[i];
      break;
    }
  }
  return { prev, next };
}

/** Part ids used in an MDX body, in order, e.g. <Part id="why">. */
export function partIdsInBody(body: string): string[] {
  return [...body.matchAll(/<Part\s+id=["']([^"']+)["']/g)].map((m) => m[1]);
}

/** Throws unless the body uses exactly the five parts, once each, in order. */
export function assertParts(moduleId: string, body: string): void {
  const found = partIdsInBody(body);
  const expected = MODULE_PARTS.map((p) => p.id);
  if (found.join(',') !== expected.join(',')) {
    throw new Error(
      `Module "${moduleId}" must contain <Part> sections ${expected.join(', ')} in that order; found: ${found.join(', ') || 'none'}.`,
    );
  }
}

/** A Date as YYYY-MM-DD, read in UTC so it never shifts a day. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Display a due date, always in UTC ("December 18, 2026"). */
export function formatDue(date: Date): string {
  return formatDate(isoDay(date));
}

/** What the progress tracker needs for one module. */
export interface TrackerItem {
  number: number;
  title: string;
  deliverable: string;
  /** YYYY-MM-DD. */
  due: string;
  /** Link to the module page, only when it's live. */
  href?: string;
}

/** Modules for the progress tracker, sorted, linking only live pages. */
export function trackerItems(
  entries: readonly {
    id: string;
    data: Pick<ModuleData, 'number' | 'status' | 'title' | 'deliverable' | 'due'>;
  }[],
): TrackerItem[] {
  return sortModules(entries).map(({ id, data }) => ({
    number: data.number,
    title: data.title,
    deliverable: data.deliverable,
    due: isoDay(data.due),
    ...(data.status === 'live' ? { href: `/learn/${moduleSlug(id)}` } : {}),
  }));
}

/**
 * Link for module `number`, only when it's live; undefined for drafts, so pages
 * show the name as plain text instead of sending students to an unfinished page.
 * Throws if no module has that number, so a typo fails the build.
 */
export function moduleHref(entries: readonly ModuleLike[], number: number): string | undefined {
  const entry = entries.find((m) => m.data.number === number);
  if (!entry) throw new Error(`No module with number ${number}.`);
  return entry.data.status === 'live' ? `/learn/${moduleSlug(entry.id)}` : undefined;
}

/** One module as the account pages and /api/progress know it. */
export interface CatalogItem {
  number: number;
  /** moduleSlug(id), the key saved in module_progress. */
  slug: string;
  title: string;
  /** Link to the module page, only when it's live. */
  href?: string;
}

/** Every module, sorted, with its slug (for progress saved to accounts). */
export function moduleCatalog(
  entries: readonly { id: string; data: Pick<ModuleData, 'number' | 'status' | 'title'> }[],
): CatalogItem[] {
  return sortModules(entries).map(({ id, data }) => ({
    number: data.number,
    slug: moduleSlug(id),
    title: data.title,
    ...(data.status === 'live' ? { href: `/learn/${moduleSlug(id)}` } : {}),
  }));
}
