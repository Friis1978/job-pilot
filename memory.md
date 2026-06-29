# Memory — LinkedIn Network Intelligence Feature

Last updated: 2026-06-29

## What was built

### New files created
- `types/index.ts` — Added `Connection` and `NetworkImport` types
- `lib/csv-parser.ts` — LinkedIn Connections.csv parser (skips preamble rows, handles quoted fields)
- `lib/network-utils.ts` — `isRecruiter()`, `isManager()`, `buildConnectionMap()`, `getConnectionsForCompany()`
- `app/api/network/import/route.ts` — POST: full replace import (delete all + bulk insert + log to network_imports)
- `app/api/network/connections/[id]/notes/route.ts` — PUT: update notes on a connection
- `app/api/network/connections/[id]/favorite/route.ts` — POST: toggle is_favorite
- `agent/suggest-contact.ts` — GPT-4o picks best contact from list, returns `{ connectionId, reasoning }`
- `agent/linkedin-message.ts` — GPT-4o generates personalised LinkedIn message <300 chars
- `app/api/agent/suggest-contact/route.ts` — POST endpoint wrapping suggestBestContact
- `app/api/agent/linkedin-message/route.ts` — POST endpoint wrapping generateLinkedInMessage
- `components/network/NetworkBadge.tsx` — LinkedIn-blue pill badge showing connection count
- `components/network/ContactSuggestion.tsx` — Client component: auto-runs AI suggestion on mount, shows selectable contact list, inline message generation
- `components/network/ImportButton.tsx` — File picker + CSV parse trigger
- `components/network/ImportPreview.tsx` — Portal modal: 4-col stats + preview + confirm
- `components/network/ConnectionsTable.tsx` — Searchable paginated table with inline notes + favorite toggle
- `components/network/CompaniesView.tsx` — Groups connections by company with strength bar
- `components/network/NetworkTabs.tsx` — 6-tab layout: Connections, Recruiters, Companies, Favorites, Notes, Import History
- `app/network/page.tsx` — Server component fetching connections + imports + profile for navbar

### Files modified
- `components/layout/Navbar.tsx` — Added Network as 4th nav item
- `components/find-jobs/JobsTable.tsx` — Added `connectionMap` prop; company cell shows NetworkBadge + building icon dot-badge
- `app/find-jobs/page.tsx` — Fetches connections, builds connectionMap, passes to JobsTable
- `app/find-jobs/[id]/page.tsx` — Fetches connections for job company; ContactSuggestion rendered inside Company Research section; OpportunityScore and network signal banner removed
- `app/api/jobs/research-all/route.ts` — Added `.is("company_research", null)` filter — only researches unresearched jobs
- `components/find-jobs/SearchCard.tsx` — After successful find-jobs (jobsSaved > 0), fires `fetch("/api/jobs/research-all", { method: "POST" })` without awaiting (fire and forget)

## Decisions made

- **Full replace on import**: re-import deletes all connections then bulk inserts fresh. Notes and favorites are lost on re-import.
- **Company matching**: exact case-insensitive trimmed string via `Map<lowercase, Connection[]>`. No fuzzy matching.
- **ContactSuggestion auto-runs on mount**: `useEffect` fires immediately, no button. AI identifies recommended contact which is auto-selected and floated to top of list. All contacts shown as selectable list — user can pick any, then generate a LinkedIn message for that person.
- **OpportunityScore removed entirely**: was confusing (showed "weak" with 100/100). File `components/network/OpportunityScore.tsx` still exists but is not imported anywhere — safe to delete.
- **Network signal banner removed**: the "You have a recruiter connection at X" / "You know N people at X" banner was removed. ContactSuggestion card now serves as entry point with header "Select contact to reach out to" + subtitle "N contacts in Company".
- **LinkedIn message merged into ContactSuggestion**: not a separate card. Appears inline after user selects a contact.
- **research-all is idempotent**: only processes jobs where `company_research IS NULL`. Safe to call repeatedly.
- **Auto-research on find-jobs**: fire-and-forget, no await, no toast. Runs silently in background.

## Problems solved

- **Network page missing navbar**: page called `<Navbar />` with no props. Fixed by fetching profile in server component and passing `user` + `isAdmin`.
- **LinkedIn CSV preamble**: LinkedIn prepends non-CSV metadata rows before actual header. Parser skips rows until it finds the expected header line.
- **OpportunityScore contradiction**: showed 100/100 with "Weak network" because strength was computed from raw network signal independently of capped score. Removed entirely.
- **Redundant AI cards**: LinkedIn message was a separate card targeting `jobConnections[0]` instead of AI-suggested contact. Merged into ContactSuggestion.
- **Contact list ordering**: recommended contact floated to top via `.sort()` once AI identifies it.

## Current state

TypeScript-clean (`tsc --noEmit` passes, no errors). All features wired end-to-end.

**Working:**
- `/network` page with all 6 tabs, CSV import with preview modal
- NetworkBadge on job cards in JobsTable
- Job detail: ContactSuggestion auto-runs on open, shows selectable contact list (recommended first), LinkedIn message generation inline
- Company research auto-runs in background when new jobs are added via find-jobs
- research-all skips already-researched jobs

**Not yet browser-tested**: the auto-research fire-and-forget and ContactSuggestion auto-run on mount.

## Next session starts with

Test the full flow in browser:
1. Open a job with network connections → verify ContactSuggestion auto-loads, recommended contact is first in list
2. Select a contact → verify "Generate LinkedIn message" button appears and message generates
3. Run find-jobs search → verify company research fires silently in background for new jobs
4. Check `/network` page loads with navbar and all 6 tabs working

Then consider: subtle "Researching companies..." toast after find-jobs so user knows it's running.

## Open questions

- Should re-import preserve existing notes/favorites (upsert instead of full replace)? Currently all notes are lost.
- Should fire-and-forget research-all show any UI feedback?
- `components/network/OpportunityScore.tsx` is unused — delete it.
- Resend sender domain verification for production emails — still pending from earlier session.
