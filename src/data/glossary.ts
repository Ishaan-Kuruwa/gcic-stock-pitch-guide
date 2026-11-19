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
  { id: '10-k', term: '10-K' },
  { id: 'appendix', term: 'Appendix' },
  { id: 'balance-sheet', term: 'Balance sheet' },
  { id: 'cash-flow-statement', term: 'Cash flow statement' },
  { id: 'catalyst', term: 'Catalyst' },
  { id: 'comparable-companies', term: 'Comparable companies (comps)' },
  { id: 'diluted-eps', term: 'Diluted EPS' },
  { id: 'dividend', term: 'Dividend' },
  { id: 'earnings', term: 'Earnings' },
  { id: 'earnings-call', term: 'Earnings call' },
  { id: 'earnings-release', term: 'Earnings press release' },
  { id: 'eps', term: 'Earnings per share (EPS)' },
  { id: 'esg', term: 'ESG' },
  { id: 'exchange', term: 'Exchange' },
  { id: 'fiscal-year', term: 'Fiscal year' },
  { id: 'gross-margin', term: 'Gross margin' },
  { id: 'income-statement', term: 'Income statement' },
  { id: 'investment-summary', term: 'Investment summary' },
  { id: 'investor-relations', term: 'Investor relations' },
  { id: 'mdna', term: "Management's Discussion and Analysis (MD&A)" },
  { id: 'mitigant', term: 'Mitigant' },
  { id: 'moat', term: 'Moat' },
  { id: 'net-income', term: 'Net income' },
  { id: 'net-sales', term: 'Net sales' },
  { id: 'network-effects', term: 'Network effects' },
  { id: 'operating-income', term: 'Operating income' },
  { id: 'operating-margin', term: 'Operating margin' },
  { id: 'pe-ratio', term: 'Price-to-earnings (P/E) ratio' },
  { id: 'revenue', term: 'Revenue' },
  { id: 'sec', term: 'Securities and Exchange Commission (SEC)' },
  { id: 'sector', term: 'Sector' },
  { id: 'segment', term: 'Segment' },
  { id: 'sensitivity-table', term: 'Sensitivity table' },
  { id: 'sustainability-report', term: 'Sustainability report' },
  { id: 'switching-costs', term: 'Switching costs' },
  { id: 'target-price', term: 'Target price' },
  { id: 'thesis-pillar', term: 'Thesis pillar' },
  { id: 'ticker', term: 'Ticker' },
  { id: 'upside', term: 'Upside and downside' },
  { id: 'valuation', term: 'Valuation' },
] as const satisfies readonly GlossaryEntry[];

export type GlossaryId = (typeof glossary)[number]['id'];
