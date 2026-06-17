# Memory — Auth Fix, Toast System, Job URL Resolution

Last updated: 2026-06-17

## What was built

### Auth fix (critical)
- **`app/auth/callback/route.ts`** — Fixed persistent logout. InsForge OAuth exchange returns the refresh token via `Set-Cookie` header, NOT in the JSON body. Previous code read `data.refreshToken` (always `undefined`). Fix: parse token from header with regex `insforge_refresh_token=([^;]+)`, pass `extractedRefreshToken` to `setAuthCookies`. Also corrected `refreshToken.maxAge` from 30 days to 7 days to match InsForge's JWT TTL.
- **`proxy.ts`** — Removed temporary debug `console.log` statements. Cleaned up unused `error` and `refreshed` destructure vars: `const { accessToken } = await updateSession({...})`.

### Job URL & pipeline fixes
- **`agent/find-jobs.ts`** — Multiple changes:
  - Added `adzuna` to Denmark sources in `detectSources()`
  - `FindJobsResult` type includes `jobsSkipped?: number`
  - Only skips jobs with literally empty URL — tracking links are kept, resolution is attempted
  - Logs skipped (empty-URL) jobs to `skipped_jobs` DB table with reason/score
  - Returns `jobsSkipped` count
  - **New `resolveTrackingUrl` function** — resolves `jobviewtrack.com` URLs to employer URLs. Uses `Referer: https://www.careerjet.dk/` (required; without it jobviewtrack bounces back to Careerjet listing, not employer page). 10-second timeout.
  - **Refactored `enrichJobDescription`** — calls `resolveTrackingUrl` first (always), then description enrichment only for short snippets. `AGGREGATOR_DOMAINS` extracted to module level, shared by both functions.
- **`lib/adzuna.ts`** — Removed hardcoded `category: "it-jobs"` filter (was blocking Danish job titles)
- **`lib/glassdoor.ts`** — Filters listings where `jobViewUrl` is null before mapping (was producing empty-string URLs)
- **DB: `skipped_jobs` table** — Created to log jobs that pass scoring but have no URL

### Toast system overhaul
- **`lib/toast.ts`** — Added `"info"` type alongside `"success"`, `"error"`, `"warning"`
- **`components/ui/Toaster.tsx`** — Added `InfoIcon` SVG and blue `text-info-foreground` styling for info toasts
- **`components/find-jobs/SearchCard.tsx`** — Removed inline success banner. Now shows toasts on search completion: success (jobs found), info (no match), warning (jobs skipped due to missing URL)
- **`app/api/agent/find/route.ts`** — Passes `jobsSkipped` through to client
- **`components/profile/ResumeUpload.tsx`** — Replaced inline error state with `toast(..., "error")`
- **`components/profile/ProfileForm.tsx`** — Replaced `saveError`/`generateResumeError` state with toasts; sticky footer condition updated
- **`app/auth/login/page.tsx`** — Replaced inline error state with toast
- **`components/find-jobs/ApplicationPipeline.tsx`**, **`BulkOpsProvider.tsx`**, **`JobsTable.tsx`**, **`CoverLetterSection.tsx`**, **`TailoredResumeButton.tsx`**, **`StatusBadge.tsx`** — All error toasts have explicit `"error"` type; "No jobs to research" uses `"info"`

## Decisions made

- **Refresh token source**: InsForge puts refresh token in `Set-Cookie` header on the exchange endpoint, not JSON body. This is permanent — always extract from header in callback.
- **Careerjet/jobviewtrack**: Careerjet routes ALL job links through `jobviewtrack.com`. These URLs work at import time but expire. `resolveTrackingUrl` resolves them to employer URLs using the Careerjet Referer. If resolution fails, the jobviewtrack URL is saved as fallback.
- **Only skip truly empty URLs**: Tracking/aggregator links are acceptable — resolution is attempted, not a filter gate.
- **`proxy.ts` not `middleware.ts`**: Next.js 16 in this project uses `proxy.ts`. Never create `middleware.ts` — causes startup conflict "Both middleware file and proxy file detected."
- **Toast types**: success = find/save success, error = failures, warning = partial success (skipped jobs), info = neutral outcome (no results, no jobs selected)
- **Toasts over inline errors**: All async operation errors use toasts. Form validation field hints remain inline.

## Problems solved

- **Persistent logout**: InsForge exchange response JSON has no `refreshToken` key. Fix: parse from `Set-Cookie` header in `app/auth/callback/route.ts`.
- **Denmark search no results**: `detectSources()` excluded Adzuna for Denmark; Adzuna `category: "it-jobs"` filter also blocked Danish titles. Both fixed.
- **Careerjet jobs all blocked**: Original filter excluded `jobviewtrack.com` URLs. Careerjet routes everything through jobviewtrack. Removed tracking-domain filter — only empty URLs rejected.
- **Glassdoor null URLs**: `header.jobViewUrl` could be null → empty string URL. Fixed by filtering at source.
- **jobviewtrack not resolving**: `enrichJobDescription` didn't include a Referer, so jobviewtrack bounced back to Careerjet instead of employer. Fixed with dedicated `resolveTrackingUrl` using correct Referer.
- **`middleware.ts` conflict**: Next.js 16 uses `proxy.ts` — never create `middleware.ts`.

## Current state

- Auth fix is in place but not yet confirmed by a full login cycle. User should log out and back in, wait 6+ minutes, verify no logout.
- All toast types work: success, error, warning, info.
- Job search shows toasts for found/skipped/no-match outcomes.
- Denmark/Copenhagen searches include Adzuna results.
- Careerjet jobs imported; jobviewtrack URLs resolved to employer URLs at import time via Referer trick (in place but not yet production-tested).
- `skipped_jobs` table exists for diagnostic purposes.

## Next session starts with

Test the jobviewtrack URL resolution in production: run a search for a Danish job title, then check imported jobs' `external_apply_url` in the DB — should be employer domain (e.g. `nuuday.dk`), not `jobviewtrack.com`. If still jobviewtrack, the Referer approach failed and a different technique is needed (e.g. parsing `Location` header from raw 302 response).

## Open questions

- Does the Referer fix actually resolve jobviewtrack to employer URLs in production? Needs a real search to confirm.
- Has the auth fix been confirmed working after a full login cycle (log out → log in → wait 6 min)?
- Diagnostic `console.log` may still exist in `agent/research-company.ts` from a previous session — check and remove if present.
