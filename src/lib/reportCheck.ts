import {
  type RequiredSection,
  contentRules,
  fileNames,
  firstPageFields,
  requiredItems,
  requiredSections,
} from '../data/competition';

/** Saved through storage.ts, so the real key is "ghic-report-check". */
export const REPORT_CHECK_KEY = 'report-check';

export type ReportCheckGroupId = 'first-page' | 'sections' | 'format';

export interface ReportCheckItem {
  id: string;
  label: string;
  /** Glossary entry for the finance term in the label, if there is one. */
  glossaryId?: string;
}

export interface ReportCheckGroup {
  id: ReportCheckGroupId;
  label: string;
  items: ReportCheckItem[];
}

/** Glossary entries for checklist items whose label is a finance term. Keyed by item id. */
const glossaryIds: Record<string, string> = {
  'first-page:ticker': 'ticker',
  'first-page:sector': 'sector',
  'first-page:recommendation': 'recommendation',
  'first-page:current-price': 'share-price',
  'first-page:target-price': 'target-price',
  'section:investment-summary': 'investment-summary',
  'section:valuation': 'valuation',
  'section:investment-risks': 'risk-factors',
  'section:esg': 'esg',
};

function item(id: string, label: string): ReportCheckItem {
  const glossaryId = glossaryIds[id];
  return glossaryId ? { id, label, glossaryId } : { id, label };
}

function constraintsFor(itemId: 'report' | 'slides'): ReportCheckItem[] {
  const required = requiredItems.find((r) => r.id === itemId);
  if (!required) return [];
  return required.constraints.map((c, i) => item(`${itemId}:${i}`, `${required.label}: ${c}`));
}

/**
 * The full checklist, built only from competition.ts. Every first-page field,
 * every required section, the report and slides format rules, the
 * public-information rule, and both file names.
 */
export function reportChecklist(): ReportCheckGroup[] {
  const publicInfo = contentRules[0];
  return [
    {
      id: 'first-page',
      label: 'First page',
      items: firstPageFields.map((f) => item(`first-page:${f.id}`, f.label)),
    },
    {
      id: 'sections',
      label: 'Sections',
      items: (requiredSections as readonly RequiredSection[]).map((s) =>
        item(`section:${s.id}`, s.detail ? `${s.label} (${s.detail})` : s.label),
      ),
    },
    {
      id: 'format',
      label: 'Format and files',
      items: [
        ...constraintsFor('report'),
        item('content:public-info', publicInfo),
        ...fileNames.map((f) => item(`file-name:${f.item}`, `File named: ${f.pattern}`)),
        ...constraintsFor('slides'),
      ],
    },
  ];
}

export function allItemIds(groups: readonly ReportCheckGroup[] = reportChecklist()): string[] {
  return groups.flatMap((g) => g.items.map((i) => i.id));
}

/** Tick or untick one item. Returns a new list in checklist order. */
export function toggleItem(checked: readonly string[], id: string, on: boolean): string[] {
  const set = new Set(checked);
  if (on) set.add(id);
  else set.delete(id);
  return allItemIds().filter((i) => set.has(i));
}

/** "12 of 24 done" */
export function progressLabel(checked: readonly string[], total: number): string {
  return `${checked.length} of ${total} done`;
}

/** Turn saved data back into a list of ticked ids. Unknown ids and junk are dropped. */
export function parseReportCheck(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const saved = new Set(raw.filter((v): v is string => typeof v === 'string'));
  return allItemIds().filter((id) => saved.has(id));
}
