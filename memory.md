# Memory — Resume PDF Rendering + UI Polish

Last updated: 2026-06-16

## What was built

**`app/api/resume/ResumePDF.tsx`** — fixed overlapping skills text (two separate bugs):
1. Added `skillsRowText` style (no `flex: 1`) for use in chunked row Text nodes — `flex: 1` on multiple Text siblings in a column View causes them all to render at the same Y position in react-pdf
2. Applied `skillsRowText` to both the `skillGroups` chunked rows AND the flat skills chunked rows
3. `skillGroups` path: inner `<View style={{ flex: 1 }}>` wraps chunked rows — this is correct; the fix was removing `flex: 1` from the Text children inside it

**`components/find-jobs/TailoredResumeButton.tsx`** — two changes this session:
- Layout: button now sits to the RIGHT of the description text (parent page uses `flex items-start gap-4`)
- Style: changed from big `bg-accent px-4 py-2 text-sm` → small `bg-accent text-accent-foreground px-3 py-1.5 text-xs` (matching cover letter header buttons in size and Apply button in color)

**`components/find-jobs/CoverLetterSection.tsx`** — Regenerate button changed from grey (`bg-surface-secondary border border-border text-text-secondary`) to accent (`bg-accent text-accent-foreground hover:bg-accent-dark`)

**`app/find-jobs/[id]/page.tsx`** — Tailored Resume section: wrapped `<p>` and `<TailoredResumeButton>` in `flex items-start gap-4` so button sits to the right of the text

**DB** — nulled `resume_generated_at` for user (friis1978@gmail.com) to bust the cached broken PDF and force regeneration with fixed code

## Decisions made

- **`skillsRowText` style (no flex)**: react-pdf crashes when multiple `Text` nodes with `flex: 1` share a column container — they all stack at Y=0. `skillsText` (with `flex: 1`) is kept only for the single-text horizontal layout case; chunked rows use `skillsRowText`.
- **Accent color for primary action buttons**: TailoredResumeButton, Regenerate, and Generate Cover Letter all use `bg-accent` — consistent with Apply Now button.
- **TailoredResumeButton is small (px-3 py-1.5 text-xs)**: matches the cover letter header button sizing, not the old full-width large button.

## Problems solved

- **Skills overlapping in PDF**: All caused by `flex: 1` on `Text` nodes in column containers in react-pdf. Fixed by using `skillsRowText` (no flex) for chunked rows.
- **Cached broken PDF served after code fix**: Nulled `resume_generated_at` in DB so next download triggers regeneration.
- **Normal resume (skillGroups path) and tailored resume (flat skills path) both had the same bug**: Fixed both in same edit.

## Current state

- All TypeScript compiles clean
- Resume PDF renders correctly (both normal and tailored)
- TailoredResumeButton: small, accent-colored, right-aligned next to text
- CoverLetterSection: Regenerate button is now accent-colored
- User should re-upload cover letter instructions via Profile → "Load .md file" from `/Users/rfh/Desktop/CLAUDE-Cover-Letter-Instructions.md` (DB may have reconstructed version, not exact file)
- Contact extraction (Torben Åstradsson + Mashiah Moltrup-Ryom on F&P / Emply job) not yet verified
- Diagnostic `console.log` still in `agent/research-company.ts` — remove once contacts confirmed
- Air Apps Lisbon job still shows 90% — user needs to trigger "Rescore All"

## Next session starts with

1. User re-uploads cover letter instructions via Profile "Load .md file" button
2. Verify F&P / Emply job contact extraction (Torben Åstradsson + Mashiah Moltrup-Ryom)
3. If confirmed, remove diagnostic `console.log` from `agent/research-company.ts`
4. Trigger "Rescore All" and verify Air Apps Lisbon drops to ≤35

## Open questions

- Does HTTP fetch of the Emply source_url return full SSR HTML with contacts?
- Is the cover letter instructions content in DB exact or reconstructed?
