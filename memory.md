# Memory — UX Improvements + Auth + Skill Filter

Last updated: 2026-06-10

## What was built

**Toast system:**
- `lib/toast.ts` — dispatches `app:toast` custom DOM event
- `components/ui/Toaster.tsx` — listens for event, renders top-right toast stack, auto-dismisses after 5s, error/success variants
- Mounted in `app/layout.tsx`

**SearchCard improvements (`components/find-jobs/SearchCard.tsx`):**
- 30s `AbortController` timeout on fetch, specific "timed out" toast message
- Spinner SVG in button while loading
- Errors via toast (inline `<p>` error removed)
- Min match score dropdown (50%, 60%, 70%), default 50%, between location and button
- Passes `minScore` in fetch body

**Match score threshold + location enforcement (`agent/find-jobs.ts`):**
- `findJobs()` accepts `minScore` param (default `MATCH_THRESHOLD`)
- `scoreJob()` accepts `searchedLocation` — injects hard location rule into GPT-4o system prompt: if job location doesn't match and isn't remote, set matchScore to 0
- API route (`app/api/agent/find/route.ts`) validates `minScore >= 50`, passes through

**Delete single job:**
- `app/api/jobs/[id]/route.ts` — DELETE handler scoped to `user_id`
- `JobsTable` — trash icon per row, visible on hover (`group`/`group-hover`), calls DELETE, toast on error, `router.refresh()` on success
- `toast` imported in `JobsTable`

**Skill filter in `components/find-jobs/JobsTable.tsx`:**
- `matched_skills: string[] | null` added to `JobRow` type (`types/index.ts`)
- Page query updated to include `matched_skills`
- Skill chips derived from all jobs, sorted by frequency
- `selectedSkills: Set<string>` state, OR logic filter
- Chips rendered between filter bar and table; active chips highlighted in accent; "Clear" link when active

**User avatar in Navbar (`components/layout/Navbar.tsx`):**
- Accepts `NavUser` prop: `{ name, email, avatarUrl }`
- Logged in: circular avatar (image or initials), click opens dropdown with name/email, Profile link, Sign out button
- Sign out: `POST /api/auth/logout` then `router.push("/")` + `router.refresh()`
- Not logged in: "Start for free" button (unchanged)
- All protected pages (dashboard, find-jobs, find-jobs/[id], profile) pass user to Navbar
- Homepage reverted to simple sync component — NO auth check (was causing hangs)

**Auth redirects fixed:**
- All `redirect("/auth/login")` and `redirect("/login")` changed to `redirect("/")`
- `app/profile/page.tsx` — added `redirect` import and `if (!userId) redirect("/")`

**PostHog timeout fix (`lib/posthog-query.ts`):**
- `AbortController` with 8s timeout on every `hogql()` fetch call
- `finally { clearTimeout(timeoutId) }` to clean up
- Prevents dashboard hanging forever when PostHog is slow

## Decisions made

- **Homepage stays sync** — adding `createInsforgeServer()` to homepage caused blocking network requests for every visitor (including unauthenticated redirects from dashboard), resulting in infinite rendering. Homepage shows "Start for free" regardless of auth state; avatar only shown on authenticated app pages.
- **Location enforcement via GPT-4o prompt** — location rule injected as hard constraint into scoring prompt, not as a post-filter. Only applied when `searchedLocation` is non-empty.
- **Min score floor is 50** — enforced both in UI (dropdown starts at 50%) and API route (rejects < 50 server-side).
- **OR logic for skill filter** — shows jobs matching ANY selected skill. Simpler for discovery.
- **Skill frequency ordering** — chips sorted by how many jobs have each skill, most common first.

## Problems solved

- **Dashboard rendering forever** — two causes: (1) PostHog `fetch` had no timeout; fixed with 8s AbortController. (2) Homepage's new `createInsforgeServer()` call blocked on network request; reverted homepage to sync.
- **Duplicate jobs across sources** — URL dedup + title+company dedup before scoring. DB cleaned of 10 prior duplicates.

## Current state

- Phase 1–5 complete (Features 01–17) + significant session improvements
- Dashboard: real stats, activity feed (4 + modal), chart data, 8s PostHog timeout
- Find Jobs: search history, skill filter chips, per-row delete, min score dropdown, location enforced
- Navbar: user avatar/initials + dropdown on all authenticated pages
- Auth: all redirects go to `/`, profile page now properly guards unauthenticated access
- TypeScript: clean
- PostHog project: "Job Pilot" (id: 197754), org: "Friismusic", host: eu.posthog.com

## Next session starts with

Phase 6 — TBD. No next feature defined yet. Check `context/build-plan.md` for the next phase, or ask the user.

## Open questions

- `JOOBLE_API_KEY` in `.env.local` but not registered — Jooble calls fail silently.
- Feature 13 company research blocks ~60–120s — will timeout on Vercel free tier. Address at deployment.
- RapidAPI key was pasted in chat in a prior session — consider rotating at rapidapi.com/developer/apps.
- `next/image` with OAuth avatar URLs (Google/GitHub) — domains may need adding to `remotePatterns` in `next.config.ts` if broken images appear.
