import { fitQuestions, mustPassIndexes } from '../data/fitcheck';

/** Saved through storage.ts, so the real key is "ghic-fit-check". */
export const FIT_KEY = 'fit-check';

export type Answer = 'yes' | 'no';
/** One entry per question; null means not answered yet. */
export type Answers = (Answer | null)[];

/**
 * - cross-off: a "no" on question 1, 2, or 3 (module 1: cross it off)
 * - good: all five are "yes"
 * - mixed: 1–3 are "yes" but 4 or 5 is "no" (module 1 gives no rule for this)
 * - incomplete: not enough answers to say yet
 */
export type FitResult = 'cross-off' | 'good' | 'mixed' | 'incomplete';

export interface FitCheckState {
  company: string;
  answers: Answers;
}

export function emptyAnswers(): Answers {
  return fitQuestions.map(() => null);
}

export function fitResult(answers: Answers): FitResult {
  if (mustPassIndexes.some((i) => answers[i] === 'no')) return 'cross-off';
  const all = fitQuestions.map((_, i) => answers[i] ?? null);
  if (all.some((a) => a === null)) return 'incomplete';
  return all.every((a) => a === 'yes') ? 'good' : 'mixed';
}

/** The result sentence, using the company name if one was typed. */
export function fitHeadline(result: FitResult, company: string): string | null {
  const name = company.trim() || 'This company';
  if (result === 'good') return `${name} looks like a good first pick.`;
  if (result === 'cross-off') {
    const target = company.trim() || 'this company';
    return `Cross ${target} off your list and pick another company.`;
  }
  return null;
}

/** Turn saved data back into fit check state. Anything malformed is reset. */
export function parseFitCheck(raw: unknown): FitCheckState {
  const state: FitCheckState = { company: '', answers: emptyAnswers() };
  if (typeof raw !== 'object' || raw === null) return state;
  const { company, answers } = raw as Record<string, unknown>;
  if (typeof company === 'string') state.company = company;
  if (Array.isArray(answers)) {
    state.answers = state.answers.map((_, i) =>
      answers[i] === 'yes' || answers[i] === 'no' ? answers[i] : null,
    );
  }
  return state;
}
