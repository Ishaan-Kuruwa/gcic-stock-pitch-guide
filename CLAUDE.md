# GCIC Stock Pitch Guide

## What this is
A website that teaches high school beginners in GCIC (Green Hope Capital Investment Club)
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
- v1 collects no personal data. Progress is stored in localStorage only.

## Stack
- Astro (current stable), TypeScript in strict mode, Tailwind CSS
- Modules are MDX files in an Astro content collection (src/content/modules)
- Interactive tools are Preact islands, hydrated with client:visible
- Pure logic lives in src/lib and is tested with Vitest
- Static build deployed to Cloudflare

## Commands
- npm run dev: local server
- npm run build: production build
- npm run check: astro check (types)
- npm test: Vitest

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

## Definition of done (every task)
- npm run build, npm run check, and npm test all pass
- Works at 360px and on desktop; usable with keyboard only; no console errors
- End with a short summary: what changed, what's left as TODO