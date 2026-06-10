# Memory — Feature 20 Complete + Tailored Resume

Last updated: 2026-06-10

## What was built

### Feature 20 — Application Status Tracking (completed)
- `types/index.ts` — added `status: string` to `JobRow`
- `app/find-jobs/page.tsx` — added `status` to DB select query
- `components/find-jobs/JobsTable.tsx` — imported `StatusBadge`, added Status column header + `StatusBadge` cell per row (between Salary and Date Found columns)
- `app/find-jobs/[id]/page.tsx` — added `status: string` to `Job` type, imported `StatusBadge` + `JobStatus`, rendered `StatusBadge` in job header card (between the text block and "View Job Post" link)
- `app/dashboard/page.tsx` — added pipeline fetch (`select("status").eq("user_id", ...)`) to `Promise.allSettled`, counts by status, renders `PipelineCard` paired with `RecentActivity` in first row. `CompanyResearchChart` moved to its own row at bottom.
- `context/progress-tracker.md` — Feature 20 marked complete, next is Feature 21

### Profile completion at 100%
- `components/profile/CompletionIndicator.tsx` — when `percentage === 100`: green ring (#10b981), green checkmark icon, heading "Profile complete", positive description, no missing field chips

### Tailored Resume (bonus feature, not in original build plan)
- `app/api/jobs/[id]/tailored-resume/route.ts` — POST handler. Loads job + full profile. GPT-4o generates tailored summary, reordered skills (most relevant first), and rewritten bullets. Returns PDF as download stream (no DB storage).
- `components/find-jobs/TailoredResumeButton.tsx` — "use client". Fetches PDF blob, triggers download. Shows tip if hasResearch=false. toast() on error.
- `app/find-jobs/[id]/page.tsx` — added "Tailored Resume" card using existing DocIcon, placed above Cover Letter section.
- `app/api/resume/ResumePDF.tsx` — added optional `skills?: string[]` to GeneratedContent. Skills section renders `generated.skills ?? profile.skills`. Regular resume unaffected.

## Decisions made

- Tailored resume streams PDF directly — no DB column or storage. Always generated fresh.
- Skills reordering via GPT-4o — same skills reordered, not filtered. Prompt: "do not add or remove any". Prevents hallucinated skills.
- ResumePDF skills override is optional — regular generate route continues without change.
- Dashboard layout: Row 1: RecentActivity + PipelineCard. Row 2: JobsOverTimeChart + MatchScoreChart. Row 3: CompanyResearchChart alone.
- StatusBadge cast: `(job.status as JobStatus) ?? "saved"` guards null/unexpected DB values.

## Prior session context (still relevant)

- Homepage stays sync — adding createInsforgeServer() to homepage caused blocking. Homepage always shows "Start for free".
- Dashboard rendering forever fix — (1) PostHog 8s AbortController in lib/posthog-query.ts. (2) Homepage auth check removed.
- Duplicate jobs — URL + title+company dedup before scoring in agent/find-jobs.ts.
- PostHog: "Job Pilot" (id: 197754), org: "Friismusic", host: eu.posthog.com.

## Current state

Features 01–20 all complete. Bonus: Tailored Resume done.
One remaining planned feature: Feature 21 — Scheduled Job Alert Emails (not started).

## Next session starts with

Feature 21 — Scheduled Job Alert Emails. Run /architect feature 21 first. Check context/build-plan.md for original spec — likely specifies email service (Resend? SendGrid?).

## Open questions

- Dashboard CompanyResearchChart at half-width on desktop (single child in 2-col grid) — may want col-span-2.
- Tailored Resume not in progress-tracker.md or ui-registry.md — add if audit trail wanted.
- Feature 13 company research ~60-120s — will timeout on Vercel free tier. Address at deployment.
- next/image OAuth avatar URLs — domains may need remotePatterns in next.config.ts.
- RapidAPI key pasted in prior session chat — consider rotating at rapidapi.com/developer/apps.
