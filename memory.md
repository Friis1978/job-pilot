# Memory — Review Fixes + UX Polish

Last updated: 2026-06-10

## What was built

### Review fixes (post-/review)
- `agent/find-jobs.ts` — added `status: "saved"` explicitly to job insert payload. No longer relies on DB DEFAULT alone.
- `components/find-jobs/TailoredResumeButton.tsx` — fixed Firefox download bug: `document.body.appendChild(a)` before `.click()`, `document.body.removeChild(a)` after. `URL.revokeObjectURL` still called last.
- `app/api/jobs/[id]/tailored-resume/route.ts` — added `getPostHogClient()` import + fires `tailored_resume_generated` event (userId, jobId, company) + `await posthog.shutdown()` before returning PDF stream.

### Nav links hidden when logged out
- `components/layout/Navbar.tsx` — `<nav>` wrapped in `{user && (...)}`. Dashboard/Find Jobs/Profile only visible when logged in.

### "Start for free" → "Log in" for returning users
- `app/auth/callback/route.ts` — sets `jp_has_account=1` cookie (1 year, path="/", sameSite=lax) on successful login.
- `app/page.tsx` — made async, reads `jp_has_account` via `cookies()`, passes `hasAccount` to Navbar.
- `components/layout/Navbar.tsx` — `hasAccount?: boolean` prop; renders "Log in" when `!user && hasAccount`, "Start for free" otherwise.

### Profile completion at 100%
- `components/profile/CompletionIndicator.tsx` — at percentage===100: green ring (#10b981), checkmark icon, "Profile complete" heading, positive description, no missing field chips.

### Feature 20 — Application Status Tracking (previous session, now confirmed correct)
- `components/find-jobs/StatusBadge.tsx`, `components/dashboard/PipelineCard.tsx`, `app/api/jobs/[id]/status/route.ts` created.
- `types/index.ts` — `status: string` in JobRow.
- `app/find-jobs/page.tsx` — `status` in select query.
- `components/find-jobs/JobsTable.tsx` — Status column with StatusBadge.
- `app/find-jobs/[id]/page.tsx` — StatusBadge in job header.
- `app/dashboard/page.tsx` — pipeline counts + PipelineCard paired with RecentActivity.

### Tailored Resume (previous session, now confirmed correct)
- `app/api/jobs/[id]/tailored-resume/route.ts` — GPT-4o generates tailored summary + reordered skills + rewritten bullets, streams PDF as download. PostHog event now fires.
- `components/find-jobs/TailoredResumeButton.tsx` — download trigger, Firefox-safe.
- `app/find-jobs/[id]/page.tsx` — "Tailored Resume" card above Cover Letter section.
- `app/api/resume/ResumePDF.tsx` — optional `skills?: string[]` in GeneratedContent.

## Decisions made

- **`status: "saved"` explicit in insert** — never rely on DB DEFAULT alone. Explicit is safer and self-documenting.
- **jp_has_account cookie** — set server-side in auth callback, read server-side in homepage. No client flash. 1 year TTL.
- **Tailored resume streams PDF directly** — no DB column, no storage. Always fresh on demand.
- **Skills reordering via GPT-4o** — same skills list reordered, not filtered. Prompt: "do not add or remove any".
- **Cover letter uses `cover_letter_tone`** — confirmed at agent/generate-cover-letter.ts:45. Defaults to "Professional".

## Problems solved

- **Firefox download bug** — detached `<a>` elements don't trigger downloads in Firefox. Fixed by appending to body first.
- **Status DEFAULT gap** — new jobs now explicitly set `status: "saved"` in insert, independent of DB column DEFAULT.

## Current state

All features through Feature 20 complete. Tailored Resume done (bonus). All review issues resolved.
Feature 21 (Scheduled Job Alert Emails) is on hold — architect session was started but not completed.

## Next session starts with

Either: resume Feature 21 (run /architect feature 21, check context/build-plan.md — uses Resend for email, cron endpoint at /api/cron/job-alerts protected by CRON_SECRET), or new UX polish as user directs.

## Open questions

- Feature 13 company research ~60-120s — will timeout on Vercel free tier. Address at deployment.
- Dashboard CompanyResearchChart is single child in 2-col grid — renders half-width on desktop. Consider col-span-2 or pairing with another card.
- next/image OAuth avatar URLs — may need remotePatterns in next.config.ts if broken images appear.
- RapidAPI key was pasted in a prior session chat — consider rotating at rapidapi.com/developer/apps.
