/**
 * Glossary terms linked from the site. Definitions are not written yet:
 * they must come from provided teaching content, not be invented.
 */
export interface GlossaryEntry {
  id: string;
  term: string;
  /** Leave undefined until real content is provided. */
  definition?: string;
}

export const glossary = [
  { id: 'earnings', term: 'Earnings' },
  { id: 'eps', term: 'Earnings per share (EPS)' },
  { id: 'esg', term: 'ESG' },
  { id: 'exchange', term: 'Exchange' },
  { id: 'investment-summary', term: 'Investment summary' },
  { id: 'pe-ratio', term: 'Price-to-earnings (P/E) ratio' },
  { id: 'sector', term: 'Sector' },
  { id: 'target-price', term: 'Target price' },
  { id: 'ticker', term: 'Ticker' },
  { id: 'valuation', term: 'Valuation' },
] as const satisfies readonly GlossaryEntry[];

export type GlossaryId = (typeof glossary)[number]['id'];
