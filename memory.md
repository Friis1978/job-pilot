# Memory — URL Import + Company Research Fixes

Last updated: 2026-06-10

## What was built

### Feature — Import Job from URL (completed)
- `agent/import-job-from-url.ts` — fetches page HTML, strips HTML, GPT-4o extracts job details, scores with `scoreJob()`, saves to DB with `source: "url"`. Dedup check by `source_url`.
- `app/api/agent/import-url/route.ts` — POST handler, auth check, validates URL, calls `importJobFromUrl`, revalidates `/find-jobs` and `/dashboard`.
- `types/index.ts` — `"url"` added to `NormalizedJob.source` union; `source: string` added to `JobRow`.
- `components/find-jobs/SearchCard.tsx` — tab switcher (Find Jobs | Add from URL). URL tab: `LinkIcon`, URL input, "Import Job" button, 60s AbortController timeout, success banner, hint text about LinkedIn. `LinkIcon` SVG defined at bottom of file.
- `app/find-jobs/page.tsx` — `source` added to DB select query.
- `components/find-jobs/JobsTable.tsx` — "Imported" badge (info color, small uppercase) in Company cell when `job.source === "url"`.

### Company Research — Re-run button
- `components/find-jobs/ResearchButton.tsx` — added `hasResearch?: boolean` prop. When `true`: shows small "Re-run" secondary button with `RefreshIcon` (animate-spin while loading). When `false`: original "Research Company" primary button. All errors now go to `toast()` — no inline error text. `done` state resets on each run.
- `app/find-jobs/[id]/page.tsx` — `ResearchButton` always rendered in Company Research header (not conditionally); passes `hasResearch={!!job.company_research}`.

### Company Research — URL resolution fix
- `agent/research-company.ts` — `resolveCompanyUrl` now returns `{ url, needsGptLookup }` instead of `string`. When redirect lands on ATS (Paychex, Teamtailor, etc.) or domain doesn't match company name → `needsGptLookup: true`.
- GPT-4o URL lookup added: when `needsGptLookup`, asks GPT-4o "What is the official URL for [company]?" before running Stagehand. Fixes non-English companies (e.g. Danish `.dk` domains) that a guessed `.com` fallback can't find.
- Expanded `ATS_AND_JOB_BOARD_DOMAINS` with ~15 more ATS/HR platforms (Paychex, Teamtailor, Bamboo HR, Personio, SuccessFactors, ADP, emply.com, reachmee.com, webcruiter.no, etc.).
- Improved fallback URL builder: strips Scandinavian legal suffixes (A/S, ApS), converts `&` → `and`, removes non-alphanumeric chars.
- Domain/company similarity check: if resolved domain shares no words with company name → force `needsGptLookup`.

### Company Research — GPT-4o knowledge fallback + no-result toast
- When browser research yields empty `oneLiner` + `productSummary`, GPT-4o asked to use its training knowledge about the company (conservative — only states facts it's confident about).
- If STILL empty after GPT-4o fallback → returns `{ success: false, error: "No information found for \"[company]\"..." }`. User sees toast, no empty dossier saved.
- OpenAI instance initialized earlier in `researchCompany()` (before Stagehand block) so it's reused for URL lookup, knowledge fallback, and synthesis.
- Synthesis system prompt notes whether research came from live web scrape or AI training knowledge.

## Decisions made

- **GPT-4o URL lookup is lazy** — only fires when `needsGptLookup: true` (ATS redirect or no source URL). Normal jobs where the source URL redirects to the company's own site skip this step entirely.
- **No-result is an error, not a silent empty dossier** — if neither browser nor GPT-4o can find company info, the agent returns `success: false` so the user is informed rather than seeing a dossier with nothing useful.
- **`toast()` for all ResearchButton errors** — cleaner than inline text, consistent with rest of app.

## Problems solved

- **Paychex ATS redirect** — "Forsikring & Pension" jobs on Adzuna redirect to Paychex (their ATS). Paychex wasn't in the blocklist so research was about Paychex instead. Fixed by adding Paychex to `ATS_AND_JOB_BOARD_DOMAINS` + domain similarity check.
- **Danish company domain guessing** — `forsikring&pension` → `forsikringandpension.com` (wrong: `.com`, English "and"). Fixed by asking GPT-4o for the actual URL (`forsikringogpension.dk`).

## Current state

All features through Feature 20 + URL Import complete. Company research now has re-run, correct URL resolution, GPT-4o fallback, and user-facing toast on failure. Feature 21 (Scheduled Job Alert Emails) still on hold.

## Next session starts with

Feature 21 (Scheduled Job Alert Emails) — run `/architect feature 21`, check `context/build-plan.md`. Uses Resend for email, cron endpoint at `/api/cron/job-alerts` protected by `CRON_SECRET`. Or continue with user-directed UX polish.

## Open questions

- Feature 13 company research ~60-120s — will timeout on Vercel free tier. Address at deployment.
- Dashboard CompanyResearchChart is single child in 2-col grid — renders half-width on desktop. Consider col-span-2 or pairing with another card.
- next/image OAuth avatar URLs — may need remotePatterns in next.config.ts if broken images appear.
- RapidAPI key was pasted in a prior session chat — consider rotating at rapidapi.com/developer/apps.
