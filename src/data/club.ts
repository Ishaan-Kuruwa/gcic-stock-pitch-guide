/**
 * GHIC (Green Hope Investing Club) facts: the club's own dates and policies.
 * These are NOT competition rules; those live in competition.ts.
 */

/** GHIC's internal target for submitting, ahead of the YIS deadline (YYYY-MM-DD). */
export const targetSubmitDate = '2027-02-17' as const;

/**
 * GHIC's claim board, where teams claim their company (one team per company).
 */
export const claimBoardUrl = 'https://claude.ai/artifact/UQHFJmtsRdcvxrztvSC524' as const;

/**
 * GHIC's suggested recommendation rule, as fractions of today's price:
 * Buy if the target is at least `buyAtUpside` above, Sell if at least
 * `sellAtDownside` below, Hold in between.
 */
export const recommendationRule = { buyAtUpside: 0.1, sellAtDownside: 0.1 } as const;

/** GHIC's Google templates. Each one is opened in "make a copy" mode. */
export interface ClubTemplate {
  /** Display name, used in link text such as "Open the Financials Template (makes a copy)". */
  label: string;
  /** Google "/copy" URL, so students get their own copy instead of editing ours. */
  url: string;
}

export type TemplateId = 'financials' | 'comps' | 'slides';

export const templates: Readonly<Record<TemplateId, ClubTemplate>> = {
  financials: {
    label: 'Financials Template',
    url: 'https://docs.google.com/spreadsheets/d/1pOiG4UpKC4PrvcshK3X0qG1Fj2odjTVIofB1Bl4tMiI/copy',
  },
  comps: {
    label: 'Comps Template',
    url: 'https://docs.google.com/spreadsheets/d/1YdEtZN8-puUKYYQJ4MFM4JmPFGafhruwytdSC6rrMKs/copy',
  },
  slides: {
    label: 'Slide Template',
    url: 'https://docs.google.com/presentation/d/1-Eid1VVP1-RkWeKtuCropn4umob5kyjRHXcTjX8Ku0Q/copy',
  },
};
