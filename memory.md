# Memory — Dashboard Stats Overhaul

Last updated: 2026-07-13

## What was built

### Dashboard StatsBar — full rebuild
- `components/dashboard/StatsBar.tsx` — replaced old 4-card layout with new shape:
  - **Jobs found this month** (vs last month, shows prior month count)
  - **Avg. Match Rate** (vs last week, shows prior week % value)
  - **Applied this week** (vs last week Mon–Sun calendar weeks, shows prior week count)
  - **Jobs this week** (vs last week rolling, shows prior week count)
- `TrendBadge` updated: negatives are red (`bg-error/10 text-error`), positives green, zero neutral. Shows `+X% · N last week/month` inline.
- Old "Companies researched" card removed entirely.

### PostHog query (`lib/posthog-query.ts`)
- `DashboardStats` type updated: `jobsThisMonth`, `jobsLastMonth`, `jobsThisWeek`, `jobsLastWeek`, `avgMatchRate`, `avgMatchRateThisWeek`, `avgMatchRateLastWeek`
- Single HogQL query for all job_found metrics (no longer parallel with a second query)
- Companies researched PostHog query removed

### Dashboard page (`app/dashboard/page.tsx`)
- `appliedThisWeek` / `appliedLastWeek` computed from already-fetched `pipelineResult` (jobs table, `status = applied`, `updated_at`) — no extra DB call
- Week boundary = calendar week Mon 00:00 UTC, not rolling 7 days
- `statsData` now passes all prior-period values to StatsBar for display

### Status tracking (`app/api/jobs/[id]/status/route.ts`)
- Added `job_status_changed` PostHog event on every status change: `{ jobId, status }`
- Uses existing `lib/posthog-server.ts` singleton client
- Non-blocking (try/catch around capture)

### PipelineCard (`components/dashboard/PipelineCard.tsx`)
- Interview rate percentage changed from `text-accent` to `text-success` (green)

### TokenUsageChart (`components/dashboard/TokenUsageChart.tsx`)
- Balance moved from separate right-aligned block to inline after "cost" label: `$4.66 cost balance: $37.19`
- Red if balance < $2

### Demo dashboard (`app/demo-dashboard/page.tsx`)
- `DEMO_STATS` updated to match new `StatsData` type shape

## Decisions made

- **Applied count from DB, not PostHog** — pipelineResult (jobs table) already fetched for pipeline card; no need for a separate PostHog query. PostHog is used only for job_found metrics where DB doesn't have the data.
- **Calendar week boundaries for "applied this week"** — rolling 7 days was wrong (today is Monday, so 7 days ago includes last week). Start of week = Monday 00:00 UTC.
- **PostHog tracks all status changes** — event `job_status_changed` with `status` property allows future HogQL queries by status (applied, interviewing, offer, rejected, etc.)

## Problems solved

- `DEMO_STATS` in `app/demo-dashboard/page.tsx` was using old StatsData shape — caused TS build error on deploy. Fixed by updating DEMO_STATS to new shape.
- Applied count was showing inflated number (e.g. 5 instead of 2) because "7 days ago" window included days from the previous calendar week.

## Current state

- All four stat cards show correct data with prior-period comparison values
- Job status changes tracked in PostHog for future analytics
- TypeScript compiles clean (verified with `tsc --noEmit`)
- README updated with dashboard stats table and PostHog tracking note

## Next session starts with

Whatever feature comes next. Dashboard stats are complete. PostHog event tracking for all status changes is wired. Applied count from DB is correct with calendar week boundaries.

## Open questions

- `avgMatchRateLastWeek` in StatsBar shows `0%` for new users with no prior week data — may want to show "—" instead of "0% last week".
- PostHog `job_found` events use rolling 7-day windows for week comparison (not calendar week) — inconsistency with the applied card which uses calendar weeks. May want to align these.
