# Memory — Cover Letter JSON Generation Fix

Last updated: 2026-07-11

## What was built

### tailored-cover-letter route (main fix)
**`app/api/jobs/[id]/tailored-cover-letter/route.ts`** — complete rewrite:
- Switched from free-form generation to structured JSON (`response_format: json_object`)
- 5 discrete fields: greeting, intro, achievement, fit, closing
- Removed `humanizeText` post-processing
- Removed motivation/proud_achievement/energy_tasks from prompt input
- Comprehensive forbidden word list: excited, passion, thrive, resonates, inspires, seamlessly, empowering, leverage, transformative, "real value", etc.
- Temperature 0.4
- Custom instructions appended as style guide (voice/structure only)

### generate-cover-letter.ts (agent route — same fixes)
**`agent/generate-cover-letter.ts`** — same JSON approach applied:
- Fixed generation system prompt (not custom instructions)
- JSON structured output with same 5 fields
- No humanize when custom instructions set, humanize otherwise

### Other files
- **`agent/edit-cover-letter.ts`** — created (kept for potential future use, not currently called)
- **`profiles.cover_letter_instructions`** in DB rewritten from 12,119 → 2,201 chars

### DB change
Cover letter instructions updated via SQL directly on InsForge. New instructions: no fabrication, language/greeting rules, direct/factual voice (NOT extroverted), comprehensive forbidden phrases, substance requirements (must name specific tech), structure rules.

## Decisions made

- **JSON structured generation is the fix for GPT-4o cliché output** — free-form generation reliably produces banned enthusiasm language regardless of instruction-based bans. Filling discrete fields with per-field constraints bypasses the model's strong cover-letter priors.
- **Do NOT use custom instructions as the generation system prompt** — 12k+ chars of personality-focused instructions cause the model to express extroversion through emotional language.
- **Remove motivation/energy_tasks/proud_achievement from prompt input** — user-written emotional language in these fields was being mirrored by the model.
- **No humanize pass when custom instructions are set** — humanize re-introduces banned phrases.
- **The tailored-cover-letter route (`/api/jobs/[id]/tailored-cover-letter`) is the one the UI actually calls** — not the agent route (`/api/agent/cover-letter`). Both were fixed but the tailored route is primary.

## Problems solved

- GPT-4o reliably produced "excited", "passion", "thrive", "resonates" regardless of instruction bans — solved by JSON structured generation
- Custom instructions (12k chars with "extroverted" persona) were causing enthusiasm language — solved by rewriting instructions to 2.2k and not using as generation system prompt
- `humanizeText` re-introduced banned phrases after clean generation — solved by skipping it when custom instructions are set
- "Appreciate the intricacies of machinery" hallucination (audio engineering → manufacturing) — solved by explicit no-fabrication rule and removing inferred connections
- User-written motivation/energy fields echoed back as emotional language — solved by removing those fields from the prompt
- All fixes were applied to the wrong file (`generate-cover-letter.ts`) while the UI called `tailored-cover-letter/route.ts` — now both fixed

## Current state

- Cover letter generation works correctly (user confirmed "the cover letters are fine")
- Committed: `ca936fc`
- Resume generation also updated with CRITICAL_REMINDER (temperature 0.6, no cover letter instructions injection)

## Next session starts with

No immediate follow-up. Possible next work:
- Resume generation quality (still uses free-form, no JSON structured approach — same cliché risk exists)
- The `generate-cover-letter.ts` (agent route) and `tailored-cover-letter/route.ts` have diverged in structure — could be consolidated into one shared function

## Open questions

- Should resume generation also use the JSON structured approach to prevent clichés in the summary?
- `cover_letter_advice` column in DB is unused — could be cleaned up
- `agent/edit-cover-letter.ts` is not called anywhere — keep or delete?
