# Memory — Resume Generation & Auth Fix

Last updated: 2026-06-14

## What was built

**`app/api/resume/generate/route.ts`** — overhauled to stream PDF bytes directly:
- Fresh generation: renders PDF buffer, uploads to storage for caching, returns `application/pdf` response (not a URL)
- Cached path: downloads from storage server-side via `insforge.storage.from("resumes").download(storagePath)`, streams bytes back
- Helper `pdfResponse(buffer: ArrayBuffer)` wraps the `NextResponse`
- Debug logging removed

**`components/profile/ProfileForm.tsx`** — `handleGenerateResume` updated:
- Reads `response.blob()` instead of `response.json()`
- Creates `URL.createObjectURL(blob)`, appends `<a>` to DOM, clicks, removes, revokes
- Error path reads JSON only on `!response.ok`

**`components/profile/ProfileForm.tsx`** — work experience accordion header hydration fix:
- "Remove" button was nested inside accordion `<button>` (invalid HTML, hydration error)
- Fixed: outer wrapper changed to `<div className="flex items-center hover:bg-surface-secondary">`, accordion toggle is `flex-1` button, Remove is sibling button

**`app/api/resume/ResumePDF.tsx`**:
- `headerName.marginBottom` increased from 3 → 8 (more space between name and job title)
- `wrap={false}` added to each role's `<View>` block (prevents page breaks mid-role)

**`middleware.ts`** — token forwarding via custom header:
- After `updateSession`, sets `x-insforge-access-token: <token>` on forwarded request headers
- Copies refreshed cookies to final response for browser

**`lib/insforge-server.ts`** — reads `x-insforge-access-token` header first:
- If present, passes directly as `accessToken` to `createServerClient` (bypasses cookie lookup)
- Falls back to cookie-based auth if header absent

## Decisions made

- **PDF delivery via stream, not URL**: resumes bucket is private. Browser cannot hit storage URL without auth token. Server streams bytes through our API route — client never needs a storage URL.
- **Auth token forwarding via custom header**: Next.js route handlers see original request cookies, not cookies middleware sets on the response. Forwarding `x-insforge-access-token` as a request header is the reliable path.
- **`wrap={false}` on role blocks**: keeps each work experience entry on one page; moves to next page if it doesn't fit.

## Problems solved

- **AUTH_INVALID_CREDENTIALS from storage URL**: browser was redirected to `insforge.app/api/storage/...` directly — that URL requires a bearer token the browser doesn't have. Fixed by streaming PDF through our API route instead.
- **Hydration error: button inside button**: work experience accordion had Remove button nested inside the accordion toggle button. Fixed by using a `<div>` wrapper with two sibling buttons.
- **Middleware cookie forwarding**: refreshed access token set on middleware response cookies was not visible in route handler's `cookies()`. Fixed by forwarding token as custom request header.

## Current state

All profile page and resume generation features are working:
- Profile form: accordions, sticky footer, cancel/save, embedded ResumeUpload
- Generate Resume: streams PDF directly, caches in storage, no auth issues
- PDF: skill groups, years experience, `wrap={false}` on roles, name spacing
- TypeScript clean (zero errors)

## Next session starts with

No pending tasks. Check `context/build-plan.md` and `context/progress-tracker.md` for next planned feature. Feature 21 (Scheduled Job Alert Emails) was previously identified as next.

## Open questions

- Cover letter `max_tokens: 800` may cut off with longer prompts — worth verifying
- react-pdf avatar clipping: `overflow: hidden` + `borderRadius` may not clip into a circle in production
- Cover letter PDF photo: unconfirmed whether react-pdf fetches InsForge public URL during `renderToBuffer` in production
- InsForge SDK JSONB bug still affects any future RPC with JSONB params — document in `context/library-docs.md`
- Feature 13 company research ~60-120s will timeout on Vercel free tier — address at deployment
