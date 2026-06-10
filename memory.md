# Memory — Dashboard Phase 5 (Features 14–16 reviewed + fixed)

Last updated: 2026-06-10

## What was built

**This session — review + fixes for Features 15 and 16:**

`components/dashboard/StatsBar.tsx`:
- `TrendBadge` now conditionally applies `bg-success-lightest text-success-darker` for positive trends and `bg-surface-secondary text-text-secondary` for negative/zero trends. Previously always rendered green.

`app/dashboard/page.tsx` — four fixes:
- `AgentRunRow.started_at` type changed from `string` to `string | null` (matches DB schema: `isNullable: YES`)
- `type Timestamped` moved to module scope (was incorrectly declared inside async `DashboardPage` function)
- `Promise.all` for activity queries replaced with `Promise.allSettled` — a DB failure no longer crashes the entire dashboard page
- Zero-jobs filter added: `.filter((run) => (run.jobs_found ?? 0) > 0)` prevents "Found 0 jobs for X" appearing in the activity feed

## Decisions made

- **`Promise.allSettled` for activity queries** — fault isolation: if `agent_runs` or `jobs` query fails independently, the page still renders with whatever data is available. Stats query (single query, no allSettled) is accepted as-is — if it fails the page can't render meaningful stats anyway.
- **Negative trend styling uses `bg-surface-secondary text-text-secondary`** — neutral look, not red/error, because a lower match rate week-over-week is informational, not an error state.
- **Dashboard page is a pure Server Component** — auth check + all data fetching in `app/dashboard/page.tsx`. No client-side data fetching on the dashboard.
- **Charts use inline SVG with CSS variable colors** — no chart library. Feature 17 will replace static data with PostHog queries.
- **`agent_runs.started_at` confirmed nullable in DB** — `isNullable: YES`. Null guarded with `?? new Date().toISOString()` in formatDateAgo call.
- **No `researched_at` column on jobs** — `found_at` used as proxy for research timestamp. Accepted approximation.

## Problems solved

- **TrendBadge always green** — was `bg-success-lightest text-success-darker` hardcoded regardless of `isPositive`. Fixed with conditional className.
- **Stagehand v3.5 API mismatch** — `library-docs.md` showed old object-form `extract({ instruction, schema })` and `"openai/gpt-4o"` model prefix. Fixed in earlier sessions.
- **ATS domain research** — `resolveCompanyUrl` was resolving `greenhouse.io`/`lever.co` as company homepages. Fixed with ATS_AND_JOB_BOARD_DOMAINS blocklist.

## Current state

- Phase 1–4 complete (Features 01–13)
- Phase 5: Features 14, 15, 16 complete and reviewed — all issues resolved
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
