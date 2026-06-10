# Memory — Job Deduplication + Dashboard Freshness

Last updated: 2026-06-10

## What was built

**Recent Activity modal (`components/dashboard/RecentActivity.tsx` — rewritten as client component):**
- Shows first 4 activities in the card
- "View all" button appears when `activities.length > 4`
- Modal with fixed overlay, scrollable list of all activities, close button, click-outside-to-dismiss
- `ActivityList` extracted as shared sub-component used by both card and modal

**`app/dashboard/page.tsx`:**
- Activity DB query limits raised from 10 → 20
- Activities merge slice raised from 8 → 20

**Job deduplication in `agent/find-jobs.ts`:**
- Before scoring: fetches existing `source_url`, `title`, `company` for the user from DB
- Guard 1: skip if `source_url` already exists
- Guard 2: skip if `title.toLowerCase() + company.toLowerCase()` already exists (catches cross-source duplicates)
- Both checks happen before OpenAI scoring — no wasted GPT-4o calls on duplicates

**Existing duplicates cleaned from DB:**
- Ran SQL: `DELETE FROM jobs WHERE id IN (SELECT id ... ROW_NUMBER() OVER (PARTITION BY user_id, title, company ORDER BY found_at ASC) rn ... WHERE rn > 1)`
- Deleted 10 duplicate rows, kept oldest per title+company+user

**`app/api/agent/find/route.ts`:**
- Added `revalidatePath("/dashboard")` after successful search
- Dashboard cache is purged on every successful job search — numbers always fresh on next visit

## Decisions made

- **Deduplication before scoring** — save OpenAI API costs by filtering known jobs before GPT-4o runs
- **Dual deduplication keys** — `source_url` (exact) + `title+company` lowercase (fuzzy cross-source). Same job on Jooble and CareerJet will have different URLs but same title+company.
- **Keep oldest on dedup cleanup** — `ORDER BY found_at ASC` keeps the original entry, deletes re-fetched copies
- **`revalidatePath("/dashboard")` not `revalidateTag`** — simple path revalidation is sufficient; dashboard has no custom cache tags

## Problems solved

- Same job appearing multiple times in the jobs list (from multiple search runs or multiple sources)
- Dashboard stats showing stale counts after a new search

## Current state

- Phase 1–5 complete (Features 01–17)
- Dashboard fully wired: real stats, real recent activity, real PostHog chart data
- Job deduplication active: both URL and title+company guards in place
- DB cleaned of 10 prior duplicates
- TypeScript: clean (tsc --noEmit passes)
- PostHog project: "Job Pilot" (id: 197754), org: "Friismusic", host: eu.posthog.com

## Next session starts with

Phase 6 — TBD. No next feature defined yet. Check `context/build-plan.md` for the next phase, or ask the user.

## Open questions

- `JOOBLE_API_KEY` is in `.env.local` but not registered — Jooble calls fail silently.
- Feature 13 company research blocks ~60–120s — will timeout on Vercel free tier (10s limit). Address at deployment.
- RapidAPI key was pasted in chat in a prior session — consider rotating at rapidapi.com/developer/apps if this is a shared repo.
- PostHog stats lag: `revalidatePath` forces a fresh DB + PostHog fetch on next dashboard visit, but PostHog event ingestion itself has some latency (~seconds). In practice this is fine.
