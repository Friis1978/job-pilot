# Memory — Code Cleanup + Salary Display

Last updated: 2026-06-20

## What was built

### Refactoring (this session)
- **`components/find-jobs/SalaryDisplay.tsx`** — extracted from `app/find-jobs/[id]/page.tsx`. Standalone component showing original salary + DKK monthly conversion in sidebar.
- **`lib/utils.ts`** — added `CURRENCY_TO_DKK` constant (EUR: 7.46, USD: 6.80, GBP: 8.50, SEK: 0.65, NOK: 0.67) exported alongside `MATCH_THRESHOLD`.
- **`app/find-jobs/[id]/page.tsx`** — cleaned up: removed local `SalaryDisplay` and `CURRENCY_TO_DKK`, imports `SalaryDisplay` from components and no longer needs `CURRENCY_TO_DKK` directly. Also fixed Tailwind warnings: `w-[72px]`→`w-18`, `h-[72px]`→`h-18` in `MatchCircle`.

### From previous session (still current)
- Complete two-column job detail page redesign (`app/find-jobs/[id]/page.tsx`)
- `TailoredResumeButton` with `fullWidth` prop (`components/find-jobs/TailoredResumeButton.tsx`)
- Salary extraction in `agent/find-jobs.ts` — `extractSalaryFromText()` runs after enrichment for new jobs
- Two SimCorp jobs have full descriptions fetched from Careerjet (IDs: `c471a9ef`, `50d983be`)
- Air Apps job (`0e5e4c12`) salary manually set from Careerjet scrape

## Decisions made

- **`CURRENCY_TO_DKK` lives in `lib/utils.ts`** — shared constant, not buried in a component
- **`SalaryDisplay` is its own component** — `components/find-jobs/SalaryDisplay.tsx` (not in utils.ts which is plain TS, no JSX)
- **Tailwind `w-[51px]`/`h-[51px]`/`max-w-[180px]`** — left as arbitrary values, no clean Tailwind v3 equivalents
- **Salary extraction** — applies only to new jobs going forward; existing jobs with null salary confirmed to have vague language ("Competitive salary" etc), no retroactive update possible
- **Generate cover letter button** — do not add to sidebar (removed twice by user)
- **Sidebar is one white card** containing all buttons + detail rows; AI Match Summary is separate card below

## Problems solved

- Careerjet blocks WebFetch (418) — use Playwright `browser_navigate` + `browser_evaluate`
- `CURRENCY_TO_DKK` was inside `SalaryDisplay` function — moved to module level, then to utils

## Current state

- Job detail page fully functional with two-column layout, salary display with DKK conversion, match breakdown with progress bars + skills
- Onboarding flow working end-to-end
- All refactoring from this session complete — no partial work

## Next session starts with

No specific next task — ask the user what to work on.

## Open questions

- Match breakdown Experience/Seniority bars use `match_score` as placeholder — needs `match_breakdown jsonb` column on `jobs` + AI scorer update for real data
- Other jobs may have truncated `about_role` — handled case-by-case via Playwright scrape
- Emails not working in production — env vars need adding to InsForge deployment, `bandfolio.ai` needs Resend verification
- Should rejected users see different message on `/pending`?
- Should Admin nav link show badge count for pending users?
