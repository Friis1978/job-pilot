# Memory — Job Enrichment, Research & Summary Pipeline

Last updated: 2026-06-18

## What was built

**`agent/find-jobs.ts`**
- `summarizeDescription` exported (was private) — now callable from other agents
- Summary threshold raised from 150 → 500 chars to prevent hallucinated summaries on short Careerjet snippets
- `browserEnrichJobs` wired in — tested in production, confirmed blocked by Cloudflare Turnstile on careerjet/jobviewtrack. Silently returns empty map when Cloudflare blocks. Careerjet jobs will keep short snippets.

**`agent/import-job-from-url.ts`**
- Imports `summarizeDescription` from `find-jobs.ts`
- Calls it before DB insert — all future URL-imported jobs now get a `description_summary` automatically

**`agent/research-company.ts`**
- `companyAddress` added to GPT-4o extraction prompt
- `contactFoundFromJobDescription` flag — skips re-scraping source URL when `about_role.length > 1000` (full enriched text present)
- Contact/address preservation — re-runs don't wipe existing values

**`components/find-jobs/SearchCard.tsx`**
- Client timeout raised 30s → 180s for Find Jobs fetch

**`app/api/agent/find/route.ts`**
- `export const maxDuration = 300` added

**`components/profile/ProfileForm.tsx`**
- `isUsed` skill highlighting now includes personal project skills (same visual treatment as work experience)

## Decisions made

- **500 char minimum for summarization**: Anything below risks hallucination — GPT-4o-mini invents details not in the snippet. 500 chars is a safe floor for real content.
- **Careerjet enrichment limitation accepted**: Cloudflare Turnstile blocks Browserbase on careerjet.dk. No automatic fix possible. User can paste text manually in "Add from URL" tab.
- **`about_role` = full text, `description_summary` = display**: Full text kept for company research; short summary shown in the UI.
- **Research skip condition**: Uses `about_role.length > 1000` (not contact found) as the reliable signal that full text is present.

## Problems solved

- **Hallucinated summaries**: GPT-4o-mini fabricated job details (stack, role title, culture) from 259-char Careerjet snippets. Fixed by raising minimum length to 500 chars.
- **import-job-from-url had no summaries**: URL-imported jobs had no `description_summary`. Fixed by calling `summarizeDescription` before insert.
- **browserEnrichJobs silently skipped**: Guard clause returned early without env vars. Confirmed vars are set in InsForge. Root cause was Cloudflare Turnstile blocking even Browserbase.

## Current state

- All 13 jobs have summaries (or are below 500 chars and correctly have none)
- All jobs researched; contacts found where publicly available
- AMC-Consult hallucinated summary cleared from DB
- Pipeline fully working for non-Careerjet sources

## Next session starts with

No immediate tasks queued. If Careerjet enrichment becomes a priority, investigate Browserbase stealth options or consider a different job source for Danish market.

## Open questions

- Careerjet/jobviewtrack via Browserbase is permanently blocked by Cloudflare Turnstile — is a different Danish job source (e.g. Jobindex direct API) worth adding?
- Koda Staff, Pandektes, Reversio have no contact info found — genuinely no public data, or worth trying a different research strategy?
