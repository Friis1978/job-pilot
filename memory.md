# Memory — Resume PDF Overhaul (Session 2)

Last updated: 2026-07-09

## What was built

### Resume PDF (`app/api/resume/ResumePDF.tsx`)
- **User photo in header** — `avatarUrl` prop added; renders circular 56×56px image left of name/title/contact when included.
- **Professional title color** — `#2563EB` (BLUE constant). Name bottom margin increased to 9px.
- **Skill pills** — skills now render as individual pills with light blue bg (`#eff6ff`). Years badge is a rounded-full inner pill (`#dbeafe` bg, blue text, `lineHeight: 1`, equal padding) showing e.g. `3 y`. Both paths (skillGroups + fallback profile.skills) updated.
- **Blue URLs** — contact line URLs (linkedin/portfolio/website) render as `<Link>` in blue; email/phone/location stay muted gray. `contactParts` changed from `string[]` to `{ text, isUrl }[]`. Project links and recommender names also blue.
- **Motivation first** — Motivation section moved above Professional Summary.
- **Work Experience + Personal Projects** — both start with `<View break>` (new page).
- **Recommendations masonry** — two independent vertical column stacks (left=odd index, right=even index) with `marginRight: 10` on left column, `marginBottom: 10` between cards in each column. No flex gap (unreliable in react-pdf).
- **Project images full-width** — no fixed height, `width: "100%"`, `borderRadius: 4`. No objectFit (prevents cropping).
- **Page breaks** — Work Experience, Personal Projects, Recommendations all start on new pages.
- **Language** — resume generation (`tailored-resume/route.ts`) detects job post language via `detectLanguage` and appends language instruction to system prompt.
- **Markdown rendering** — `MdPdf` component added (with `parseInline`, `parseMdBlocks`, `renderInlinePdf` helpers). Motivation and Professional Summary now rendered via `MdPdf`. Bold uses `Helvetica-Bold`, italic uses `Helvetica-Oblique`, links render as `<Link>` in blue.

### ResumeSection component (`components/find-jobs/ResumeSection.tsx`)
- `avatarUrl?: string | null` prop added.
- `includePhoto` state + toggle button (same pattern as CoverLetterSection) — shows when `hasAvatar && resumeReady`.
- Download URL appends `?photo=0` when photo excluded.
- `PhotoIcon` inline SVG added.
- **Markdown preview** — `MarkdownPreview` component added (with `parseInline`, `parseBlocks`, `renderInline` helpers using React elements). Replaces the `<pre>` tag in preview mode. `combinedText = [motivation, resumeText].filter(Boolean).join("\n\n---\n\n")`.
- **Markdown hint footer** — below the Resume Content textarea: `Supports markdown: **bold** *italic* [text](url)` using `<code>` chips, matching CoverLetterSection style exactly.

### Tailored resume GET route (`app/api/jobs/[id]/tailored-resume/route.ts`)
- Reads `photo` query param; passes `avatarUrl` (or undefined) to `ResumePDF`.
- Imports `detectLanguage`; detects language from job text; appends language instruction to `SYSTEM_PROMPT`.

### Resume motivation route (`app/api/jobs/[id]/resume-motivation/route.ts`)
- Imports `detectLanguage`; detects language from job text; appends language instruction so motivation is written in the job's language.

### Job page (`app/find-jobs/[id]/page.tsx`)
- Passes `avatarUrl` from `profileData.avatar_url` to `ResumeSection`.

### Profile form (`components/profile/ProfileForm.tsx`)
- **Personal website field** — new URL input below "Portfolio / GitHub", bound to `websiteUrl`.
- **Project screenshots** — 3 click-to-upload thumbnail slots (80×64px) per project, hover remove button. Files upload to `/api/profile/project-image`. `updateProject` uses `any` value type.
- `PersonalProjectEntry.images: [string, string, string]`.

### New API routes
- `app/api/recommendations/avatar/route.ts` — recommender photo upload to `avatars` bucket.
- `app/api/profile/project-image/route.ts` — project screenshot upload (slot 0/1/2).

### Types (`types/index.ts`)
- `Profile.website_url: string | null`
- `ProfileFormInput.websiteUrl: string`
- `PersonalProject.images?: [string?, string?, string?]`
- `ProfileFormInput.personalProjects` — `images: [string, string, string]` required

### Actions (`actions/profile.ts`)
- Maps `websiteUrl → website_url`.

### Database
- `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website_url TEXT` — applied.

## Decisions made

- react-pdf `transparent` borders render black → use `#ffffff` for "hidden" sides (recommendation tail arrows).
- react-pdf `gap` on flex containers is unreliable → use explicit `marginRight`/`marginBottom`.
- Masonry layout in react-pdf: two independent `flex: 1` column Views, left gets items at odd index, right gets even index.
- `lineHeight: 1` needed in react-pdf pill text to center vertically (removes implicit font-metric offset).
- Markdown parsers are identical for browser and PDF — only the render layer differs (React elements vs `<Text>`/`<Link>`).
- PDF style arrays (`[style1, style2]`) cause TS errors in react-pdf → use object spread `{ ...base, ...overrides }`.

## Problems solved

- **Black tail arrows on recommendation bubbles**: `borderLeftColor: "transparent"` renders black in react-pdf → use `borderLeftColor: "#ffffff"`.
- **Unequal masonry gaps**: flex stretch equalizes heights → `alignItems: "flex-start"` on the grid row, then masonry columns.
- **Skill pill text not centered**: `lineHeight: 1` + equal `paddingTop`/`paddingBottom` fixes it.
- **TS error on `updateProject`**: `keyof PersonalProjectEntry` didn't include `images` tuple → changed to `any` value type.
- **PDF style array TS error**: react-pdf `Text` doesn't accept style arrays → use `{ ...base, ...overrides }` spread.

## Current state

Everything is working. The resume:
- Renders markdown in both browser preview and PDF
- Supports photo toggle, skill pills with year badges, masonry recommendations, full-width project images, spoken languages, personal interests, personal website URL
- Is generated in the same language as the job post (as is the motivation letter)

## Next session starts with

No immediate next task — the resume feature set is complete as of this session.

## Open questions

None currently.
