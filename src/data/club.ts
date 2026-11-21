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

/**
 * GHIC's time zone (Green Hope High School, Cary, NC). It decides which day
 * "today" is when the team page says a milestone is due or late.
 */
export const clubTimeZone = 'America/New_York' as const;

/** One step on a team's milestone checklist (shown on /team/[id]). */
export interface Milestone {
  /** Stored in the database. Don't rename a key mid-season: ticks on the old key stop showing. */
  key: string;
  label: string;
  /** GHIC's due date (YYYY-MM-DD), on or before targetSubmitDate. */
  due: string;
  /** Only shown to mentored teams, and only their mentor can tick it. */
  mentoredOnly?: boolean;
}

/**
 * GHIC's team milestones, in order. These are the club's own due dates, not
 * YIS rules. To change a due date, edit it here; the test in
 * src/lib/club.test.ts checks every date is on or before targetSubmitDate.
 */
export const milestones = [
  { key: 'company-picked', label: 'Company picked and claimed on the claim board', due: '2026-12-12' },
  { key: 'yis-registered', label: 'Registered with YIS', due: '2026-12-19' },
  { key: 'financials', label: 'Financials sheet filled in', due: '2027-01-02' },
  { key: 'comps', label: 'Comps and target price done', due: '2027-01-09' },
  { key: 'report-draft', label: 'Report first draft', due: '2027-01-15' },
  { key: 'mentor-review', label: 'Mentor reviewed the draft', due: '2027-01-22', mentoredOnly: true },
  { key: 'slides', label: 'Slides done', due: '2027-02-05' },
  { key: 'video', label: 'Video recorded, under 10 minutes', due: '2027-02-12' },
  { key: 'submitted', label: 'Submitted to YIS', due: targetSubmitDate },
] as const satisfies readonly Milestone[];

export type MilestoneKey = (typeof milestones)[number]['key'];

/**
 * GHIC's mentorship program. Applications stay on a Google Form this season;
 * the site only links to it. Officers score the form, then assign mentors on
 * the team page (see docs/accounts-setup.md, "How mentoring works on the site").
 */
export const mentorship: {
  /** The Google Form link. While null, the team page doesn't show the "Want a mentor?" notice. */
  applicationUrl: string | null;
  /** Last day to apply (YYYY-MM-DD, club time zone). The notice hides after this day. */
  closes: string;
  /** Mentors meet each team at least this often; /admin/teams flags teams past it. */
  checkinEveryDays: number;
} = {
  // TODO(officers): paste the mentor application Google Form link here.
  applicationUrl: null,
  closes: '2026-12-08',
  checkinEveryDays: 14,
};
