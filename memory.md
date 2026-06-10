# Memory — Features 10–12 Complete + Maintenance

Last updated: 2026-06-10

## What was built

**Feature 10 — Adzuna Job Discovery:**
- `lib/utils.ts` — `MATCH_THRESHOLD = 70` and `formatDateAgo()`
- `lib/adzuna.ts` — `searchJobs()` with `category=it-jobs`, optional `where`, country param
- `types/index.ts` — added `JobRow`, `AdzunaJob`, and `ScoredJob` types
- `agent/find-jobs.ts` — full agent: profile load → PostHog `job_search_started` → create `agent_runs` record → Adzuna call → parallel GPT-4o scoring → filter by threshold → batch insert to `jobs` → PostHog `job_found` per match → update `agent_runs` complete. Insert failure marks run as `failed` and returns `{ success: false, error }`.
- `app/api/agent/find/route.ts` — POST endpoint: auth → validate `jobTitle` → call `findJobs()` → return `{ jobsFound, jobsSaved }`
- `components/find-jobs/SearchCard.tsx` — client component with `useState`, live fetch to `/api/agent/find`, `router.refresh()` after success, Enter key handler on both inputs, success/error banners

**Feature 11 — Filter + Sort + Pagination:**
- `app/find-jobs/page.tsx` — async server component, fetches all jobs for current user, passes as props to JobsTable
- `components/find-jobs/JobsTable.tsx` — client component with filter (All/High/Low), sort (Newest/Match Score/Oldest), live text search, pagination (20/page), rows navigate to `/find-jobs/[id]`

**Feature 12 — Job Details Page:**
- `app/find-jobs/[id]/page.tsx` — async server page (`params: Promise<{ id: string }>`); full detail view: header card, 4 info cards, AI Match Reasoning, Skills vs Profile (green matched / purple missing), Job Description with "View full description →" link, Company Research empty state (disabled button), full-width Apply Now

**Session fix — Cookie persistence:**
- `middleware.ts` — added `options: { accessToken: { maxAge: 7 days }, refreshToken: { maxAge: 30 days } }` to `updateSession()`. Previously cookies expired with JWT TTL, causing logout on every page refresh.

**Clear jobs button:**
- `app/api/jobs/clear/route.ts` — `DELETE` endpoint, removes all jobs for the authenticated user
- `components/find-jobs/JobsTable.tsx` — "Clear all" button in the filter bar. Only shown when `jobs.length > 0`. Two-state confirmation: first click → "Confirm clear" (red border/text), second click → executes and calls `router.refresh()`. Resets on blur.

## Decisions made

- **Job data architecture**: Jobs fetched server-side in `page.tsx`, passed as props to client `JobsTable`. `router.refresh()` from client components triggers re-fetch.
- **Filtering is client-side**: All filter/sort/pagination in memory after one server fetch. No DB round-trips per interaction.
- **Next.js 16 async params**: Dynamic route pages use `params: Promise<{ id: string }>` and `await params`.
- **InsForge DB pattern**: All DB calls use `insforge.database.from(...)` not `insforge.from(...)`.
- **InsForge auth pattern**: `insforge.auth.getCurrentUser()` not `auth.getUser()`.
- **PostHog server pattern**: Singleton `getPostHogClient()` from `lib/posthog-server.ts`; uses `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`.
- **Cookie TTL override**: `updateSession` accepts `options.accessToken.maxAge` and `options.refreshToken.maxAge` to override JWT-derived expiry. This is the correct way to extend session lifetime.
- **Destructive button pattern**: Two-click confirmation — no modal. Default: `border-border text-text-secondary`. Confirm state: `border-error text-error bg-surface-secondary`. No `error-lightest` token exists — `bg-surface-secondary` is the correct confirm highlight. Resets on blur.
- **Company Research button**: Disabled in Feature 12 — wired in Feature 13.

## Problems solved

- **Jobs not showing after search**: JobsTable was using mock data. Fixed by making `find-jobs/page.tsx` an async server component fetching real DB data.
- **Session logout on page refresh**: Cookies expired with JWT TTL. Fixed in `middleware.ts` with explicit `maxAge` overrides.
- **Job description cut off**: Added "View full description →" link at bottom of Job Description card.
- **`salary_max!` unsafe assertion**: Changed to safe double-check `r.job.salary_min && r.job.salary_max`.
- **Insert failure returning success**: Agent now marks run as `failed` and returns `{ success: false }` when DB insert fails.
- **MATCH_THRESHOLD hardcoded**: Moved to `lib/utils.ts`, imported everywhere.

## Current state

- Phase 1 Foundation (01–04): complete
- Phase 2 Profile Page (05–08): complete
- Phase 3 Find Jobs (09–11): complete
- Phase 4 Job Details (12): complete — UI with real data, company research shows empty state
- Session persistence: fixed — 7-day access / 30-day refresh token cookies
- Clear all jobs: complete — button in filter bar with two-click confirmation
- Feature 13 (Company Research Agent): not started
- Phase 5 Dashboard: not started

## Next session starts with

**Feature 13 — Company Research Agent.**

Per `context/build-plan.md`:
- POST `/api/agent/research` receives `jobId`
- Resolve company homepage URL by following Adzuna redirect with `fetch(redirect_url, { redirect: "follow" })`, strip subdomain, construct `https://{rootDomain}`
- Open Browserbase session with Stagehand — homepage extraction + max 3 sub-pages
- GPT-4o synthesis (temperature 0.4) → dossier saved to `jobs.company_research` jsonb
- Wire the Research Company button in `app/find-jobs/[id]/page.tsx` — needs a `"use client"` child component that POSTs to `/api/agent/research` and calls `router.refresh()`
- PostHog event: `company_researched`

Run `/architect feature 13` before starting — Browserbase + Stagehand + GPT-4o synthesis is complex.

## Open questions

- For Feature 13, the Research Company button in the job details page needs a client wrapper. Pattern: extract the button + company research section into a separate `"use client"` component (like SearchCard is separate from the server page). The rest of the page stays a server component. Confirm this approach before building.
