# GHIC Stock Pitch Guide

## What this is
A website that teaches high school beginners in GHIC (Green Hope Investing Club)
how to complete the YIS Global Stock Pitch Competition: pick a company, research it,
value it, write a report (10 pages max plus appendix), build a slide deck, record a video
pitch under 10 minutes, and submit by Feb 19, 2027, 11:59 PM Pacific.

## Audience
High school students, mostly new to investing, often on school Chromebooks or phones.
UI text is plain and friendly. Any finance term links to the glossary.

## Hard rules
- NEVER build a feature that writes report, slide, or pitch text for students.
  YIS prohibits AI-generated content in submissions. Tools may calculate,
  organize, check, or time. They never write.
- NEVER invent competition rules, dates, or point values. All competition facts live in
  src/data/competition.ts. If something isn't there, stop and ask.
- NEVER write module teaching content from scratch. Format content you are given into
  MDX. Where content is missing, leave a visible TODO block.
- No analytics, ads, or third-party scripts (Google Fonts is fine).
- The site stores only what accounts need: Google name and email (no profile picture,
  no Google tokens). No birthdates, phone numbers, or photos. Account features stay
  behind sign-in and noindex. A /privacy page must exist before the Google app moves
  out of Testing. Progress is stored in localStorage only.

## Stack
- Astro (current stable), TypeScript in strict mode, Tailwind CSS
- Modules are MDX files in an Astro content collection (src/content/modules)
- Interactive tools are Preact islands, hydrated with client:visible
- Pure logic lives in src/lib and is tested with Vitest
- Pages are prerendered (static). A few on-demand routes (`export const prerender = false`:
  /account, /account/sign-in, /account/sign-out, /api/auth/*) run on the Cloudflare
  adapter as a Worker, with Better Auth (Google only) and D1 via Drizzle
  (src/db/schema.ts, drizzle/migrations). See docs/accounts-setup.md.

## Commands
- npm run dev: local server
- npm run build: production build
- npm run check: astro check (types)
- npm test: Vitest
- npm run types: regenerate worker-configuration.d.ts after changing wrangler.jsonc
- npm run db:generate: write a migration after changing src/db/schema.ts
- npm run db:migrate:local / db:migrate:remote: apply migrations to D1

## Conventions
- Calculations are pure functions in src/lib/*.ts with tests; components only render.
- Round numbers only for display; format with Intl.NumberFormat.
- All localStorage access goes through src/lib/storage.ts, wrapped in try/catch.
  Every page must still work if storage is blocked.
- Accessibility: semantic HTML, a label on every input, visible focus, WCAG AA contrast,
  full keyboard use, respect prefers-reduced-motion.
- Mobile first: everything works at 360px wide. Module pages have a print stylesheet.
- Every module page uses ModuleLayout with five parts:
  Why it matters, Learn, See it, Do it, Check it.
- Link to official YIS resources; never copy them into the site.

## Design
- Fonts (Google Fonts, loaded in BaseLayout): Big Shoulders Display for h1–h3,
  the wordmark, and big numbers (`font-display`); Atkinson Hyperlegible for
  everything else (`font-sans`).
- Colors: only use the theme tokens in src/styles/global.css, never raw hex in
  components. Each has light and dark values: `bg` (paper), `surface` (card),
  `tint` (sage panels, number badges), `text`, `muted`, `accent` (pine: links,
  primary buttons), `accent-strong` (hover), `accent-contrast` (text on accent),
  `highlight` (foil: accent bars, current-page marker; a fill, never text on bg),
  `highlight-contrast`, `border`, `focus`, `danger` and `danger-contrast` (errors,
  always with words, never color alone). Any new pair must meet WCAG AA
  (4.5:1 text, 3:1 focus rings and UI). The focus ring is pine in light mode and
  foil in dark mode.
- Patterns: shared class strings live in src/lib/styles.ts (`card`, `lift`,
  `eyebrow`, `buttonPrimary`, `buttonSecondary`, `numberBadge`, `focus`,
  `fadeUp`). Page = eyebrow, display h1, foil accent bar, muted lede, with text
  capped at `max-w-prose` (44rem). Cards are `rounded-xl` with `shadow-card`;
  only clickable cards get `lift`.
- Motion: subtle and short (0.5s or less), using `ease-soft`. Allowed: `fadeUp`
  with a `fadeDelay(i)` stagger, the hover lift, `<details data-animate>`
  open and close, and the CSS-only page cross-fade (`@view-transition`, no
  JavaScript router). All motion is behind `motion-safe:` or
  `prefers-reduced-motion: no-preference`, and the reduced-motion block in
  global.css must stay.
- Print stays black on white: print.css resets every token and removes shadows,
  blur, and animation. Mark purely decorative elements with
  `class="decorative" aria-hidden="true"` so print hides them.

## Definition of done (every task)
- npm run build, npm run check, and npm test all pass
- Works at 360px and on desktop; usable with keyboard only; no console errors
- End with a short summary: what changed, what's left as TODO