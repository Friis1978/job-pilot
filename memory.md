# Memory — Status UI, Pipeline Dashboard, No Answer Feature

Last updated: 2026-07-10

## What was built

**Status badge & table (find-jobs):**
- `components/find-jobs/StatusBadge.tsx` — added `whitespace-nowrap` to pill, updated all colors to match dashboard (offer=green, interviewing=light green, applied=yellow, rejected=red, no_fit=dark gray)
- `components/find-jobs/JobsTable.tsx` — status column widened to `w-44`; STATUS_FILTERS reordered to match dashboard (offer→interviewing→applied→rejected→rej_after_interview→saved→no_answer→no_fit); STATUS_ORDER updated to same priority; added `no_answer` filter with 14-day logic; added sortable "Applied" column (`updated_at`); Location and Applied columns hidden at `lg` breakpoint and below (hidden on iPad); "No answer" filter button count uses derived logic (not real status)
- `types/index.ts` — added `updated_at: string | null` to `JobRow`
- `app/find-jobs/page.tsx` — added `updated_at` to select query

**Dashboard pipeline (`components/dashboard/PipelineCard.tsx`):**
- Pipeline order: offer → interviewing → applied → rejected → rej_after_interview → saved → no_answer → no_fit
- Colors: offer=green, interviewing=light green (bg-success/50), applied=yellow, rejected=red, rej_after_interview=red/70, saved=bg-text-secondary, no_answer=bg-text-muted/50, no_fit=bg-text-muted
- Added `no_answer` to PipelineData type and PIPELINE_STEPS
- Header shows "No answer: X%" in red alongside interview rate
- `app/dashboard/page.tsx` — pipeline query selects `status, updated_at`; counts `no_answer` as applied jobs with `updated_at < 14 days ago`

**Database:**
- Added `updated_at timestamptz NOT NULL DEFAULT now()` to `public.jobs`
- Created trigger `jobs_set_updated_at` (BEFORE UPDATE) to auto-set `updated_at = now()`
- Manually set `updated_at` for all 13 applied jobs to Monday of week applied (weeks 24–28, 2026)

## Decisions made

- `no_answer` is a **derived status**, not a real DB status — means `status = 'applied' AND updated_at < now() - 14 days`
- `updated_at` is the canonical "when was this job last acted on" field; `found_at` is when the job was discovered
- Pipeline total excludes `no_answer` count to avoid double-counting with `applied`
- Applied column (`updated_at`) shows `—` for saved jobs since they haven't been applied to

## Problems solved

- Querying `updated_at` before adding it to DB caused pipeline to show empty (query error → null data → total=0 → "No applications yet")
- Trigger on `updated_at` overwrote manual date sets — had to `DISABLE TRIGGER` before bulk update, then re-enable
- `no_answer` filter button was hidden because count logic used `job.status === key` — fixed with dedicated derived count

## Current state

- All 13 applied jobs have correct `updated_at` dates
- Pipeline card shows all statuses in correct order with correct colors
- Find-jobs table has No Answer filter tab, sortable Applied column, correct status badge colors
- "Forsvaret" mentioned by user as week 27 but not found in applied list

## Next session starts with

Check if Forsvaret job exists in DB (`SELECT id, title, company, status FROM jobs WHERE company ILIKE '%forsvar%'`) and handle accordingly.

## Open questions

- Where is the Forsvaret job? User said week 27 applied but it wasn't in the applied list
- Should `no_answer` jobs show a visual indicator in the status badge in the table?
