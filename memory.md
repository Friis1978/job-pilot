# Memory — Careerjet/Aggregator Job Enrichment & Research Agent Fixes

Last updated: 2026-06-17

## What was built

**`agent/find-jobs.ts`** — Three changes:
1. `enrichJobDescription`: now always enriches aggregator-sourced jobs regardless of description length. Previously skipped if `description.length > 300`, so Careerjet snippets were never enriched.
2. Removed `.slice(0, 6000)` truncation — full employer page text stored in `about_role` so contact sections at the bottom are never cut off.
3. Added `browserEnrichJobs` function + Browserbase/Stagehand imports. After HTTP enrichment runs in parallel, aggregator jobs with descriptions still < 1000 chars are visited in one shared real browser session (bypasses Cloudflare). Up to 5 jobs per search run. Uses `timeoutMs: 25000` per page.

**`agent/research-company.ts`** — Two changes:
1. DDG job search query: extracts brand from "X søger" prefix, uses unquoted core title terms + `kontakt jobbank jobindex karriere` suffix instead of exact-match quoted full title.
2. Contact/address preservation: if new research run finds nothing for `contactInfo`, `recruiterContact`, or `companyAddress`, existing saved values are kept rather than wiped.

**`agent/import-job-from-url.ts`** — Added optional `pastedText?` parameter. When provided (length > 200), skips all HTTP fetching and uses the pasted text directly.

**`app/api/agent/import-url/route.ts`** — Added `text` field parsing, passes it as `pastedText` to `importJobFromUrl`.

**`components/find-jobs/SearchCard.tsx`** — Added `importText` state + optional textarea below URL input in the "Add from URL" tab. Sends `text` field in POST body only if > 200 chars.

## Decisions made

- **Browserbase for Careerjet**: Plain HTTP always fails Cloudflare Turnstile on Careerjet. One shared session per Find Jobs run — no per-job session overhead.
- **`timeoutMs` not `timeout`**: Stagehand's `page.goto` uses `timeoutMs`. Consistent with `research-company.ts`.
- **Max 5 browser jobs per run**: Caps Browserbase usage to avoid excessive session time and cost.
- **Pasted text for URL import**: User pastes job text when a page is Cloudflare-blocked. Browserbase reserved for automated Find Jobs flow.

## Problems solved

- **Careerjet snippets not enriched**: Root cause was `description.length > 300` skip — Careerjet snippets are ~300-500 chars so they passed the threshold but had no contact info. Fixed with `isFromAggregator` check.
- **Research agent wiping contacts**: Re-running "Research Company" overwrote manually-set contacts. Fixed with preservation logic.
- **DDG bot challenge in plain HTTP**: DuckDuckGo returns a bot challenge to plain fetch. Works correctly inside Browserbase — not a bug.

## Current state

- `browserEnrichJobs` is wired in but **not yet tested** in production — needs a real Find Jobs run with Careerjet results to confirm Cloudflare bypass works.
- Research agent contact preservation is in place.
- Pasted text for URL import is live.

## Next session starts with

Test `browserEnrichJobs` by running a Find Jobs search for a Danish location (e.g. Copenhagen) that produces Careerjet results — check that saved `about_role` contains contact sections. If Cloudflare still blocks, check Browserbase session screenshots.

## Open questions

- Does Browserbase's Chromium actually pass Careerjet's Cloudflare Turnstile, or does it get a "Verify you are human" page? (Turnstile may require user interaction.)
- For `jobviewtrack.com` URLs that redirect back to Careerjet: the browser will visit a jobviewtrack URL — will it follow through to Careerjet and pass Cloudflare? Needs verification.
- Should `browserEnrichJobs` guard on `BROWSERBASE_PROJECT_ID` env var to avoid crashes in environments without it configured?
- Does the jobviewtrack Referer fix resolve to employer URLs in production? (unconfirmed from prior sessions)
- Has the auth fix (refresh token from Set-Cookie) been confirmed after a full login cycle? (unconfirmed from prior sessions)
