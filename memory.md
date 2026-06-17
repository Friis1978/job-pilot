# Memory — Auth Fix, Toast Audit, Job Import Rule

Last updated: 2026-06-17

## What was built

### Auth fix (critical)
- **`app/auth/callback/route.ts`** — Fixed persistent logout. InsForge OAuth exchange returns the refresh token via `Set-Cookie` header, NOT in the JSON body. Previous code read `data.refreshToken` (always `undefined`). Fix: parse token from header with regex `insforge_refresh_token=([^;]+)`, pass `extractedRefreshToken` to `setAuthCookies`. Also corrected `refreshToken.maxAge` from 30 days to 7 days to match InsForge's JWT TTL.
- **`proxy.ts`** — Removed temporary debug `console.log` statements. Cleaned up unused `error` and `refreshed` destructure vars.

### Job import rule
- **`agent/find-jobs.ts`** — Jobs from tracking domains (`jobviewtrack`, `careerjet`, `jooble`) are now skipped entirely (not saved with null URL). Changed from `resolvedUrl()` returning null to filtering out those jobs before insert. `jobsWithUrl` replaces `qualifyingJobs` throughout the save/PostHog/return block.
- Rule: jobs must always have a valid `external_apply_url` — never import without one.

### Toast system overhaul
- **`lib/toast.ts`** — Added `"info"` type
- **`components/ui/Toaster.tsx`** — Added `"info"` type with blue `text-info-foreground` styling and InfoIcon SVG
- **`components/find-jobs/ApplicationPipeline.tsx`** — Added `"error"` type to status update failure toast
- **`components/find-jobs/StatusBadge.tsx`** — Added `"error"` type
- **`components/find-jobs/JobsTable.tsx`** — Added `"error"` type to delete failure
- **`components/find-jobs/CoverLetterSection.tsx`** — Added `"error"` to download failure toast
- **`components/find-jobs/SearchCard.tsx`** — Added `"error"` to all 6 error toasts (search/import failures, timeouts)
- **`components/find-jobs/TailoredResumeButton.tsx`** — Added `"error"` to both failure toasts
- **`components/BulkOpsProvider.tsx`** — Changed "No jobs to research" from `"success"` to `"info"`
- **`components/profile/ResumeUpload.tsx`** — Removed `uploadError`/`extractError` state + inline `<p>` displays; all errors now use `toast(..., "error")`
- **`components/profile/ProfileForm.tsx`** — Removed `saveError`/`generateResumeError` state + inline displays; all errors use `toast(..., "error")`; sticky footer condition no longer depends on `saveError`
- **`app/auth/login/page.tsx`** — Removed `error` state + inline `<p>`; OAuth failure uses `toast(..., "error")`

## Decisions made

- **Refresh token source**: InsForge puts refresh token in `Set-Cookie` header on the exchange endpoint, not JSON body. This is permanent — always extract from header in callback.
- **Job URL is required**: Jobs must not be imported if `external_apply_url` cannot be extracted. Jobs from tracking domains are skipped, not saved with null URL.
- **Info toast type**: Added `"info"` for neutral/informational messages (e.g. "No jobs to research") that are neither success nor error.
- **Toasts over inline errors**: All async operation errors use toasts, not inline state. Form validation inline hints remain inline as field-level feedback.

## Problems solved

- **Persistent logout**: Root cause was refresh token never stored. InsForge exchange response JSON keys were `["accessToken", "user", "csrfToken"]` — no `refreshToken`. Fix: parse from `Set-Cookie` header.
- **`middleware.ts` conflict**: Next.js 16 uses `proxy.ts` as middleware. Creating `middleware.ts` causes startup error "Both middleware file and proxy file detected." Never create `middleware.ts`.
- **Toast type default**: Default toast type is `"success"` — many error toasts were missing explicit type and showing green. All now have explicit types.

## Current state

- Auth fix is in place but not yet verified by a fresh login. User must log out and back in to confirm the refresh token is now stored and sessions last beyond 5 minutes.
- All toast calls have correct explicit types across the entire app.
- Job import now requires a valid URL — tracking domain jobs are discarded.
- Cover letter history table exists — old versions are archived before overwrite.
- `SessionKeepAlive` component pings `/api/auth/refresh` every 3 minutes as a keepalive (backup to proxy refresh).

## Next session starts with

Ask user to confirm auth fix worked — log out, log back in, wait 6+ minutes, verify no logout. If confirmed working, the persistent logout bug is closed.

## Open questions

- Has the auth fix been confirmed working after a full login cycle?
- No UI exists to browse cover letter history — could add a "history" dropdown to the cover letter section if the user wants it.
- Diagnostic `console.log` may still exist in `agent/research-company.ts` from a previous session — check and remove if present.
