# Memory — Cover Letter Advice + User-Written Letters

Last updated: 2026-06-25

## What was built

### Spoken Languages (from earlier in session)
- **DB** — `spoken_languages jsonb` column on `profiles`
- **`types/index.ts`** — `SpokenLanguage` type, added to `Profile` and `ProfileFormInput`
- **`actions/profile.ts`** — maps `spokenLanguages` → `spoken_languages`
- **`components/profile/ProfileForm.tsx`** — full UI: language select from fixed list, level select (Native/Fluent/Advanced/Intermediate/Basic), removable pills, inside Professional Info accordion after Industries
- **`agent/find-jobs.ts`** — `scoreJob` updated: language matching rules in system prompt (Native = Fluent), spoken languages in candidate context block
- **`app/api/jobs/[id]/rescore/route.ts`** — added `spoken_languages, personal_projects` to profile select (was missing, causing null on rescore)
- **`app/api/jobs/rescore-all/route.ts`** — same fix

### Cover Letter — Advice + User-Written Flow
- **DB** — `cover_letter_advice text` column added to `jobs` table
- **`app/api/jobs/[id]/cover-letter-advice/route.ts`** (new) — POST: GPT-4o produces 4-section writing brief (opening angle, key points, gap handling, tone & company angle), saved to `cover_letter_advice`. Detects job language, writes brief in that language.
- **`app/find-jobs/[id]/page.tsx`** — added `cover_letter_advice` to `Job` type, passes `initialAdvice={job.cover_letter_advice}` to `CoverLetterSection`
- **`components/find-jobs/CoverLetterSection.tsx`** (full rewrite):
  - Top section: Writing Advice panel — accent-tinted, shows stored advice as rendered markdown, "Get Advice" / "Regenerate" button
  - Bottom section: Your Cover Letter — always-visible textarea, Write/Preview toggle (Preview renders markdown in browser with bold/italic/links), Save button (disabled until dirty, green on save), Download PDF button (disabled when empty), Copy/Photo/Resume toggles
  - PDF download unchanged — `CoverLetterPDF` already had full markdown parser

## Decisions made

- **AI advice stored in DB** (`cover_letter_advice` column on `jobs`) — persists across sessions, same pattern as `description_summary`
- **Old "Generate Cover Letter" removed from UI** — `agent/generate-cover-letter.ts` and `/api/agent/cover-letter` route kept in codebase but no longer surfaced. Users write their own letters.
- **Textarea always visible** — not gated behind any generation step. Empty textarea ready to type from the start.
- **Same PDF rendering pipeline** — `CoverLetterPDF` markdown parser unchanged. User's markdown text renders correctly in downloaded PDF (bold, italic, links all work).
- **Native = Fluent for language matching** — explicitly stated in `scoreJob` system prompt so rescores respect it.
- **Rescore routes must fetch full profile** — both `/rescore` and `/rescore-all` now select `spoken_languages` and `personal_projects` so all context is available.

## Problems solved

- **Rescore routes used partial profile select** — `spoken_languages` was never fetched during rescore so model always saw "Not specified". Fixed by adding it to both rescore route selects.
- **Pre-existing jobs had Danish as missing skill** — fixed two jobs manually in DB (`d77a199f`, `29fdf777`). Future rescores now work correctly.
- **Job `29fdf777` kept reverting** — rescore route was overwriting our manual DB fix because it fetched incomplete profile. Root cause was the partial select, now fixed.

## Current state

Everything working:
- Spoken languages: profile UI, DB storage, job matching, rescore routes
- Cover letter: advice generation + storage, user-written textarea, markdown preview, save + download
- PDF download: markdown renders correctly (bold, italic, links)

## Next session starts with

No pending tasks. Ready for whatever the user brings.

## Open questions

- Other pre-existing jobs may have incorrect language flags — user can rescore them individually or via "Rescore All"
- Emails not working in production (env vars + Resend `bandfolio.ai` verification needed)
- Should rejected users see a different message on `/pending`?
- Should Admin nav link show badge count for pending users?
