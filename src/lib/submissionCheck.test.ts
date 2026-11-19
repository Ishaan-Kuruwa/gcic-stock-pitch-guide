import { describe, expect, it } from 'vitest';
import {
  deadline,
  fileNames,
  registration,
  requiredItems,
  submission,
} from '../data/competition';
import {
  allSubmissionIds,
  parseSubmissionCheck,
  submissionChecklist,
  toggleSubmissionItem,
} from './submissionCheck';

const groups = submissionChecklist();
const labels = groups.flatMap((g) => g.items.map((i) => i.label));

describe('submissionChecklist', () => {
  it('has unique ids', () => {
    const ids = allSubmissionIds(groups);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every required item constraint and file name', () => {
    for (const item of requiredItems) {
      for (const c of item.constraints) expect(labels).toContain(`${item.label}: ${c}`);
    }
    for (const f of fileNames) expect(labels.some((l) => l.includes(f.pattern))).toBe(true);
  });

  it('covers the email address, rules, and body fields', () => {
    expect(labels.some((l) => l.includes(submission.email))).toBe(true);
    for (const rule of submission.rules) expect(labels).toContain(rule);
    for (const field of submission.emailBodyFields) {
      expect(labels).toContain(`Email body includes: ${field}`);
    }
  });

  it('names the registration site and the deadline', () => {
    expect(labels.some((l) => l.includes(registration.via))).toBe(true);
    expect(labels.some((l) => l.includes(deadline.display))).toBe(true);
    if (!deadline.lateSubmissions) {
      expect(labels.some((l) => l.includes('Late submissions are not accepted'))).toBe(true);
    }
  });
});

describe('required reminders', () => {
  it('includes copying your partner, from competition.ts', () => {
    const rule = submission.rules.find((r) => /copy your partner/i.test(r));
    expect(rule).toBeDefined();
    expect(labels).toContain(rule);
  });

  it('includes every teammate being registered', () => {
    expect(labels.some((l) => /every teammate is registered/i.test(l) && l.includes(registration.via))).toBe(
      true,
    );
  });
});

describe('ticking', () => {
  it('toggles in checklist order', () => {
    const ids = allSubmissionIds();
    const [a, b] = [ids[3]!, ids[1]!];
    let checked = toggleSubmissionItem([], a, true);
    checked = toggleSubmissionItem(checked, b, true);
    expect(checked).toEqual([b, a]);
    expect(toggleSubmissionItem(checked, a, false)).toEqual([b]);
  });

  it('parses saved data, dropping junk', () => {
    const first = allSubmissionIds()[0]!;
    expect(parseSubmissionCheck(null)).toEqual([]);
    expect(parseSubmissionCheck([first, 'nope', 3])).toEqual([first]);
  });
});
