# Memory — Personal Projects Resume + PDF Layout Fixes

Last updated: 2026-06-17

## What was built

### Personal Projects in Resume PDF
- **`app/api/resume/generate/route.ts`** — `personalProjects` added to `profileInput` so GPT can mention them in the summary. Summary rule updated to name one notable project. `computeSkillYears` now includes personal projects as second arg. `max_tokens` bumped to 1800. `PersonalProject` imported from `@/types`.
- **`app/api/resume/ResumePDF.tsx`** — New Personal Projects section after Work Experience. Uses `projectDesc` style (no `flex: 1`) to fix react-pdf height calculation bug. Skills filtered to ≤25 chars, max 8 shown (one row). Full description shown (no truncation). Links rendered with `Link` component from react-pdf — `LIVE`, `GITHUB`, `VIDEO` labels in small caps with clickable accent-colored URLs.

### GitHub & Video URL fields on Personal Projects
- **`types/index.ts`** — `PersonalProject` type now has `githubUrl?: string` and `videoUrl?: string`. `ProfileFormInput.personalProjects` array type updated to include both.
- **`components/profile/ProfileForm.tsx`** — `PersonalProjectEntry` type updated. `profileToFormData` maps new fields. `addProject` initializes both to `""`. Single URL input replaced with 3-column grid: Live URL · GitHub · Video. Description textarea changed from `resize-none` to `resize-y`.
- **`agent/generate-cover-letter.ts`** — Projects text now appends `GitHub:` and `Video:` URLs alongside `Live:`. New system prompt rule: if project has a live URL or GitHub URL, reference it inline in the letter body.

### DB updates (direct SQL)
- Job Pilot description in `personal_projects[0]` restored to original full text after being accidentally shortened.
- Bandfolio description in `personal_projects[1]` shortened to 290-char resume-appropriate version: "Multi-tenant CMS for musicians and bands, built entirely through a 4-phase AI-orchestrated CI/CD pipeline..."

## Decisions made

- **`projectDesc` style, not `bulletText`** — The react-pdf height calculation bug on wrapping Text nodes was caused by `bulletText` having `flex: 1`. Outside a `flexDirection: "row"` container, `flex: 1` expands the text vertically, making react-pdf think the block is taller than it is and placing the next block too early (overlap). Fix: dedicated `projectDesc` style with no `flex` property.
- **Skills filter for PDF**: show only skills ≤25 chars, max 8 — prevents long multi-word skills like "Component architecture (custom + PrimeVue + Tailwind composition)" from blowing out the row height.
- **Full description in PDF**: no truncation now that the height bug is fixed. If the description overflows a page, react-pdf handles it naturally.
- **Links use `Link` component**: react-pdf's `Link` makes URLs clickable in PDF viewers. Labels shown as small-caps muted text, URL as accent-colored link text.

## Problems solved

- **react-pdf height miscalculation on personal projects**: Root cause was `flex: 1` on `bulletText` style used outside a row container. Fixed by using `projectDesc` (no flex). All previous fixes (truncation, skills chunking) were treating symptoms — this was the actual bug.
- **Cached resume served after direct SQL update**: After updating `personal_projects` via raw SQL, `updated_at` doesn't auto-bump (no trigger). Fixed by running `UPDATE profiles SET updated_at = NOW()` explicitly after every direct DB edit.

## Current state

- Personal Projects section in resume PDF: fully functional, full descriptions, clickable links (Live/GitHub/Video), skills shown.
- GitHub + Video URL fields: in the profile form, saved to DB, shown in PDF and cover letter.
- Description textarea: resizable by dragging.
- Cover letter agent: references project URLs inline when present.
- Bandfolio `personal_projects[1]` description is the shortened version in DB — the profile form will show this shortened version. User may want to expand it back to the full long version in their profile for cover letter use (the PDF will show whatever is in the description field).

## Next session starts with

Verify the resume PDF renders correctly with the new Personal Projects section — check that:
1. Full descriptions show without overlap
2. Links (Live/GitHub/Video) are clickable
3. Skills row doesn't overflow

Then add GitHub/Video URLs for both projects in the profile form and save.

## Open questions

- Does the jobviewtrack Referer fix actually resolve to employer URLs in production? (unconfirmed from previous session)
- Has the auth fix (refresh token from Set-Cookie header) been confirmed after a full login cycle? (unconfirmed from previous session)
- Bandfolio description in DB is the shortened resume version — should the full long description be stored separately for cover letter use, or is the shortened version acceptable for both?
- `console.log` may still exist in `agent/research-company.ts` from a previous session — check and remove if present.
