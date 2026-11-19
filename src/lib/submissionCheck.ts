import {
  deadline,
  fileNames,
  registration,
  requiredItems,
  submission,
} from '../data/competition';
import { formatDate } from './format';

/** Saved through storage.ts, so the real key is "ghic-submission-check". */
export const SUBMISSION_CHECK_KEY = 'submission-check';

export type SubmissionCheckGroupId = 'registration' | 'items' | 'email' | 'deadline';

export interface SubmissionCheckItem {
  id: string;
  label: string;
}

export interface SubmissionCheckGroup {
  id: SubmissionCheckGroupId;
  label: string;
  items: SubmissionCheckItem[];
}

/**
 * The module 10 checklist, built only from competition.ts: registration, every
 * required item and its constraints, both file names, the email rules and body
 * fields, and the deadline.
 */
export function submissionChecklist(): SubmissionCheckGroup[] {
  const closes = formatDate(registration.closes.date);
  return [
    {
      id: 'registration',
      label: 'Registration',
      items: [
        {
          id: 'registration:all',
          label: `Every teammate is registered on ${registration.via} (closes ${closes}).`,
        },
      ],
    },
    {
      id: 'items',
      label: 'Files and link',
      items: [
        ...requiredItems.flatMap((item) =>
          item.constraints.map((c, i) => ({ id: `${item.id}:${i}`, label: `${item.label}: ${c}` })),
        ),
        ...fileNames.map((f) => ({ id: `file-name:${f.item}`, label: `File named: ${f.pattern}` })),
      ],
    },
    {
      id: 'email',
      label: 'The email',
      items: [
        { id: 'email:to', label: `Sent to ${submission.email}` },
        ...submission.rules.map((rule, i) => ({ id: `email:rule-${i}`, label: rule })),
        ...submission.emailBodyFields.map((field) => ({
          id: `email:body-${field.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
          label: `Email body includes: ${field}`,
        })),
      ],
    },
    {
      id: 'deadline',
      label: 'Deadline',
      items: [
        {
          id: 'deadline:sent',
          label: deadline.lateSubmissions
            ? `Sent by ${deadline.display}.`
            : `Sent by ${deadline.display}. Late submissions are not accepted.`,
        },
      ],
    },
  ];
}

export function allSubmissionIds(groups: readonly SubmissionCheckGroup[] = submissionChecklist()): string[] {
  return groups.flatMap((g) => g.items.map((i) => i.id));
}

/** Tick or untick one item. Returns a new list in checklist order. */
export function toggleSubmissionItem(checked: readonly string[], id: string, on: boolean): string[] {
  const set = new Set(checked);
  if (on) set.add(id);
  else set.delete(id);
  return allSubmissionIds().filter((i) => set.has(i));
}

/** Turn saved data back into a list of ticked ids. Unknown ids and junk are dropped. */
export function parseSubmissionCheck(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const saved = new Set(raw.filter((v): v is string => typeof v === 'string'));
  return allSubmissionIds().filter((id) => saved.has(id));
}
