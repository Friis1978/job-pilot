# Memory — Research Agent: Address Extraction Fixes

Last updated: 2026-06-18

## What was built

**`agent/research-company.ts`** — two fixes applied this session:

1. **Debug cleanup** — removed all temporary debug markers added in the previous session:
   - Removed `const httpLog: string[]` and the two `httpLog.push(...)` lines
   - Removed `companyResearchRaw.sourceUrls.push(\`__httpLog:...\`)` line
   - Removed `dossier._resolvedHomepage = homepageUrl` and `dossier._rawAddress = ...` lines
   - Removed stray comment `// close outer: for (const httpBase of httpBaseCandidates)` from closing brace

2. **Local address preference** — injected `job.location` into all five address extraction points so GPT-4o prefers the address matching the job's country when multiple offices appear:
   - HTTP fallback system prompt (line ~1405)
   - Synthesis system prompt `companyAddress` field description (line ~1580)
   - Stagehand about-page extraction instruction (line ~1047)
   - Stagehand sub-page contact/about extraction instruction (line ~1097)
   - Stagehand fallback path extraction instruction (line ~1161)

## Decisions made

- **Local address preference is prompt-only**: No code logic change — GPT-4o chooses the right address when told the job location. This keeps the address collection code simple.
- **All five extraction points updated**: Stagehand (3 places) + HTTP GPT-4o + synthesis. All carry the same instruction: "If multiple office addresses are listed, prefer the one in the same country as the job location: ${job.location ?? 'unknown'}."
- **Root cause of Pandektes fix (confirmed working)**: `html.replace(/<[^>]+>/g, " ")` left inline `<script>` JS text in the output — 194k chars. Stripping `<script>` and `<style>` blocks first reduced it to 3198 chars. The 8000-char tail window increase was not actually needed (page fits under 9000 chars after proper stripping), but it's a safe defensive change.

## Problems solved

- **Pandektes address confirmed found**: DB query after fix showed `"Pandektes ApS, Farvergade 2, 5. th, 1463 København K, Denmark"` — correct address. Fix from previous session (script/style stripping before tag removal) worked.
- **Newcode.ai shows US address**: `d057a319-507d-4598-9a25-3f403dfb17d0` — Newcode.ai only has a Palo Alto, CA address on their website. No Danish/EU office found. The local-preference fix won't change this result since there's genuinely only one address. Address will remain as-is.

## Current state

- Research agent fully working for non-Cloudflare sources
- Address extraction now prefers local addresses over US HQ when multiple exist
- All debug artifacts removed — clean production code
- Pandektes: correct Danish address stored in DB
- Newcode.ai: US address stored (correct — no EU office found on their site)

## Next session starts with

No immediate tasks queued. The research pipeline is stable.

## Open questions

- Newcode.ai (`d057a319-507d-4598-9a25-3f403dfb17d0`) has only a US address — user may want to manually clear/update it if they consider Palo Alto irrelevant for a remote EU job
- Careerjet/jobviewtrack via Browserbase is permanently blocked by Cloudflare Turnstile — is a different Danish job source (e.g. Jobindex direct API) worth adding?
- Koda Staff, Pandektes (now fixed), Reversio — contact info still not found; genuinely no public data or worth trying a different strategy?
