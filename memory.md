# Memory — Job Import Skill Matching & Cover Letter Fixes

Last updated: 2026-06-13

## What was built

### agent/import-job-from-url.ts — Better skill detection on import
- `max_tokens` for extraction: 600 → 1500
- Description limit in extraction prompt: "up to 1000 chars" → "up to 3000 chars, including all requirements and skills"
- Scoring now uses full raw text (`rawText.slice(0, 5000)`) via a separate `jobForScoring` object instead of the truncated extracted description
- `job` (used for DB storage) still uses the clean extracted description; only scoring uses raw text
- Root cause: React and other skills mentioned later in long job postings were cut off before the scorer ever saw them

### agent/generate-cover-letter.ts — All skills and work history used
- Work history: was `workExp.slice(0, 2)`, now passes ALL roles with title, company, date range, and responsibilities
- Job requirements: `job.requirements` and `job.responsibilities` arrays (fetched from DB but previously only used for language detection) now included in the cover letter prompt
- System prompt updated: "Draw on ALL skills listed under 'All skills' and 'Full work history' — the 'Matched skills' list is a hint, not a limit"
- Label changed from "Skills" → "All skills" and "Recent work" → "Full work history" in user prompt

## Decisions made

- **Separate scoring job vs display job**: `jobForScoring` has `description: rawText.slice(0, 5000)` for comprehensive skill detection; `job.description` (stored as `about_role`) stays as the clean extracted text. This avoids polluting the DB with raw scraped text.
- **All work history in cover letter**: Intentional — the AI needs older roles to reference skills that predate the 2 most recent jobs. GPT-4o context window is large enough.

## Problems solved

- **LinkedIn job import missed React**: The extraction step capped description at 1000 chars. If React appeared later in the posting, scoring never saw it. Fixed by passing full raw text (5000 chars) to scoring.
- **Dedup block on re-import**: Had to delete the specific job from the DB (`f08bafc3-e438-4b7b-96fa-8782461432e2`, CapaSystems Denmark, job ID 4399846855) via InsForge SQL to allow fresh import.
- **Cover letter ignored older experience**: `slice(0, 2)` meant skills from 3rd+ job were invisible to the AI.

## Current state

- Import flow: extraction is clean (3000 char description for storage), scoring is comprehensive (5000 char raw text)
- Cover letter generation: uses full work history, full job requirements, all profile skills
- Both fixes are code-only — no DB schema changes needed

## Next session starts with

Check `context/build-plan.md` and `context/progress-tracker.md` for the next planned feature. Feature 21 (Scheduled Job Alert Emails) is next — Resend for email, cron endpoint at `/api/cron/job-alerts` protected by `CRON_SECRET`. Or continue with user-directed fixes.

## Open questions

- Cover letter PDF photo: unconfirmed whether react-pdf successfully fetches the public InsForge URL during `renderToBuffer` in production.
- `overflow: hidden` + `borderRadius` on react-pdf `View` may not clip avatar into a circle — known react-pdf limitation.
- InsForge SDK JSONB bug still affects any future RPC with JSONB params — document in `context/library-docs.md`.
- Feature 13 company research ~60-120s — will timeout on Vercel free tier. Address at deployment.
- Cover letter `max_tokens: 800` — with longer work history now in the prompt, verify the letter isn't being cut off mid-sentence.
