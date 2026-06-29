# Memory — LinkedIn Network Feature

Last updated: 2026-06-29

## What was built

Full LinkedIn network intelligence layer:

- **`lib/csv-parser.ts`** — parses LinkedIn `Connections.csv` (skips preamble, handles quoted fields)
- **`lib/network-utils.ts`** — `isRecruiter()`, `isManager()`, `calculateOpportunityScore()`, `networkStrength()`, `buildConnectionMap()`, `getConnectionsForCompany()`
- **DB tables** — `connections` and `network_imports` created in InsForge with RLS
- **`/api/network/import`** — POST: full-replace import, logs to network_imports
- **`/api/network/connections/[id]/notes`** — PUT: update notes
- **`/api/network/connections/[id]/favorite`** — POST: toggle favorite
- **`agent/suggest-contact.ts`** + **`/api/agent/suggest-contact`** — GPT-4o picks best contact from company connections
- **`agent/linkedin-message.ts`** + **`/api/agent/linkedin-message`** — GPT-4o generates personalised connection request
- **`/network` page** with 6 tabs: Connections, Recruiters, Companies, Favorites, Notes, Import History
- **`NetworkBadge`** — shown on job cards in `JobsTable` when user has connections at that company
- **`OpportunityScore`** — shown on job detail right sidebar (match_score + network bonus ≤25, capped 100)
- **`ContactSuggestion`** — lazy AI card on job detail right sidebar
- **`LinkedInMessage`** — lazy AI card on job detail right sidebar
- **Navbar** — Network added as 4th nav item

## Decisions made

- **No companies table** — companies derived by `GROUP BY company` at query time
- **Exact match, case-insensitive** — company-to-job linking via trimmed lowercase string comparison
- **Full replace on re-import** — all previous connections deleted; notes/favorites lost on re-import
- **Opportunity Score not stored** — computed at render from `match_score + connections[]`
- **Recruiter auto-detected** from position keywords (recruiter, talent acquisition, headhunter, TA, HR, hiring manager)
- **Manager auto-detected** from position keywords (manager, director, VP, head of, CTO, etc.)

## Current state

- Build passes, TypeScript clean
- All 6 routes and all components compiled successfully
- Feature is wired end-to-end but not yet tested in browser
- Two small pre-existing uncommitted changes: `.design-sync/compiled.css` and `JobsTable.tsx` default status filter (now `"saved"`)

## Next session starts with

1. Commit the network feature (staged separately from the pre-existing changes)
2. Test the import flow in browser: upload a real `Connections.csv`, verify preview modal, confirm import
3. Verify NetworkBadge appears on job cards for matched companies
4. Verify OpportunityScore, ContactSuggestion, LinkedInMessage on job details page
5. (Optional) Delete old `onboarding-*.png` files that are unused since WebP switch

## Open questions

- Resend sender domain verification for production emails — still pending from last session
- `insforge.toml` subdomain still `"findjob"` — update to something current?
- Should re-import warn the user before wiping notes/favorites if they have any set?
