# Memory — Job Detail Page Redesign + Onboarding Flow

Last updated: 2026-06-19 23:30

## What was built

### Onboarding flow (completed, confirmed working)
- `components/dashboard/OnboardingDialog.tsx` — 2-step modal (profile → find jobs), shown to new users
- `app/api/onboarding/mark-seen/route.ts` — POST endpoint sets `onboarding_seen = true`
- `app/profile/page.tsx` — shows OnboardingDialog for new users (`!profile?.onboarding_seen`)
- `app/dashboard/page.tsx` — redirects new users (onboarding_seen false/null) to `/profile`
- `proxy.ts` — redirects logged-in users from `/` to `/dashboard`; `"/"` added to matcher
- `public/images/onboarding-profile.png`, `onboarding-jobs.png`, `onboarding-research.png` — Playwright-generated fake UI screenshots used in dialog AND homepage (Hero, HowItWorks, Features components updated)

### Job detail page redesign (`app/find-jobs/[id]/page.tsx`)
Complete rewrite to two-column layout:
- **Left column**: job header (title, company·location·jobtype subtitle, top 5 matched skill pills, match score circle + "Match score" label), match breakdown card (progress bars + matched/missing skills two-column), job description, company research, cover letter
- **Right sticky sidebar** (320px): single white card (`bg-surface border border-border rounded-2xl p-4`) containing:
  - Apply now ↗ (blue, bold underline)
  - Tailored resume (`bg-surface-tertiary border border-border`, bold underline, no icon, label = "Tailored resume")
  - `h-px bg-border-muted` separator
  - Bare detail rows: Source / Posted / Contract / Salary / Status (no card wrapper, no dividers)
  - Below the card: AI Match Summary card
- Removed: ApplicationPipeline, InfoCard grid, bottom Apply Now button, Generate Cover Letter button (removed twice — do not add back)
- Added: `MatchCircle` SVG with light colored inner bg, `ProgressBar`, `DetailRow`, `formatSource()`
- `source` field added to Job type — formatted (adzuna→Adzuna, url→Imported, search→Job search, etc.)
- Company research content area uses `bg-surface-tertiary`

### TailoredResumeButton (`components/find-jobs/TailoredResumeButton.tsx`)
- Added `fullWidth?: boolean` prop
- fullWidth: `bg-surface-tertiary border border-border`, `rounded-xl`, `text-sm font-bold underline`, no icon, label = "Tailored resume"
- Non-fullWidth: unchanged (accent bg, small, with icon) — used in job list

### MatchCircle design (user approved)
- Inner circle fill: `bg-success-lightest` / `bg-info-lightest` / `bg-warning/10` based on score tier
- "match" text inside circle removed, "Match score" label below circle kept

### Data fixes (manual via Playwright scrape)
- Job `c471a9ef` (SimCorp Senior SE): full description fetched from Careerjet, `about_role` + `description_summary` updated
- Job `50d983be` (SimCorp Junior SE): same — Careerjet URL `dk2687a65504cf360f4d9d8fb2f5175739`

## Decisions made

- **Sidebar is one white card** containing all buttons + detail rows. AI Match Summary is separate card below.
- **Generate Cover Letter button** — do not add to sidebar (user removed it twice)
- **Match breakdown bars** — Skills % from matched/missing arrays ratio; Experience + Seniority use `match_score` as placeholder. Real data needs `match_breakdown jsonb` column + AI scorer update.
- **Job description rendering** — unified: split on `\n`, >1 line → bullets, else paragraph. Applies to both `description_summary` and `about_role` fallback.
- **Boolean null from PostgREST** — use `!value` not `=== false` for `onboarding_seen` checks
- **Missing skills**: `bg-error/10 text-error`. Matched skills: `bg-success-lightest text-success-foreground`

## Problems solved

- Careerjet blocks WebFetch (418) — use Playwright `browser_navigate` + `browser_evaluate` instead
- jobviewtrack redirect URLs resolve correctly in Playwright without special Referer headers
- Short `about_role` (< 500 chars) skips AI summarization — now falls back with same bullet renderer

## Current state

- Job detail page fully redesigned, all sidebar tweaks complete, user happy with design
- Onboarding flow working end-to-end
- Homepage images updated to Playwright screenshots
- Two SimCorp jobs have correct full descriptions in DB

## Next session starts with

No specific next task — ask the user what to work on.

## Open questions

- Match breakdown Experience/Seniority are placeholders — needs `match_breakdown jsonb` on `jobs` + AI scorer change
- Other jobs may have truncated `about_role` — handled case-by-case via Playwright scrape
- Emails not working in production (from previous session) — env vars need adding to InsForge deployment, `bandfolio.ai` needs Resend verification
- Should rejected users see different message on `/pending`? (from previous session)
- Should Admin nav link show badge count for pending users? (from previous session)
