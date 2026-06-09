# Memory — Feature 07 AI Profile Extraction (complete) + Session Fixes

Last updated: 2026-06-09

## What was built

**This session — fixes and refinements across multiple features:**

**Login page redesign (`app/auth/login/page.tsx`):**
- Two-column card layout. Left panel: `bg-accent-muted` background, decorative blur blobs, "OAuth secured by InsForge" badge with shield icon, large bold headline, description, footer note. Right panel: "Welcome to / JobPilot" + Google + GitHub OAuth buttons with borders. Full-page `bg-background` wrapper.

**Auth fixes:**
- `app/auth/callback/route.ts` — wrapped fetch + `.json()` in try/catch; any exception redirects to `/auth/login?error=auth_failed` instead of 500
- `middleware.ts` — post-login redirect is `/dashboard` (not `/profile`)
- `context/architecture.md` — updated: folder structure (`auth/` not `(auth)/`), auth section (`/auth/login`, redirect to `/dashboard`), InsForge client pattern (correct import `@insforge/sdk/ssr`, correct `get` cookie shape)
- `context/build-plan.md` — redirect references updated to `/auth/login` and `/dashboard`
- Logout (`handleLogout`) in both `app/profile/page.tsx` and `app/dashboard/page.tsx` — wrapped in try/catch; navigates to `/` regardless of failure

**Resume upload fix (`components/profile/ResumeUpload.tsx`):**
- Removed `insforge.auth.getCurrentUser()` client-side call — was racing the browser client's async init, always returning null
- Now accepts `userId: string | null` prop passed down from the server component
- `app/profile/page.tsx` fetches userId server-side, passes it through `ProfilePageShell` → `ResumeUpload`
- `components/profile/ProfilePageShell.tsx` updated to thread `userId` prop

**PDF extraction fixes (`app/api/resume/extract/route.ts`):**
- `pdf-parse` v2.4.5 completely changed API — no longer `pdfParse(buffer)`, now `new PDFParse({ data: buffer }).getText()`
- Static `import { PDFParse } from "pdf-parse"` — works because `serverExternalPackages: ["pdf-parse"]` is in `next.config.ts`
- Added `if (buffer.length === 0)` guard before parsing
- Added `finish_reason === "length"` warning log
- `max_tokens` raised from 800 → 4000 (800 was truncating responses)
- Text trimmed to 12,000 chars before sending to OpenAI
- Work experience limit raised from 3 → 10 roles in the system prompt
- Added `OPENAI_API_KEY` guard returning 503 if key is missing
- `OPENAI_API_KEY` added to `.env.local`

## Decisions made

- **Post-login redirect is `/dashboard`** — build plan rule followed. Both `app/auth/callback/route.ts` and `middleware.ts` redirect to `/dashboard`.
- **`userId` flows server → client as a prop** — never re-fetched client-side. `app/profile/page.tsx` (server) is the single source of truth for the authenticated user's ID in the profile page subtree.
- **`pdf-parse` v2 API** — `new PDFParse({ data: buffer }).getText()` — NOT the old `pdfParse(buffer)` function. The package is `type: "module"` with both ESM and CJS builds; `serverExternalPackages: ["pdf-parse"]` in `next.config.ts` is required for it to work in Next.js.
- **Work experience limit is 10** — DB stores `work_experience` as `jsonb` array with no hard limit. The "3 roles" limit was only in the extraction prompt. Changed to 10 to match real-world resumes.

## Problems solved

- **`insforge.auth.getCurrentUser()` returning null in `ResumeUpload`** — `createBrowserClient` calls `POST /api/auth/refresh` async on init; calling `getCurrentUser()` before that completes returns null. Fixed by passing `userId` as prop from the server component where auth is always resolved before render.
- **`pdf-parse` v2 breaking change** — `pdfParse(buffer)` no longer exists. The package exports a `PDFParse` class. `new PDFParse({ data: buffer }).getText()` is the correct API.
- **Extraction truncation** — `max_tokens: 800` cut off the JSON response mid-object. Raised to 4000.
- **OpenAI 429** — first API key had no quota. Replaced with a working key in `.env.local`.
- **Stale context files** — `architecture.md` and `build-plan.md` had wrong route paths and redirect targets from the original spec. Corrected to match actual implementation.

## Current state

- Phase 1 Foundation: **complete** (01–04)
- Feature 05 Profile Page UI: **complete**
- Feature 06 Profile Save Logic: **complete**
- Feature 07 AI Profile Extraction: **complete** — uploads to InsForge Storage, extracts via GPT-4o, populates form. Up to 10 work experience roles extracted.
- Login page: two-column redesign live and matching design reference
- All context files accurate and consistent with codebase

## Next session starts with

**Feature 08 — Resume PDF Generation from Profile.**

Per `context/build-plan.md` under "08 Resume PDF Generation from Profile":
- POST `/api/resume/generate`
- Reads profile from DB, GPT-4o generates polished content, `@react-pdf/renderer` renders to PDF buffer, uploads to InsForge Storage, saves URL back to profiles table

Run `/architect feature 08` before starting.

## Open questions

- None.
