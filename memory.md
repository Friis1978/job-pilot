# Memory — Dashboard Phase 5 (Features 14–16 complete)

Last updated: 2026-06-10

## What was built

**Feature 13 review + fixes (session start):**
- `agent/research-company.ts` — `resolveCompanyUrl` now checks an `ATS_AND_JOB_BOARD_DOMAINS` list (greenhouse.io, lever.co, workday.com, etc.) before extracting root domain; falls back to `https://www.${cleanName}.com` for ATS/job-board redirects
- `app/find-jobs/[id]/page.tsx` — removed dead `SearchIcon` function (was defined but never called after ResearchButton moved to its own file)
- `context/library-docs.md` — Stagehand section corrected to v3.5 API: `modelName: "gpt-4o"` (no `"openai/"` prefix), `extract(instruction, schema)` positional args (not object form)

**Feature 14 — Dashboard Page Full UI:**
- `components/dashboard/StatsBar.tsx` — 4 stat cards (Total Jobs Found, Avg Match Rate, Companies Researched, Jobs This Week)
- `components/dashboard/RecentActivity.tsx` — timeline list with colored dots and connector lines
- `components/dashboard/CompanyResearchChart.tsx` — blue SVG bar chart, 7-day week, Y-axis 0–12
- `components/dashboard/JobsOverTimeChart.tsx` — purple SVG area/line chart, Catmull-Rom smooth curve, gradient fill
- `components/dashboard/MatchScoreChart.tsx` — green SVG bar chart, 5 score buckets (50-60% through 90-100%)
- `app/dashboard/page.tsx` — replaced `"use client"` stub with Server Component; auth redirect + 3-row responsive grid layout

**Feature 15 — Stats Bar Real Data:**
- `StatsBar.tsx` — now accepts `StatsData` props (totalJobs, avgMatchRate, companiesResearched, jobsThisWeek, totalJobsTrend, matchRateTrend). `TrendBadge` subcomponent renders +X%/-X% when prior-week data exists.
- `app/dashboard/page.tsx` — single DB query on `jobs` table fetches `match_score, company_research, found_at`; computes all 4 stats + week-over-week trends in JS

**Feature 16 — Recent Activity Real Data:**
- `RecentActivity.tsx` — `ActivityItem` type exported, accepts `activities: ActivityItem[]` prop, has empty state ("No activity yet")
- `app/dashboard/page.tsx` — two parallel DB queries via `Promise.all`:
  - `agent_runs` filtered by `status = "complete"`, ordered by `started_at DESC`, limit 10 → "Found N jobs for [title]"
  - `jobs` filtered by `company_research IS NOT NULL`, ordered by `found_at DESC`, limit 10 → "Researched [company]"
  - Merged, sorted by timestamp DESC, trimmed to 8 entries

## Decisions made

- **Dashboard page is a pure Server Component** — auth check + all data fetching in `app/dashboard/page.tsx`. No client-side data fetching on the dashboard.
- **Charts use inline SVG with CSS variable colors** — no chart library installed. `var(--color-info)` for blue bars, `var(--color-accent)` for line chart, `var(--color-success)` for green bars. Features 14–16 use static placeholder data; Feature 17 will replace charts with PostHog data.
- **agent_runs.started_at confirmed default `now()`** — schema checked via MCP. No `created_at` column on agent_runs. Status value for completed runs is `"complete"` (not `"completed"`).
- **No `researched_at` column on jobs** — company research timestamp approximated with `found_at`. Jobs table has no `updated_at` either. Accepted approximation for Feature 16.
- **Trend badges fall back gracefully** — when no last-week data exists (`previous === 0`), `weekTrend()` returns `null` and the badge is replaced with static "vs last week" muted text.
- **Logout removed from dashboard** — the placeholder `"use client"` dashboard had a logout button. Removed when converting to Server Component. No logout in design; can be added to Navbar later.

## Problems solved

- **Stagehand v3.5 API mismatch** — `library-docs.md` showed old object-form `extract({ instruction, schema })` and `"openai/gpt-4o"` model prefix. Fixed to positional args and `"gpt-4o"`.
- **ATS domain research** — `resolveCompanyUrl` was resolving `greenhouse.io`/`lever.co` as company homepages for non-Adzuna jobs. Fixed with ATS_AND_JOB_BOARD_DOMAINS blocklist.

## Current state

- Phase 1–4 complete (Features 01–13)
- Phase 5: Features 14, 15, 16 complete
- Dashboard shows: real stat counts, real recent activity (job searches + company research)
- Dashboard charts still use static placeholder data (Feature 17 pending)
- TypeScript: clean (`tsc --noEmit` passes with 0 errors)

## Next session starts with

**Feature 17 — Analytics Charts — PostHog Data.**

Build plan spec:
- Jobs Found Over Time — query PostHog for `job_found` events for current userId, last 30 days, group by day
- Match Score Distribution — query PostHog for `job_found` events, extract `matchScore` property, group into 50-60/60-70/70-80/80-90/90-100 buckets
- Company Research Activity — query PostHog for `company_researched` events for current userId, last 7 days, group by day
- All three charts rendered — replace static SVG placeholder data with real PostHog data
- Empty state shown for each chart when no data exists

PostHog server client is at `lib/posthog-server.ts`. Events are fired with `distinctId = userId`. The three chart components (`CompanyResearchChart`, `JobsOverTimeChart`, `MatchScoreChart`) need to accept real data as props.

Run `/architect feature 17` before building — PostHog query API needs research (it uses the PostHog Events API or node client, not the browser capture API).

## Open questions

- Feature 17 PostHog query API: the server-side `posthog-node` client has a `getFeatureFlag` and event capture API, but querying historical events requires either the PostHog REST API (api.posthog.com/api/events) or PostHog's Insights API. Needs investigation before building.
- `JOOBLE_API_KEY` not registered — Jooble calls fail silently via `Promise.allSettled`.
- Feature 13 company research blocks ~60–120s — will timeout on Vercel free tier. Address at deployment.
- RapidAPI key was pasted in chat in a prior session — user should consider rotating it at rapidapi.com/developer/apps if this is a shared repo.
