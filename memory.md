# Memory — Resume, Cover Letter, and Match Breakdown Session

Last updated: 2026-06-22

## What was built

### Tailored Resume fixes
- **`app/api/jobs/[id]/tailored-resume/route.ts`** — Moved DB save (`tailored_resume_content`) to AFTER post-processing so the Required skills group is included in the stored content (used by cover letter merge). Added orphan safety net: profile skills not in any AI group are appended to an "Other" group.
- **`app/api/resume/ResumePDF.tsx`** — Required group preserves custom order (frontend frameworks first); all other groups sort by years desc.

### Match Breakdown — real scores
- **DB migration** — Added `experience_score integer` and `seniority_score integer` columns to `jobs` table (via InsForge MCP).
- **`types/index.ts`** — Added `experienceScore` and `seniorityScore` to `ScoredJob` type.
- **`agent/find-jobs.ts`** — AI prompt now returns `experienceScore` (years/history fit) and `seniorityScore` (junior/mid/senior level fit) as separate 0–100 integers. Both saved to DB on insert.
- **`app/find-jobs/[id]/page.tsx`** — Added `experience_score` and `seniority_score` to `Job` type. ProgressBars now use real scores, falling back to `match_score` for pre-existing jobs. Matched skills layout changed from 2-column grid to stacked (full width) so badges fill the column.

### Cover letter project links
- **`agent/generate-cover-letter.ts`** — Updated rule to require ALL available project links (Live, GitHub, Video) inline when referencing personal projects.

## Decisions made

- **DB save after post-processing**: `tailored_resume_content` must always be saved after the Required group logic runs so the cover letter merge (which reads from DB) also has the Required section.
- **Orphan skills safety net**: AI sometimes drops skills it doesn't recognise well (Supabase, InsForge). Any profile skill missing from AI-generated groups gets added to an "Other" group. This is a post-processing step in the route, not a prompt instruction.
- **Matched skills full-width layout**: Removed the `sm:grid-cols-2` side-by-side layout for matched/missing skills — matched skills now always take full card width, missing skills stack below.
- **Experience/Seniority scores**: Existing jobs predate the new columns and will show `match_score` as fallback for both bars. Only new jobs found after this session will have real separate scores.

## Problems solved

- **Required skills missing from resume PDF**: DB save was happening before the Required group was prepended. Fixed by moving save after all post-processing.
- **Supabase/InsForge disappearing from resume**: AI was silently dropping unrecognised BaaS platform names from skill groups. Fixed with orphan detection — any skill not in any group gets added to "Other".
- **Experience/Seniority bars hardcoded**: Both bars were `job.match_score` — now real separate scores from the AI scorer.
- **Matched skills squished to half width**: Was in a `grid-cols-2` with missing skills — changed to stacked layout.

## Current state

- Tailored resume: Required group works, orphan skills recovered, DB save correct. All post-processing complete before save.
- Match breakdown: Real experience/seniority scores for new jobs; existing jobs fall back to match_score.
- Cover letter: Includes all project links (live, GitHub, video) when referencing personal projects.
- Skills badges: Full width, natural wrap, no grow/stretch.

## Next session starts with

No specific pending task — session ended cleanly. Next work item is whatever the user brings.

## Open questions

- The job `f90a590e-2e08-4cda-b063-ece6baa6a124` (Laerdal) has stale `tailored_resume_content` in DB without Required group. User needs to regenerate the resume for that job to get the fixed version.
- Existing jobs have null `experience_score` / `seniority_score` — they show `match_score` as fallback. Could add a re-score feature to backfill these.
- Emails not working in production — env vars need adding to InsForge deployment, `bandfolio.ai` needs Resend verification.
- Should rejected users see different message on `/pending`?
- Should Admin nav link show badge count for pending users?
