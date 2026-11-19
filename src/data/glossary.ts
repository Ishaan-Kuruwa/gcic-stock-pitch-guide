/**
 * Glossary terms linked from the site. Definitions must come from provided
 * teaching content, not be invented: entries without one show a TODO.
 */
export interface GlossaryEntry {
  id: string;
  term: string;
  /** Leave undefined until real content is provided. */
  definition?: string;
}

export const glossary = [
  {
    id: '10-k',
    term: '10-K',
    definition:
      "A company's detailed annual report, filed with the SEC. It explains the business, its risks, and its full financial statements, and it's the most trusted source for a stock pitch.",
  },
  {
    id: 'analyst',
    term: 'Analyst',
    definition:
      'A person who researches companies and recommends whether to buy, sell, or hold their stock. In this competition, you write as an independent analyst.',
  },
  {
    id: 'appendix',
    term: 'Appendix',
    definition:
      "Extra pages after the main report for supporting charts, tables, and sources. YIS doesn't count the appendix toward the report's page limit.",
  },
  {
    id: 'balance-sheet',
    term: 'Balance sheet',
    definition:
      "A snapshot of what a company owns, what it owes, and what's left over for shareholders on one specific day.",
  },
  {
    id: 'cash-and-cash-equivalents',
    term: 'Cash and cash equivalents',
    definition:
      'Money a company has on hand, plus investments it can turn into cash almost immediately.',
  },
  {
    id: 'cash-flow-statement',
    term: 'Cash flow statement',
    definition:
      'A record of the actual cash moving in and out of a company over a period, from running the business, investing, and borrowing or repaying money.',
  },
  {
    id: 'catalyst',
    term: 'Catalyst',
    definition:
      'An event that could make investors notice your thesis and move the stock price, such as an earnings report or a product launch.',
  },
  {
    id: 'comparable-companies',
    term: 'Comparable companies (comps)',
    definition:
      'Similar companies whose numbers, like their P/E ratios, you use as a benchmark for your own company.',
  },
  {
    id: 'debt',
    term: 'Debt',
    definition: 'Money a company has borrowed and must pay back, usually with interest.',
  },
  {
    id: 'diluted-eps',
    term: 'Diluted EPS',
    definition:
      "EPS calculated as if stock options and similar rights had all become shares. It's the standard version analysts use.",
  },
  { id: 'dividend', term: 'Dividend' },
  {
    id: 'downside',
    term: 'Downside',
    definition: 'How far your target price is below the current price, as a percent.',
  },
  {
    id: 'earnings',
    term: 'Earnings',
    definition:
      "A company's profit after all costs, interest, and taxes. Another word for net income.",
  },
  {
    id: 'earnings-call',
    term: 'Earnings call',
    definition:
      "A call where a company's leaders discuss its latest results and answer analysts' questions, usually every quarter. Recordings and transcripts are often posted online.",
  },
  {
    id: 'earnings-release',
    term: 'Earnings press release',
    definition:
      "A company's announcement of its latest results, usually each quarter, with the key numbers near the top.",
  },
  {
    id: 'eps',
    term: 'Earnings per share (EPS)',
    definition:
      "A company's net income divided by its number of shares, showing how much profit belongs to each share.",
  },
  {
    id: 'esg',
    term: 'ESG',
    definition:
      "Short for environmental, social, and governance: issues like energy use, how a company treats people, and how it's run, which can affect its long-term value.",
  },
  {
    id: 'exchange',
    term: 'Exchange',
    definition:
      'A marketplace where stocks are bought and sold, such as the New York Stock Exchange or Nasdaq.',
  },
  {
    id: 'fiscal-year',
    term: 'Fiscal year',
    definition:
      "A company's own 12-month reporting period. It doesn't always run from January to December.",
  },
  {
    id: 'forecast',
    term: 'Forecast',
    definition:
      "Your estimate of a future number, such as next year's EPS, based on evidence and a stated assumption.",
  },
  {
    id: 'gross-margin',
    term: 'Gross margin',
    definition:
      'The share of revenue left after the direct cost of the products sold, shown as a percent. A higher gross margin often means more pricing power.',
  },
  {
    id: 'growth-rate',
    term: 'Growth rate',
    definition:
      'How much a number changed from one period to the next, as a percent of the earlier number.',
  },
  {
    id: 'income-statement',
    term: 'Income statement',
    definition:
      "A report of a company's revenue, costs, and profit over a period, usually a quarter or a year.",
  },
  {
    id: 'industry',
    term: 'Industry',
    definition:
      'A group of companies that sell similar products or services and compete for the same customers.',
  },
  {
    id: 'inventory',
    term: 'Inventory',
    definition: "Products a company has bought or made but hasn't sold yet.",
  },
  {
    id: 'investment-summary',
    term: 'Investment summary',
    definition:
      'The section of a stock pitch that states the recommendation, target price, and main reasons, in under a page.',
  },
  {
    id: 'investor-relations',
    term: 'Investor relations',
    definition:
      'The part of a company that communicates with investors. Its website section usually has annual reports, earnings releases, and presentations.',
  },
  {
    id: 'mdna',
    term: "Management's Discussion and Analysis (MD&A)",
    definition:
      "Short for Management's Discussion and Analysis: the section of a 10-K (Item 7) where management explains the year's results and why they changed.",
  },
  {
    id: 'margin',
    term: 'Margin',
    definition:
      'The share of revenue a company keeps as profit at a given level, shown as a percent.',
  },
  {
    id: 'mitigant',
    term: 'Mitigant',
    definition: 'Something that reduces a risk, or how much damage it would do if it happened.',
  },
  {
    id: 'moat',
    term: 'Moat',
    definition:
      "A lasting advantage that protects a company's profits from competitors, such as a strong brand, huge scale, or network effects.",
  },
  {
    id: 'net-income',
    term: 'Net income',
    definition:
      'A company\'s profit after all costs, interest, and taxes. Also called earnings or the "bottom line."',
  },
  {
    id: 'net-sales',
    term: 'Net sales',
    definition: 'Revenue from selling products, after subtracting returns and discounts.',
  },
  {
    id: 'network-effects',
    term: 'Network effects',
    definition:
      'When a product becomes more valuable as more people use it, like a social network or a payments app.',
  },
  {
    id: 'operating-income',
    term: 'Operating income',
    definition: 'Profit from running the business, before interest and taxes are taken out.',
  },
  {
    id: 'operating-margin',
    term: 'Operating margin',
    definition:
      'Operating income as a percent of revenue: how much of each dollar of sales becomes operating profit.',
  },
  {
    id: 'pe-ratio',
    term: 'Price-to-earnings (P/E) ratio',
    definition:
      "A company's share price divided by its earnings per share. It shows how much investors pay for each dollar of the company's yearly profit.",
  },
  {
    id: 'proxy-statement',
    term: 'Proxy statement',
    definition:
      "A yearly document sent to shareholders before the company's annual meeting, covering the board, executive pay, and the issues shareholders vote on.",
  },
  {
    id: 'publicly-traded',
    term: 'Publicly traded',
    definition: 'Describes a company whose shares anyone can buy and sell on a stock exchange.',
  },
  {
    id: 'recommendation',
    term: 'Recommendation',
    definition: "An analyst's overall call on a stock: buy, sell, or hold.",
  },
  {
    id: 'revenue',
    term: 'Revenue',
    definition:
      'All the money a company earns from selling its products or services, before any costs are subtracted. Also called sales or the "top line."',
  },
  {
    id: 'risk-factors',
    term: 'Risk factors',
    definition:
      'The section of a 10-K (Item 1A) where a company lists what it says could hurt its business.',
  },
  {
    id: 'sec',
    term: 'Securities and Exchange Commission (SEC)',
    definition:
      'The Securities and Exchange Commission, the US government agency that oversees stock markets and requires public companies to report their results.',
  },
  {
    id: 'sector',
    term: 'Sector',
    definition:
      'A broad group of companies in similar businesses, such as technology, health care, or consumer staples.',
  },
  {
    id: 'segment',
    term: 'Segment',
    definition:
      "A part of a company's business that it reports separately, such as a product line or a region.",
  },
  {
    id: 'sensitivity-table',
    term: 'Sensitivity table',
    definition:
      'A grid showing how a result, like a target price, changes when you change your key assumptions.',
  },
  {
    id: 'share',
    term: 'Share',
    definition: 'One unit of ownership in a company. Also called a share of stock.',
  },
  {
    id: 'share-price',
    term: 'Share price',
    definition: "What one share of a company's stock costs on the market at a given moment.",
  },
  { id: 'sustainability-report', term: 'Sustainability report' },
  {
    id: 'switching-costs',
    term: 'Switching costs',
    definition:
      "The money, time, or hassle a customer faces when changing to a competitor's product.",
  },
  {
    id: 'target-price',
    term: 'Target price',
    definition:
      'The price an analyst expects a stock to reach, usually within a year, based on their valuation.',
  },
  {
    id: 'thesis-pillar',
    term: 'Thesis pillar',
    definition:
      'One of the main reasons behind your recommendation, backed by evidence. Most pitches have three.',
  },
  {
    id: 'ticker',
    term: 'Ticker',
    definition: "A short code that identifies a company's stock on an exchange. Apple's is AAPL.",
  },
  {
    id: 'upside',
    term: 'Upside',
    definition: 'How far your target price is above the current price, as a percent.',
  },
  {
    id: 'valuation',
    term: 'Valuation',
    definition:
      'Working out what a company or its stock is worth, so you can compare it with the current price.',
  },
] as const satisfies readonly GlossaryEntry[];

export type GlossaryId = (typeof glossary)[number]['id'];
