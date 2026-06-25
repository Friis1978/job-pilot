# Memory — Spoken Languages Feature + Job Matching Fix

Last updated: 2026-06-25

## What was built

### Spoken Languages on Profile
- **DB** — added `spoken_languages jsonb` column to `profiles` table via InsForge MCP
- **`types/index.ts`** — added `SpokenLanguage = { language: string; level: string }` type; added `spoken_languages` to `Profile` and `spokenLanguages` to `ProfileFormInput`
- **`actions/profile.ts`** — maps `input.spokenLanguages` → `spoken_languages` on save
- **`components/profile/ProfileForm.tsx`** — full implementation: `LANGUAGE_LIST` constant (comprehensive world language list), `LANGUAGE_LEVELS` constant (Native/Fluent/Advanced/Intermediate/Basic), `spokenLanguages`/`langInput`/`langLevelInput` added to `FormData`; add/remove handlers; UI rendered after Industries inside Professional Info accordion — language select (filters out already-added) + level select + Add button + removable pills showing "Language · Level"

### Language-Aware Job Matching
- **`agent/find-jobs.ts`** — `scoreJob` updated in two places:
  1. System prompt: added spoken language matching rules (required language in job = matched/missing skill; Native = Fluent; 20–40 point penalty for missing mandatory language; max 5 point penalty for "nice to have")
  2. Candidate context block: added `Spoken languages: English (Advanced), Danish (Native)` line
- **`app/api/jobs/[id]/rescore/route.ts`** — fixed partial profile select: added `personal_projects, spoken_languages` to the `.select()` call (was missing, causing `spoken_languages` to always be null on rescore)
- **`app/api/jobs/rescore-all/route.ts`** — same fix: added `personal_projects, spoken_languages` to the profile `.select()`

### DB fixes (manual)
- Job `d77a199f-9ecb-419e-a2d5-6686a5e063ff` — Danish moved from missing_skills → matched_skills, score set to 75
- Job `29fdf777-fdd8-4b4a-9f4e-164d9a3bc1db` — Danish moved from missing_skills → matched_skills, score set to 75

## Decisions made

- **Native = Fluent**: A candidate with Native proficiency fully satisfies any "fluent" or "proficient" language requirement. Explicitly stated in the system prompt.
- **Language stored as JSONB array**: `[{ language: "Danish", level: "Native" }]` — structured, queryable, consistent with how personal_projects and work_experience are stored.
- **Fixed language list, not free text**: User selects from a predefined list of world languages to prevent typos and ensure consistent matching.
- **Language not required for profile completion**: `spoken_languages` is optional — not part of the `is_complete` check.
- **Rescore routes fetch full profile**: Both `/rescore` and `/rescore-all` now select `spoken_languages` so language context is always available when re-scoring.

## Problems solved

- **Rescore routes used partial profile select**: `spoken_languages` was never fetched during rescore, so the model always saw "Not specified" and kept flagging required languages as missing. Fixed by adding `spoken_languages` to the select in both rescore routes.
- **Pre-existing jobs scored without language context**: Jobs scored before this session had no language data. Fixed manually in DB for the two affected jobs. Future rescores will work correctly.

## Current state

Everything working:
- Spoken languages UI: add/remove languages with levels, saves to DB
- New job searches: language matching applied at score time
- Rescores (single + all): now include spoken_languages in profile context
- Two affected pre-existing jobs manually corrected in DB

## Next session starts with

No pending tasks. Ready for whatever the user brings next.

## Open questions

- Other pre-existing jobs may still have incorrect language flags from before this feature — user can rescore them individually or use "Rescore All"
- Emails not working in production (env vars + Resend `bandfolio.ai` verification needed)
- Should rejected users see a different message on `/pending`?
- Should Admin nav link show badge count for pending users?
