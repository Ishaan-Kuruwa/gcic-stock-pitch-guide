/**
 * YIS Global Stock Pitch Competition facts.
 *
 * Single source of truth for competition rules, dates, and points.
 * Source: https://yis.org/programs/stock-pitch-competition/stock-pitch-report/
 * Do not add anything here that is not on the official YIS pages.
 */

export type RubricCategoryId = 'investment-idea' | 'presentation' | 'video';

export interface RubricCategory {
  id: RubricCategoryId;
  label: string;
  points: number;
}

export interface RubricLine {
  id: string;
  category: RubricCategoryId;
  label: string;
  points: number;
}

export interface DatedFact {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  confirmed: boolean;
  note?: string;
}

export interface Deadline {
  /** ISO 8601 instant with explicit offset. */
  iso: string;
  display: string;
  timeZone: string;
  lateSubmissions: boolean;
}

export interface Submission {
  email: string;
  oneEmail: boolean;
  rules: readonly string[];
  emailBodyFields: readonly string[];
}

export interface Registration {
  via: string;
  opens: DatedFact;
  closes: DatedFact;
}

export interface EntryFee {
  amountUsd: number;
  per: 'person';
  note: string;
}

export type RequiredItemId = 'report' | 'slides' | 'video';

export interface RequiredItem {
  id: RequiredItemId;
  label: string;
  constraints: readonly string[];
}

export interface FileName {
  item: 'report' | 'slides';
  pattern: string;
}

export interface FirstPageField {
  id: string;
  label: string;
}

export interface RequiredSection {
  id: string;
  label: string;
  detail?: string;
}

export interface OfficialLink {
  id: string;
  label: string;
  url: string;
}

export const deadline = {
  iso: '2027-02-19T23:59:00-08:00',
  display: 'February 19, 2027, 11:59 PM Pacific',
  timeZone: 'America/Los_Angeles',
  lateSubmissions: false,
} as const satisfies Deadline;

export const submission = {
  email: 'stockpitch2027@yis.org',
  oneEmail: true,
  rules: [
    'Send all three required items in ONE email.',
    'No Drive links; files must not require permissions.',
    'Copy your partner on the email.',
  ],
  emailBodyFields: ['Name(s)', 'Email address', 'School', 'State'],
} as const satisfies Submission;

export const registration = {
  via: 'MyYIS',
  opens: {
    date: '2026-12-15',
    confirmed: false,
    note: 'From a third-party listing; confirm on MyYIS.',
  },
  closes: { date: '2027-02-19', confirmed: true },
} as const satisfies Registration;

export const entryFee = {
  amountUsd: 30,
  per: 'person',
  note: 'US',
} as const satisfies EntryFee;

export const teams = 'Individual or pairs' as const;

/** Numeric limits. The requiredItems sentences below are built from these. */
export const limits = {
  reportMaxPages: 10,
  videoMaxMinutes: 10,
} as const;

export const requiredItems = [
  {
    id: 'report',
    label: 'Written report',
    constraints: [
      'PDF attachment.',
      `Max ${limits.reportMaxPages} pages plus an appendix of any length.`,
    ],
  },
  {
    id: 'slides',
    label: 'Slides',
    constraints: ['PowerPoint or PDF attachment.', 'Keynote not accepted.'],
  },
  {
    id: 'video',
    label: 'YouTube video link',
    constraints: [
      'The student presenting, with the slides shown in the video.',
      `Under ${limits.videoMaxMinutes} minutes.`,
      'Not sped up.',
      'Editing not required.',
      'Link must be viewable by judges.',
    ],
  },
] as const satisfies readonly RequiredItem[];

export const fileNames = [
  { item: 'report', pattern: 'Last Name(s), School, State/Territory, REPORT (PDF)' },
  { item: 'slides', pattern: 'Last Name(s), School, State/Territory, SLIDES' },
] as const satisfies readonly FileName[];

/** Required on the report's first page AND the title slide. */
export const firstPageFields = [
  { id: 'names', label: 'Names (and partner)' },
  { id: 'school', label: 'School' },
  { id: 'state', label: 'State or territory' },
  { id: 'emails', label: "Each student's email" },
  { id: 'company', label: 'Company name' },
  { id: 'ticker', label: 'Exchange or ticker' },
  { id: 'sector', label: 'Sector or industry' },
  { id: 'recommendation', label: 'Recommendation (Buy/Sell/Hold)' },
  { id: 'current-price', label: 'Current price (as of date)' },
  { id: 'target-price', label: 'Target price (% increase/decrease)' },
] as const satisfies readonly FirstPageField[];

/** Required in both the report and the slides. */
export const requiredSections = [
  { id: 'business-description', label: 'Business Description' },
  {
    id: 'industry-overview',
    label: 'Industry Overview and Competitive Positioning',
  },
  { id: 'investment-summary', label: 'Investment Summary' },
  { id: 'valuation', label: 'Valuation / Financial Analysis' },
  { id: 'investment-risks', label: 'Investment Risks' },
  { id: 'esg', label: 'ESG Considerations' },
  {
    id: 'ai',
    label: 'AI',
    detail: 'How AI affects opportunity or risk for the company.',
  },
] as const satisfies readonly RequiredSection[];

export const contentRules = [
  'Only publicly available information.',
  'Written as an independent research analyst.',
] as const;

export const rubricCategories = [
  { id: 'investment-idea', label: 'Investment Idea', points: 50 },
  { id: 'presentation', label: 'Presentation', points: 25 },
  { id: 'video', label: 'YouTube Video', points: 25 },
] as const satisfies readonly RubricCategory[];

export const rubricTotalPoints = 100 as const;

export const rubricLines = [
  {
    id: 'idea-logic',
    category: 'investment-idea',
    label: 'Idea makes logical sense, sound investment principles',
    points: 15,
  },
  {
    id: 'report-insight',
    category: 'investment-idea',
    label: 'Insight into the company and industry',
    points: 15,
  },
  {
    id: 'report-financials',
    category: 'investment-idea',
    label: 'Sound financial analysis',
    points: 10,
  },
  {
    id: 'esg-ai',
    category: 'investment-idea',
    label: 'ESG and AI considerations',
    points: 10,
  },
  {
    id: 'slides-bullets',
    category: 'presentation',
    label: 'Uses bullets and elaborates on them',
    points: 10,
  },
  {
    id: 'slides-insight',
    category: 'presentation',
    label: 'Insight into the company and industry',
    points: 5,
  },
  {
    id: 'slides-financials',
    category: 'presentation',
    label: 'Sound financial analysis',
    points: 5,
  },
  { id: 'slides-pace', category: 'presentation', label: 'Good pace', points: 5 },
  {
    id: 'video-clear-time',
    category: 'video',
    label: 'Presents clearly, within the 10-minute limit',
    points: 10,
  },
  {
    id: 'video-knowledge',
    category: 'video',
    label: 'Adequate knowledge of the company',
    points: 5,
  },
  {
    id: 'video-professional',
    category: 'video',
    label: 'Professional presentation',
    points: 5,
  },
  {
    id: 'video-delivery',
    category: 'video',
    label: 'Eye contact and presentation skills',
    points: 5,
  },
] as const satisfies readonly RubricLine[];

export const integrityPolicy = [
  "Work must be the student's own. Paying or hiring anyone to research, write, or complete it is prohibited.",
  'AI may help explain concepts and with early research, but may not generate any report, slide, or analysis content. AI-sourced facts must be independently verified.',
  'Students must be able to explain and defend everything they submit.',
  'Violations can mean disqualification.',
] as const;

export const officialLinks = [
  {
    id: 'guidelines',
    label: 'Guidelines and rubric',
    url: 'https://yis.org/programs/stock-pitch-competition/stock-pitch-report/',
  },
  {
    id: 'competition',
    label: 'Competition page',
    url: 'https://yis.org/programs/stock-pitch-competition/',
  },
  {
    id: 'report-template',
    label: 'Report template',
    url: 'https://yis.org/programs/stock-pitch-competition/stock-pitch-report/stock-pitch-report-template/',
  },
  {
    id: 'intrinsic-value-model',
    label: 'Intrinsic Value Model',
    url: 'https://yis.org/programs/stock-pitch-competition/stock-pitch-report/intrinsic-value-model/',
  },
] as const satisfies readonly OfficialLink[];

/** Date these facts were last checked against yis.org (YYYY-MM-DD). */
export const lastChecked = '2026-11-16' as const;
