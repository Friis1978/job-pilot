# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 6 — Enhancements
**Last completed:** 20 Application Status Tracking
**Next:** 21 Scheduled Job Alert Emails

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
- [x] 17 Analytics Charts — PostHog Data

### Phase 6 — Enhancements

- [x] 18 Middleware Auth Protection
- [x] 19 Cover Letter Generator
- [x] 20 Application Status Tracking
- [ ] 21 Scheduled Job Alert Emails

### Phase 7 — Network Intelligence

- [x] 22 LinkedIn CSV Import (parse, preview, full-replace import, import history)
- [x] 23 Network Page (`/network`) — Connections, Recruiters, Companies, Favorites, Notes, Import History tabs
- [x] 24 Network Badge on job cards (connection count + recruiter indicator)
- [x] 25 Opportunity Score on job details (match_score + network bonus, capped 100)
- [x] 26 AI: Best Contact Suggestion (`/api/agent/suggest-contact`)
- [x] 27 AI: LinkedIn Message Generator (`/api/agent/linkedin-message`)

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
- 2026-07-22: All AI calls moved to Claude. Every provider call now goes through `lib/ai/claude.ts` (`complete` / `completeJson`, `MODEL_SMART` = claude-opus-4-8, `MODEL_FAST` = claude-haiku-4-5); the `openai` package is uninstalled and `OPENAI_API_KEY` is no longer read anywhere. 23 OpenAI call sites migrated across 16 files, plus the three that were already on Claude (they were on claude-sonnet-4-6 with their own clients). Two API changes to know: Opus 4.8 rejects `temperature`/`top_p`/`top_k` with a 400, so every temperature and the scorer's `seed: 1` are gone — JSON shape is now pinned by `output_config.format` (json_schema) and depth by `effort`; and Haiku 4.5 rejects `effort`, so the helper only sends it to models that accept it (verified against the live API — sending it 400s every fast-tier call). `TokenAccumulator.add()` now takes the model so a single action bills each tier at its own rate instead of billing summaries at the scoring rate. track-tokens PRICING corrected: opus-4-8 was listed at the old $15/$75 per 1M (actual $5/$25) and haiku-4-5 at $0.80/$4.00 (actual $1/$5).
- 2026-07-22: `MODEL_SMART` switched from `claude-opus-4-8` to `claude-sonnet-5` — same $3/$15 per 1M as the old sonnet-4-6 and below the gpt-4o output rate it replaced, with structured outputs and `effort` both supported. Two things verified live before the switch: Sonnet 5 accepts `effort` (Haiku still does not), and it runs adaptive thinking when `thinking` is omitted where Opus 4.8 does not — so the helper now always sends `thinking` explicitly (`disabled` unless the caller asks), because thinking tokens count against `max_tokens` and several call sites run on budgets as tight as 100. Scoring returned identical matchScore and matchedSkills across 5 runs, averaging 72 output tokens against the 500 cap. PRICING lists sonnet-5 at the standard $3/$15 rather than the introductory $2/$10 that lapses 2026-08-31 — the intro rate would start undercharging silently the day it ends.
