# Memory — Cover Letter Intelligence Upgrade

Last updated: 2026-06-17

## What was built

### Cover letter generation overhaul (`agent/generate-cover-letter.ts`)

**Profile fields added:**
- `linkedin_url` and `portfolio_url` now fetched from DB and passed to the user message

**User message restructured:**
- "What Drives This Candidate" is now its own labelled block (was buried at end of a long string)
- `match_reason` added as "Why this job fits the candidate" — was fetched but never passed to GPT
- LinkedIn and Portfolio URLs appended after the drives block

**`coreRules` rewritten into three sections (COMPANY & JOB FIT / WHAT DRIVES THE CANDIDATE / EXPERIENCE & SKILLS):**
- Motivation: find where it overlaps with company values — make the connection explicit, not implied
- Energy tasks: cross-reference with what the role requires day-to-day — show candidate will enjoy the work
- Career vision: connect to where the company is going — shows deliberate choice, not spray-and-pray
- Key achievement: used as concrete evidence for the letter's strongest claim
- Company research: show genuine understanding of their world, not name-dropping
- Match reason: the spine of the letter narrative

**System prompt architecture:**
- Both paths (custom instructions + default) now share `coreRules`
- Custom instructions = style guide (HOW to write)
- Profile data = substance (WHAT to write about)
- Both always apply — instructions no longer override profile context

### Personal Projects in Resume PDF (`app/api/resume/ResumePDF.tsx`)
- `Link` component imported from react-pdf
- LIVE / GITHUB / VIDEO labels in small-caps with clickable accent-colored URLs
- `projectDesc` style (no `flex: 1`) — fixes react-pdf height miscalculation bug
- Full description shown (no truncation)
- Skills filtered ≤25 chars, max 8 per row

### GitHub & Video URL fields (`types/index.ts`, `ProfileForm.tsx`, `generate-cover-letter.ts`)
- `PersonalProject` type: `githubUrl?: string`, `videoUrl?: string`
- Profile form: 3-column URL grid (Live · GitHub · Video), description textarea is resizable
- Cover letter: GitHub and Video URLs passed as project context

### Resume generate route (`app/api/resume/generate/route.ts`)
- `personalProjects` added to `profileInput`
- Summary rule: mention one notable project by name
- `computeSkillYears` includes personal projects
- `max_tokens` bumped to 1800

## Decisions made

- **`coreRules` as shared block**: both the custom-instructions path and the default path include the same content rules — avoids duplication and ensures profile context is always used regardless of which path fires
- **"What Drives This Candidate" as labelled section**: buried at end of string = easier for GPT to overlook; explicit heading = treated as structured data
- **`match_reason` in user message**: was already fetched from DB but never passed — now the model sees exactly why the scoring engine flagged this job as a match
- **`projectDesc` style**: `bulletText` with `flex: 1` outside a row container causes react-pdf to miscalculate block height and overlap content. `projectDesc` has no flex — fixed the root cause

## Problems solved

- **Cover letter instructions overriding profile context**: old prompt said "overrides all default rules" — personal projects, motivation, energy, career vision were being ignored. Fixed by making instructions = style guide, coreRules = always-on content rules
- **Motivation/energy not cross-referenced with company**: data was passed but instruction was passive ("let them shape the letter"). Rewritten to explicitly tell the model to find the overlap between candidate drives and company culture/role requirements
- **react-pdf height overlap in Personal Projects**: root cause was `flex: 1` on `bulletText` used outside a `flexDirection: row` container

## Current state

- Cover letter generation: fully rebuilt — uses all profile fields, cross-references motivation/energy/vision with company research and job requirements, references project URLs inline
- Personal Projects in PDF: renders correctly with clickable links, full descriptions
- GitHub + Video URL fields: in form, saved to DB, used in PDF and cover letter
- `match_reason` now flows into cover letter generation
- `linkedin_url` and `portfolio_url` now flow into cover letter generation

## Next session starts with

Test a cover letter generation end-to-end:
1. Pick a job that has company research
2. Generate cover letter — verify motivation/energy/career vision are reflected and cross-referenced with company culture
3. Verify project URL appears inline in the letter body

## Open questions

- Does the jobviewtrack Referer fix resolve to employer URLs in production? (unconfirmed)
- Has the auth fix (refresh token from Set-Cookie) been confirmed after a full login cycle? (unconfirmed)
- `console.log` may still exist in `agent/research-company.ts` — check and remove
