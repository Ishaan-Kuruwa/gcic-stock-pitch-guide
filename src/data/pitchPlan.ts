/**
 * GHIC's eight-minute plan for the video pitch (the Costco example in
 * module 9). Module 9's "See it" table and the pitch timer's default budget
 * both read from here. This is club guidance, not a YIS rule.
 */
export interface PitchPlanPart {
  id: string;
  label: string;
  /** Slide numbers, matching module 8's outline. */
  slides: string;
  /** Planned time, in whole seconds. */
  budgetSec: number;
}

export const pitchPlan = [
  { id: 'title', label: 'Title and recommendation', slides: '1–2', budgetSec: 45 },
  { id: 'business', label: 'The business', slides: '3–4', budgetSec: 60 },
  { id: 'industry', label: 'Industry and competition', slides: '5–6', budgetSec: 60 },
  { id: 'financials', label: 'Financials', slides: '7–8', budgetSec: 90 },
  { id: 'valuation', label: 'Valuation', slides: '9–10', budgetSec: 90 },
  { id: 'risks', label: 'Risks', slides: '11', budgetSec: 60 },
  { id: 'esg-ai', label: 'ESG and AI', slides: '12', budgetSec: 45 },
  { id: 'recap', label: 'Recap', slides: '13', budgetSec: 30 },
] as const satisfies readonly PitchPlanPart[];
