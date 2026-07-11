# Memory — Token Tracking, Dashboard Chart, Resume Improvements

Last updated: 2026-07-11

## What was built

**Token tracking system:**
- `lib/track-tokens.ts` — new file with `trackTokens()` and `TokenAccumulator` class. Fires `ai_tokens_used` PostHog event with `feature`, `model`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost_usd` properties.
- Wired into all 17 OpenAI call sites across 12 files: `agent/generate-cover-letter.ts`, `agent/linkedin-message.ts`, `agent/suggest-contact.ts`, `agent/find-jobs.ts`, `agent/import-job-from-url.ts`, `agent/research-company.ts`, `app/api/jobs/[id]/tailored-cover-letter/route.ts`, `app/api/jobs/[id]/cover-letter-advice/route.ts`, `app/api/jobs/[id]/resume-motivation/route.ts`, `app/api/jobs/[id]/regenerate-description/route.ts`, `app/api/jobs/regenerate-summaries/route.ts`, `app/api/jobs/[id]/tailored-resume/route.ts`, `app/api/resume/generate/route.ts`, `app/api/resume/extract/route.ts`.
- Files with multiple completions (find-jobs, import-job, research-company, regenerate-summaries) use `TokenAccumulator` to aggregate and flush once.

**PostHog dashboard (id: 810896) — "AI Token Usage & Cost":**
- Daily cost trend line chart
- Cost breakdown by feature (pie)
- Cost per user bar chart
- Token usage by feature stacked area chart

**App dashboard token chart:**
- `lib/posthog-query.ts` — added `getTokenUsageByFeature(userId)` using HogQL. Note: must use `toFloatOrZero` not `toFloat64OrZero` (latter doesn't exist in HogQL).
- `components/dashboard/TokenUsageChart.tsx` — new stacked area chart, color per feature, total in header, 14-day window.
- `app/dashboard/page.tsx` — wired in alongside other parallel queries.

**Resume (`app/api/resume/ResumePDF.tsx`) improvements:**
- Education, Languages, Interests moved to page 1 (before Work Experience page break).
- Section label `marginTop`: 7 → 17.
- `roleBlock` `marginBottom`: 4 → 10 (gap between job/project entries).
- Header `marginBottom`: name 4→7, title 2→6.
- `## h2` heading `marginTop`: non-first 5→14, first 0→8.
- URL links in header now show labels "LinkedIn", "GitHub", "Website" instead of raw URLs.

**Resume generate route (`app/api/resume/generate/route.ts`):**
- Now fetches `linkedin_recommendations` and passes to `ResumePDF` (was missing before).
- Accepts `?images=1` query param and passes `includeImages` to `ResumePDF`.
- ProfileForm always calls `/api/resume/generate?images=1` — no toggle, always includes images.

**Cover letter fix (`agent/generate-cover-letter.ts`):**
- Fixed 3rd-person writing bug: each JSON field now says "write in first person (I/my)" and "do NOT open the sentence with the word 'I'" — previous wording "Do NOT open with 'I'" was misread as "don't use first person at all".

## Decisions made

- Token tracking is fire-and-forget PostHog, not stored in DB.
- GPT-4o pricing: $0.005/1K input, $0.015/1K output. GPT-4o-mini: $0.00015/$0.0006.
- Profile resume always includes images; job page resume has a toggle.
- `portfolio_url` labelled "GitHub" in resume header — verify this is correct for all users.

## Problems solved

- `toFloat64OrZero` does not exist in HogQL — use `toFloatOrZero`.
- Cover letter 3rd-person bug: "Do NOT open with 'I'" was misread by GPT-4o as "avoid first person entirely".

## Current state

- Token tracking live and capturing events in PostHog.
- App dashboard token chart working.
- All resume changes code-complete, not visually verified yet.
- Cover letter fix in place.

## Next session starts with

Visually verify the resume PDF — check education/languages/interests on page 1, spacing, "LinkedIn/GitHub/Website" labels in header, recommendations appearing.

## Open questions

- Is `portfolio_url` always GitHub? The label "GitHub" was assumed — might need to be "Portfolio".
- `find_jobs` costs ~$0.52 per run (78k tokens) — worth investigating prompt trimming.
- Previous open questions still apply: resume generation cliché risk, `agent/edit-cover-letter.ts` unused.
