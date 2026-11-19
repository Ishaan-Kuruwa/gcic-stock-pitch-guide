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
