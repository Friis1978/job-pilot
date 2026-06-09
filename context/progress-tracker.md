# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 1 — Foundation
**Last completed:** 07 AI Profile Extraction from Resume
**Next:** 08 Resume PDF Generation from Profile

---

## Progress

### Phase 1 — Foundation

- [x] 01 Homepage
- [x] 02 Auth
- [x] 03 PostHog Initialization
- [x] 04 Database Schema

### Phase 2 — Profile Page

- [x] 05 Profile Page — Full UI
- [x] 06 Profile Save Logic
- [x] 07 AI Profile Extraction from Resume
- [ ] 08 Resume PDF Generation from Profile

### Phase 3 — Find Jobs Page

- [ ] 09 Find Jobs Page — Full UI
- [ ] 10 Adzuna Job Discovery
- [ ] 11 Filter + Sort + Pagination

### Phase 4 — Job Details Page

- [ ] 12 Job Details Page — Full UI
- [ ] 13 Company Research Agent

### Phase 5 — Dashboard

- [ ] 14 Dashboard Page — Full UI
- [ ] 15 Stats Bar — Real Data
- [ ] 16 Recent Activity — Real Data
- [ ] 17 Analytics Charts — PostHog Data

---

## Decisions Made During Build

_Add decisions here as they are made during implementation._

- 2026-06-09: Homepage sections and global nav/footer were updated for mobile-first responsiveness using breakpoint-based layout changes (no client-side menu state introduced).
- 2026-06-09: `@insforge/ssr` does not exist as a separate npm package — SSR utilities (`createBrowserClient`, `createServerClient`, `updateSession`) are exported from `@insforge/sdk/ssr`. Cookie names are `insforge_access_token` and `insforge_refresh_token`.
- 2026-06-09: Next.js `RequestCookies`/`ResponseCookies` types don't match InsForge `CookieStore` overload signatures exactly — using `as any` cast in `middleware.ts` (runtime behavior is correct).
- 2026-06-09: DB trigger `on_auth_user_created` auto-creates a profiles row on auth.users INSERT — every authenticated user always has a profiles row. Features 05+ can assume non-null.
- 2026-06-09: InsForge storage.objects schema uses `bucket` and `key` columns (not Supabase's `bucket_id` and `name`). Storage RLS uses `split_part(key, '/', 1)` to extract the user_id path segment.

---

## Notes

_Add notes here as the build progresses — workarounds, patterns, anything that differs from the context files._

- 2026-06-09: 2-column homepage sections now use `grid-cols-1 lg:grid-cols-2` to avoid compressed text blocks on narrow screens.
- 2026-06-09: Homepage consistency cleanup completed: typoed asset name normalized to `agent-log.png`, testimonial quote styling moved from inline styles to utility classes.
- 2026-06-09: Features section background updated to white (`bg-surface`) to match homepage card consistency.
- 2026-06-09: HowItWorks and Features section canvases aligned to muted gray (`bg-surface-muted`) to match final landing reference.
- 2026-06-09: HowItWorks text list area moved back to white (`bg-surface`) while keeping the outer section canvas muted, matching mockup layering.
