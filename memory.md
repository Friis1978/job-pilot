# Memory — Location Scoring, Bulk Ops, Contact Extraction, Dashboard

Last updated: 2026-06-16

## What was built

**`components/BulkOpsProvider.tsx`** (new) — layout-level React context that owns `rescoring`/`researching` state, fires fetch calls to `/api/jobs/rescore-all` and `/api/jobs/research-all`, and renders a persistent floating status banner (bottom-right). State survives navigation between pages.

**`app/layout.tsx`** — wraps children in `<BulkOpsProvider>` so bulk op state persists across route changes.

**`components/find-jobs/JobsTable.tsx`** — removed local `rescoring`/`researching` state and both handler functions; now uses `useBulkOps()` context. Company, title, and location cells use `<Tooltip>` with `max-w-0` on `<td>` and `truncate block` on text spans. Location shows `—` with no tooltip when null.

**`components/ui/Tooltip.tsx`** (new) — black-background tooltip with downward arrow, hover-triggered, using `group/tooltip` pattern.

**`app/dashboard/page.tsx`** — company research chart data comes from direct DB query on `jobs.researched_at + jobs.source` instead of PostHog events (hours-long ingestion delay). Splits `search` vs `imported` by `source === 'url'`.

**`components/dashboard/CompanyResearchChart.tsx`** — `CompanyResearchPoint` type is now defined locally (was re-exported from posthog-query which no longer exports it).

**`lib/posthog-query.ts`** — removed `getCompanyResearchActivity()` and `CompanyResearchPoint`.

**`agent/research-company.ts`** — multiple fixes:
- **HTTP fetch of source_url runs BEFORE browser** (new primary step) — strips HTML, passes to GPT-4o for contact extraction. Works for SSR pages (Emply/Angular) because full content is in raw HTML.
- Page text extraction (`body.innerText`) now runs BEFORE `stagehand.extract()`, each in own try/catch.
- `waitUntil: "networkidle"` with 25s timeout wrapped in try/catch.
- All synthesis output translated to English via system prompt rule.
- `sourceUrls` deduplicated with `[...new Set(...)]`.
- Diagnostic `console.log` statements added throughout extraction pipeline (intentionally left in for now).

**`agent/import-job-from-url.ts`** — pre-cleans HTML (removes script/style) before `stripHtml` so Angular SSR ng-state JSON doesn't pollute the scoring window.

**`agent/find-jobs.ts`** — `scoreJob` now builds a location penalty rule from `profile.remote_preference` + `profile.preferred_locations` when `searchedLocation` is empty:
- `onsite` + preferred cities → caps score at 35 for jobs elsewhere, 40 for fully remote
- `remote` → caps at 30 for onsite-only jobs
- `hybrid` + preferred cities → caps at 40 for onsite-only elsewhere
- No preference → no rule (unchanged behavior)

## Decisions made

- **HTTP fetch before browser for contact extraction**: SSR pages have all content in raw HTML. Plain fetch is more reliable than waiting for Angular hydration in Browserbase.
- **BulkOpsProvider at layout level**: Only way to keep operation state alive across client-side navigation in Next.js App Router.
- **Dashboard research chart from DB not PostHog**: PostHog has ingestion delay; `jobs.researched_at` is immediate.
- **mailto: extraction gated to job board aggregators only**: ATS pages (Emply, Greenhouse, etc.) may contain recruiter agency emails that would wrongly override the employer's homepageUrl.
- **Profile location prefs used in fallback scoring**: `scoreJob` receives a full `Profile` object — no signature change needed, just reads `profile.remote_preference` and `profile.preferred_locations` when `searchedLocation === ""`.

## Problems solved

- **Contacts missing (Torben Åstradsson + Mashiah Moltrup-Ryom) on Emply job**: (1) stagehand.extract() throwing silently skipped page text block via outer catch, (2) page text ran after stagehand (wrong priority), (3) browser body.innerText may not reflect full Angular hydration. Fixed with HTTP fetch as primary extraction.
- **Wrong company researched (Right People Group instead of F&P)**: mailto: link `mmr@rightpeoplegroup.com` was overriding `homepageUrl`. Fixed by gating mailto: to job board domains only.
- **Import match score 60% / only Nuxt found**: stripHtml on raw Angular SSR HTML included ng-state JSON at front, pushing job description past scoring window. Fixed by pre-cleaning HTML.
- **Dashboard research chart always empty**: Was querying PostHog (ingestion delay). Fixed by querying DB.
- **Bulk ops cancelled on navigation**: State was local to JobsTable component. Fixed by BulkOpsProvider.
- **Duplicate sources in research dossier**: Fixed with `[...new Set(...)]`.
- **Dossier text in Danish**: Fixed by adding English-only rule to synthesis system prompt.
- **Air Apps Lisbon job scored 90%**: `scoreJob` had no location rule when `searchedLocation` is `""`. Fixed by falling back to profile's `remote_preference`/`preferred_locations` — Lisbon job will now cap at ≤35 after rescore.

## Current state

- Deployed commit `c17779a` — deployment triggered, in progress at https://8kj4iaqv.insforge.site
- All TypeScript compiles clean
- Contact extraction NOT yet verified working after deploy — user needs to re-research F&P job and check if Torben + Mashiah appear
- Diagnostic console.log statements are intentionally in production code for now — remove once contacts confirmed working
- Air Apps Lisbon job still shows 90% until user triggers "Rescore All" on deployed version

## Next session starts with

1. Verify deploy completed at https://8kj4iaqv.insforge.site
2. Re-research F&P / Emply job and verify Torben Åstradsson (IT manager contact) and Mashiah Moltrup-Ryom (recruiter) appear in dossier
3. If contacts confirmed, remove all diagnostic `console.log` from `agent/research-company.ts`
4. Trigger "Rescore All" and verify Air Apps Lisbon job score drops to ≤35

## Open questions

- Does HTTP fetch of the Emply source_url return full SSR HTML with contacts, or does Emply block server-side fetches? (Logs will reveal this)
- Is the Emply job URL `https://forsikringogpension.career.emply.com/ad/senior-frontendudvikler-nuxt/kpdjpb` still live?
