/**
 * The five questions from module 1, "What makes a good first pick"
 * (src/content/modules/01-pick-your-company.mdx), word for word.
 * A test checks they still match the module.
 */
export const fitQuestions = [
  'Can you explain how it makes money in two sentences?',
  'Is there plenty of public information?',
  'Is it profitable?',
  'Is there something to debate?',
  'Do you actually care about it?',
] as const;

/** Module 1's rule: cross off any company that fails questions 1–3 (0-based indexes). */
export const mustPassIndexes = [0, 1, 2] as const;
