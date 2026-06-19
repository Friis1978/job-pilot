# Memory — Profile Form: Tooltips, Education Accordions, Cover Letter Tone

Last updated: 2026-06-19

## What was built

### Cover Letter Tone
- Added "Confident" as a fourth tone option
- Moved the dropdown from Job Preferences into the Cover Letter Instructions section
- Dropdown sized to content width (`inline-block`, `w-auto pr-8`)
- Tone now injected in both generation paths (custom instructions AND default) in `agent/generate-cover-letter.ts`

### Multi-Education Accordion
- Replaced four flat education fields (`highestDegree`, `fieldOfStudy`, `institution`, `graduationYear`) with `educations: EducationEntry[]` array
- `types/index.ts`: `Profile.education` changed to `Education[] | null`; `ProfileFormInput` uses `educations: Education[]`
- `actions/profile.ts`: saves array, filters to entries with a degree
- `app/api/resume/ResumePDF.tsx`: iterates array, renders all entries
- `app/api/resume/extract/route.ts`: AI extracts `educations` as array
- Backward compat: `profileToFormData` detects legacy single-object DB value and wraps in array automatically

### Tooltip System (InfoIcon)
- `components/ui/Tooltip.tsx`: fixed `whitespace-nowrap` conflict, added `w-max min-w-[8rem] max-w-xs`, `normal-case tracking-normal`, left-aligned text, doubled arrow height (`border-x-4 border-t-8 border-b-0`)
- `components/profile/ProfileForm.tsx`:
  - Added `InfoIcon` component — renders SVG (i) icon + inline tooltip span + arrow as siblings (NOT using `Tooltip.tsx`), positioned relative to the parent label
  - `labelClass` updated to include `relative group/tooltip block w-fit` — label is the hover trigger and positioning context, shrinks to content width so arrow centers over label text
  - Arrow is a SIBLING of the tooltip bubble inside the label (not inside the bubble), positioned `bottom-full left-1/2 -translate-x-1/2` — always centered over the label text
  - All 38 form labels have `InfoIcon` with meaningful instructional tooltip text (not examples)
  - Cover Letter Instructions label converted from `Tooltip` component to `InfoIcon`
  - All textareas changed from `resize-none` to `resize-y`

## Decisions made

- **InfoIcon does NOT use Tooltip.tsx** — it renders its own inline tooltip span directly, positioned relative to the parent label. `Tooltip.tsx` is still used in JobsTable/dashboard charts and must not be changed to match InfoIcon behavior.
- **Label is positioning context** — `labelClass` has `relative group/tooltip w-fit` so the label shrinks to text width and the tooltip + arrow position relative to it, not the full container.
- **Arrow is external to tooltip bubble** — arrow is a sibling span inside the label, not inside the tooltip bubble. This is what allows `left-1/2 -translate-x-1/2` to center it over the label text rather than the tooltip box.
- **Tooltip left-aligns from label edge** — `left-0` on tooltip bubble, extends rightward, never overflows left edge.
- **`mb-2` on tooltip + `border-t-8` arrow** — the 8px gap (mb-2) exactly matches the 8px arrow height, connecting them seamlessly.

## Problems solved

- **Tooltip overflow** — `whitespace-nowrap` was overriding `whitespace-normal` in Tailwind output (alphabetical sort). Removed `whitespace-nowrap`.
- **Arrow disconnected from box** — arrow at `left-[2.5px]` fell within `rounded-md` corner radius (6px). Fixed by making arrow external to tooltip bubble and using `top-[calc(100%-1px)]` to overlap 1px.
- **Arrow centered on full-width label** — `w-fit` on labelClass makes label shrink to text content width, so `left-1/2` centers the arrow over the label text, not the full container.

## Current state

- Profile form fully working with tooltip system on all labels
- Multi-education accordion working with backward-compatible DB migration
- Cover letter tone: 4 options, in Cover Letter Instructions section, always applied
- All textareas are vertically resizable
- Tooltip system: left-aligned bubble, arrow centered in label text, no left-edge overflow

## Next session starts with

No immediate queued tasks. Consider checking if any other pages/forms in the app need the same tooltip treatment.

## Open questions

- Should tooltips be added to other forms in the app (job import, etc.)?
- Newcode.ai (`d057a319-507d-4598-9a25-3f403dfb17d0`) still has only a US address
- Should the resume PDF show all education entries or just the most recent? Currently shows all
