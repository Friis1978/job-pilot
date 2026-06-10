# Memory — Nordic Job Search + LinkedIn + Scoring Fix

Last updated: 2026-06-10

## What was built

**Multi-source Nordic job search (complete):**
- `lib/jobtech.ts` — Swedish JobTech Dev API, no key required, open access
- `lib/jooble.ts` — Jooble aggregator, needs `JOOBLE_API_KEY`
- `lib/careerjet.ts` — Careerjet `da_DK`, needs `CAREERJET_API_KEY`, HTTP-only, requires `Referer: https://jobpilot.app/` header
- `lib/linkedin-jobs.ts` — LinkedIn Jobs via RapidAPI (`linkedin-job-search-api.p.rapidapi.com`), endpoint `/active-jb-7d`, needs `RAPIDAPI_KEY`. Returns full descriptions. 28 DK + 100 SE jobs confirmed working.
- `types/index.ts` — `NormalizedJob` with `source: "adzuna"|"jobtech"|"jooble"|"careerjet"|"linkedin"`
- `agent/find-jobs.ts` — `detectSources()` routes by location, `Promise.allSettled` parallel fetching, `normalizeAdzunaJob()`, `scoreJob()` takes NormalizedJob
- `lib/utils.ts` — `MATCH_THRESHOLD=50`, `stripHtml()` applied at all four source normalizers

**Indeed DK (RapidAPI) — built then removed:**
- `lib/indeed-denmark.ts` was created but deleted — BASIC plan rate limit too strict (hits cap on first request), API also times out. Can re-add if user upgrades to paid plan. Correct endpoint confirmed as `/indeed-dk/` not `/indeed-se/`.

**Scoring fix:**
- `agent/find-jobs.ts` scoring prompt updated with strict rules: cap at 50 for descriptions <100 words, no inferring unstated requirements, penalise seniority/domain/stack mismatches. Root cause: Careerjet returns 150–270 char snippets → GPT-4o inflated scores due to lack of information.

## Decisions made

- **Source routing:**
  - Sweden → JobTech + Jooble + LinkedIn (location_filter="Sweden")
  - Denmark → Careerjet + Jooble + LinkedIn (location_filter="Denmark")
  - UK/AU/CA → Adzuna
  - Default → Adzuna
- **LinkedIn API uses 7-day endpoint** (`active-jb-7d`) not 1-hour — 1h returns 0 Nordic results, 7d returns 28 DK / 100 SE
- **LinkedIn location_filter** uses full English country name ("Denmark"/"Sweden"), not city names
- **LinkedIn source detection** in agent: infers "Sweden" vs "Denmark" from the user's location string using regex, since LinkedIn doesn't support city-level filtering
- **Careerjet is HTTP-only** — HTTPS port 443 refuses. Requires `Referer` header.
- **Scoring conservatism**: descriptions under 100 words must score ≤50. GPT-4o must not infer requirements.
- **MATCH_THRESHOLD = 50**

## Problems solved

- **Careerjet false positives (95% match on irrelevant jobs)** — Careerjet returns 150–270 char snippets. GPT-4o had no requirements to score against so it inflated scores. Fixed via scoring prompt rules.
- **Indeed DK rate limiting** — BASIC plan unusable, removed. Endpoint is `/indeed-dk/`.
- **Careerjet HTTPS refused** — use `http://`.
- **Careerjet "Undeclared referrer" error** — fixed with `Referer: https://jobpilot.app/`.
- **JobTech open access** — no API key needed despite docs suggesting registration.
- **LinkedIn `active-jb-1h` returns 0 Nordic results** — switched to `active-jb-7d`.

## Current state

- Phase 1–4 complete (Features 01–13)
- Multi-source Nordic job search: complete and TypeScript-clean
- Sweden: JobTech (✅ no key) + Jooble (⚠️ needs key) + LinkedIn (✅ key set)
- Denmark: Careerjet (✅ key set) + Jooble (⚠️ needs key) + LinkedIn (✅ key set)
- Scoring: conservative prompt in place, short descriptions capped at 50
- Phase 5 Dashboard: not started

## Next session starts with

**Feature 14 — Dashboard Page Full UI.**

Run `/architect feature 14` before building. Phase 5 sequence:
- 14 Dashboard Page — Full UI
- 15 Stats Bar — Real Data
- 16 Recent Activity — Real Data
- 17 Analytics Charts — PostHog Data

## Open questions

- `JOOBLE_API_KEY` not yet registered — Jooble calls fail silently via `Promise.allSettled`.
- Feature 13 company research blocks ~60–120s — will timeout on Vercel free tier. Address at deployment.
- RapidAPI key (`c85c41390amsh...`) was pasted in chat — user should consider rotating it at rapidapi.com/developer/apps if this is a shared repo.
