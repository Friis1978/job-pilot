# Memory — Cover Letter Rule Enforcement Fix

Last updated: 2026-07-11

## What was built

Modified `agent/generate-cover-letter.ts`:
- Removed preamble wrapper when custom instructions are set (now passed directly as system prompt)
- Skip `humanizeText` post-processing when custom instructions are present
- Lowered temperature from 0.9 → 0.6
- Injected `CRITICAL_REMINDER` as the **last user message** before generation (recency effect ensures rules are followed)
- Critical reminder includes: TypeScript = JavaScript rule, forbidden phrases list, language enforcement, no-fabrication rule
- `extraInstructions` now placed before the critical reminder (previously it was the final message, which meant rules could be overridden by it)

Committed: `79cf84f`

## Decisions made

- **Critical rules belong as the last message, not the system prompt** — long system prompts get deprioritized as the model fills its context. Pinning rules in the final user message before generation is what actually enforces them.
- **No humanize pass when custom instructions are set** — the humanize step (`gpt-4o-mini`, temp 0.7) was adding phrases like "What I find interesting is..." that violated the user's custom rules.
- **Temperature 0.9 was the core problem** — at that level the model improvises over rules. 0.6 keeps it compliant without making the output feel robotic.

## Problems solved

- AI generated "While I haven't worked directly with JavaScript..." despite 10 years TypeScript/React experience — because "JavaScript" was not in skills list. Fixed via explicit critical reminder.
- AI kept producing forbidden clichés ("In my professional journey", "aligns seamlessly", "passion for") despite a 12,119-char instruction set in the DB — because system prompt rules get deprioritized when the context is long. Fixed via last-message reminder.
- `humanizeText` was undoing voice rules from custom instructions. Fixed by skipping it when custom instructions exist.

## Current state

- Cover letter generation works correctly and follows user rules (verified working)
- Custom instructions (12,119 chars) stored in `profiles.cover_letter_instructions` — passed directly as system prompt
- Cover letter card UI (from previous session): Title → Toolbar → Tip → Editor → Get advice & rewrite panel
- `humanized_cover_letter` column on `jobs` table stores Gemini advice, passed as `extraInstructions`

## Next session starts with

No immediate follow-up on cover letter. Possible next tasks:
- **Resume rules support**: `app/api/resume/generate/route.ts` has a hardcoded `SYSTEM_PROMPT` — no user-defined rules mechanism exists. Add `resume_instructions` field to profiles if needed.
- Or continue from previous session: test Gemini advice workflow end to end (generate → copy to Gemini → paste advice → recreate → verify)

## Open questions

- Should resume generation support user-defined rules like cover letters? No `resume_instructions` field exists yet.
- `cover_letter_advice` column in DB is now unused — could be cleaned up.
- Should humanized Gemini advice feed into `cover_letter_examples` after a successful recreate?
