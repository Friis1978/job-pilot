# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 5 — Dashboard (in progress)
**Last completed:** 16 Recent Activity — Real Data
**Next:** 17 Analytics Charts — PostHog Data

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
- [x] 08 Resume PDF Generation from Profile

### Phase 3 — Find Jobs Page

- [x] 09 Find Jobs Page — Full UI
- [x] 10 Adzuna Job Discovery
- [x] 11 Filter + Sort + Pagination

### Phase 4 — Job Details Page

- [x] 12 Job Details Page — Full UI
- [x] 13 Company Research Agent

### Phase 5 — Dashboard

- [x] 14 Dashboard Page — Full UI
- [x] 15 Stats Bar — Real Data
- [x] 16 Recent Activity — Real Data
- [ ] 17 Analytics Charts — PostHog Data

---

## Decisions Made During Build

_Add decisions here as they are made during implementation._

- 2026-06-09: Homepage sections and global nav/footer were updated for mobile-first responsiveness using breakpoint-based layout changes (no client-side menu state introduced).
- 2026-06-09: `@insforge/ssr` does not exist as a separate npm package — SSR utilities (`createBrowserClient`, `createServerClient`, `updateSession`) are exported from `@insforge/sdk/ssr`. Cookie names are `insforge_access_token` and `insforge_refresh_token`.
- 2026-06-09: Next.js `RequestCookies`/`ResponseCookies` types don't match InsForge `CookieStore` overload signatures exactly — using `as any` cast in `middleware.ts` (runtime behavior is correct).
- 2026-06-09: DB trigger `on_auth_user_created` auto-creates a profiles row on auth.users INSERT — every authenticated user always has a profiles row. Features 05+ can assume non-null.
- 2026-06-09: InsForge storage.objects schema uses `bucket` and `key` columns (not Supabase's `bucket_id` and `name`). Storage RLS uses `split_part(key, '/', 1)` to extract the user_id path segment.
- 2026-06-09: `@react-pdf/renderer` must be in `serverExternalPackages` in next.config.ts. Server-side PDF rendering uses `renderToBuffer()` — pass element via `createElement()` with a `as unknown as ReactElement<DocumentProps>` cast. Convert the returned `Buffer` to `Uint8Array` before wrapping in `Blob` for InsForge storage upload.
- 2026-06-09: InsForge storage `upload()` takes exactly 2 args (path, data) — no options object. To overwrite an existing file: call `remove(path)` first, then `upload(path, new Blob([new Uint8Array(buffer)], { type: "..." }))`.
- 2026-06-09: Generated resume is stored at `resumes/{userId}/generated-resume.pdf` (separate from uploaded `resumes/{userId}/resume.pdf`). Extraction always reads from the fixed upload path, so generating never breaks re-extraction.
- 2026-06-10: Match score bar color thresholds in design differ from ui-rules.md. Design uses: ≥90% green, ≥80% blue, <80% orange. ui-rules.md says 80-100% green, 60-79% blue. Design values were used for Feature 09 mock data.
- 2026-06-10: Feature 10 — agent code lives in `agent/find-jobs.ts`. GPT-4o scores all 10 Adzuna results in parallel (Promise.all). Only jobs with matchScore >= MATCH_THRESHOLD (70) are saved. lib/utils.ts holds MATCH_THRESHOLD. SearchCard converted to client component with live fetch to /api/agent/find.
- 2026-06-10: Feature 13 — `@browserbasehq/stagehand` added to `serverExternalPackages` in next.config.ts (bundles native binaries). Stagehand v3.5 API: constructor uses `model: { modelName: "gpt-4o", apiKey: "..." }` (NOT `modelName`/`modelClientOptions`). extract() takes `(instruction, schema)` as separate args (NOT an object). Page access is `stagehand.context.activePage()!`. stagehand.close() always in finally block — never leave sessions open. GPT-4o synthesis always runs even if browser research fails entirely. Route blocks until agent completes (~60–120s) — will timeout on Vercel free tier (10s limit).

---

## Notes

_Add notes here as the build progresses — workarounds, patterns, anything that differs from the context files._

- 2026-06-09: 2-column homepage sections now use `grid-cols-1 lg:grid-cols-2` to avoid compressed text blocks on narrow screens.
- 2026-06-09: Homepage consistency cleanup completed: typoed asset name normalized to `agent-log.png`, testimonial quote styling moved from inline styles to utility classes.
- 2026-06-09: Features section background updated to white (`bg-surface`) to match homepage card consistency.
- 2026-06-09: HowItWorks and Features section canvases aligned to muted gray (`bg-surface-muted`) to match final landing reference.
- 2026-06-09: HowItWorks text list area moved back to white (`bg-surface`) while keeping the outer section canvas muted, matching mockup layering.
