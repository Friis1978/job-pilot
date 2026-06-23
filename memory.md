# Memory — Find Jobs UI — Mobile, Filters, and Pipeline State

Last updated: 2026-06-23

## What was built

### "No fit" pipeline state
- **DB** — Dropped and recreated `jobs_status_check` constraint via InsForge MCP to include `'no_fit'`.
- **`app/api/jobs/[id]/status/route.ts`** — Added `no_fit` to `VALID_STATUSES` allowlist.
- **`components/find-jobs/StatusBadge.tsx`** — Added `no_fit` to `JobStatus` type and `STATUS_CONFIG` (label: "No fit", pill: `bg-warning/10 text-warning border border-warning/30`). Full rewrite to use `createPortal` to escape `overflow-hidden` table container. Dropdown positions via `getBoundingClientRect()` with flip-up detection near viewport bottom. Click-outside handler checks both `buttonRef` and `dropdownRef`.
- **`components/dashboard/PipelineCard.tsx`** — Added `no_fit` step (`text-warning`, `bg-warning`).
- **`app/dashboard/page.tsx`** — Added `no_fit: 0` to pipeline counts initializer.

### Per-job description regeneration
- **`app/api/jobs/[id]/regenerate-description/route.ts`** — New POST route: reads `about_role`, summarizes via GPT-4o-mini (8–10 bullets), saves to `description_summary`.
- **`components/find-jobs/RegenerateDescriptionButton.tsx`** — Client component. `hasSummary=true`: small "Re-run" border button. `hasSummary=false`: primary "Generate summary" button. Reloads page on success.
- **`app/find-jobs/[id]/page.tsx`** — Job description card redesigned: header has DocIcon + title + RegenerateDescriptionButton. Body in `bg-surface-tertiary p-5`. "Full posting" link bottom-left styled like TailoredResumeButton (border, rounded-xl, underline, bold).

### Find-jobs table — mobile responsive
- **`components/find-jobs/JobsTable.tsx`** — Table changes:
  - `table-fixed` on `<table>` to prevent mobile overflow
  - Removed "Researched" column entirely
  - Column visibility: company/role always visible; location/status/date hidden on mobile (`hidden md:table-cell`)
  - Company icon: `hidden md:flex`
  - Match bar: `hidden md:block`, width `w-16` (was `w-32`)
  - Match column: `w-[14%]` (was `w-16` fixed — was overflowing into status column)
  - Match `<td>`: `overflow-hidden` to prevent bar bleed
  - Column header: "Match Score" → "Match"
  - Removed bulk action buttons (Re-score all, Research all, Clear all), removed `BulkOpsProvider`

### No fit toggle
- Hide `no_fit` jobs by default (`showNoFit` state, default `false`)
- "Show No fit" / "Hide No fit" toggle button with warning-orange styling, only shown when `no_fit` jobs exist

### Combined filter dropdown
- **`components/find-jobs/JobsTable.tsx`** — Filter button opens a portal dropdown with two sections: Match (All/High/Low pills) + Skills (scrollable chips). Badge shows active filter count. Replaced separate match-cycle button and standalone skills chip row.
- Search input filters by company, role, AND `matched_skills` (any skill containing the query string). Placeholder: "Filter by company, role or skill..."

### SearchCard mobile layout
- **`components/find-jobs/SearchCard.tsx`** — Recent searches: 1 on mobile, 3 on `md`, 5 on `lg` (index-based visibility). Form layout: Job Title full row, Location + Min Match in same row (`md:contents` trick), Find Jobs button `w-full md:w-auto`.

## Decisions made

- **Portal pattern for dropdowns**: Both `StatusBadge` dropdown and filter dropdown use `createPortal` into `document.body` with `getBoundingClientRect()` positioning. This is required because the table has `overflow-hidden` which clips absolutely-positioned children.
- **Click-outside with dual refs**: Whenever a portal dropdown has a trigger button, the click-outside handler must check BOTH the button ref AND the dropdown ref, otherwise dropdown item clicks close before they fire.
- **`table-fixed` + `overflow-hidden` on match cell**: Without `table-fixed`, the table overflows the viewport on mobile. Without `overflow-hidden` on the match `<td>`, the bar bleeds into the status column.
- **`md:contents` for grouped mobile / flat desktop layout**: Wrapping Location + Min Match in a div with `md:contents` dissolves the wrapper in flex context at `md+`, making them behave as direct flex children (flat desktop row) while staying grouped on mobile.
- **No fit hidden by default**: No fit jobs are filtered out unless `showNoFit=true` or `statusFilter === "no_fit"`. This keeps the list clean for daily use.

## Problems solved

- **StatusBadge dropdown clipped by `overflow-hidden`**: Fixed with `createPortal` to `document.body`.
- **Dropdown items not selectable after portal**: Click-outside handler was only checking `buttonRef`, so dropdown clicks (now outside button) triggered close before `handleSelect`. Fixed by adding `dropdownRef` to the check.
- **Status update returning 400 for `no_fit`**: `VALID_STATUSES` in the API route didn't include it. Added.
- **DB rejecting `no_fit`**: CHECK constraint only allowed old values. Dropped and recreated.
- **Table overflow on mobile**: `table-fixed` fixed it.
- **Match bar bleeding into status column**: Bar was `w-32` inside a `w-16` column. Fixed: column → `w-[14%]`, bar → `w-16`, added `overflow-hidden` on `<td>`.

## Current state

Everything is working:
- No fit state: DB, API, StatusBadge, PipelineCard all updated
- Description regeneration: API + button component working
- Job description card: redesigned with Re-run in header, Full posting link bottom-left
- Find jobs table: mobile responsive, no overflow, columns correct
- Filter dropdown: combined match + skills, portal-based, no standalone skill chips
- Search: filters by company/role/skill

## Next session starts with

No pending tasks. Next work item is whatever the user brings.

## Open questions

- Existing jobs have null `experience_score` / `seniority_score` — show `match_score` as fallback. Could add re-score to backfill.
- Emails not working in production — env vars need adding to InsForge deployment, `bandfolio.ai` needs Resend verification.
- Should rejected users see different message on `/pending`?
- Should Admin nav link show badge count for pending users?
- The job `f90a590e-2e08-4cda-b063-ece6baa6a124` (Laerdal) has stale `tailored_resume_content` without Required group — needs re-generate.
