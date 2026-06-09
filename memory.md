# Memory — 02 Auth Complete + Login Redesign

Last updated: 2026-06-09

## What was built

Auth flow is complete, reviewed, and all issues resolved. Login page redesigned.

**Auth files (unchanged from previous session, confirmed working):**
- `app/auth/login/page.tsx` — Google + GitHub OAuth. Uses `skipBrowserRedirect: true`, stores PKCE verifier in `insforge_pkce_verifier` cookie, manually redirects to OAuth provider
- `app/auth/callback/route.ts` — Server-side GET handler. Exchanges code + verifier with InsForge server-to-server, calls `setAuthCookies()`, redirects to `/dashboard`. Now wrapped in try/catch — non-JSON InsForge responses redirect to `/auth/login?error=auth_failed` instead of crashing
- `app/api/auth/refresh/route.ts` — `createRefreshAuthRouter()` from `@insforge/sdk/ssr`. Required by `createBrowserClient`
- `app/api/auth/logout/route.ts` — `clearAuthCookies()` from `@insforge/sdk/ssr`
- `middleware.ts` — Protects `/dashboard`, `/profile`, `/find-jobs`. Unauthenticated → `/auth/login`. Authenticated at `/auth/login` → `/dashboard`

**Login page redesign (`app/auth/login/page.tsx`):**
- Two-column card layout. Left panel: marketing copy (`bg-accent-muted` background, decorative blur blobs, "OAuth secured by InsForge" badge, hero headline, description, footer note). Right panel: "Welcome to / JobPilot" heading, Google + GitHub OAuth buttons
- Removed the old centered single-card layout entirely
- `GoogleIcon`, `GitHubIcon`, `ShieldIcon` defined as private helpers in the same file

**Context files corrected:**
- `context/architecture.md` — updated folder structure (`(auth)/` → `auth/`, callback `page.tsx` → `route.ts`), auth section (`/login` → `/auth/login`, redirect to `/dashboard`), InsForge client pattern (correct import `@insforge/sdk/ssr`, correct object config shape)
- `context/build-plan.md` — updated redirect references to `/auth/login` and `/dashboard`

**Logout error handling added:**
- `app/profile/page.tsx` and `app/dashboard/page.tsx` — `handleLogout` now has try/catch. Navigation to `/` always runs regardless of whether SDK call or fetch fails

## Decisions made

- **Post-login redirect is `/dashboard`** — not `/profile`. Build plan rule followed. Middleware and callback both redirect to `/dashboard`.
- **Auth route structure:** `app/auth/login` and `app/auth/callback` — NOT `app/(auth)/...`. Route groups strip the segment, making URLs resolve to `/login` and `/callback` instead of `/auth/login` and `/auth/callback`.
- **Server-side callback:** OAuth code exchange happens server-to-server in `app/auth/callback/route.ts`. `setAuthCookies()` writes HttpOnly cookies. This is what makes middleware sessions work.
- **PKCE verifier in cookie:** `signInWithOAuth({ skipBrowserRedirect: true })` returns `codeVerifier`. Stored as `insforge_pkce_verifier` cookie (5-min TTL, path-scoped to `/auth/callback`).
- **`/api/auth/refresh` is a local Next.js route:** `createBrowserClient` always calls `POST /api/auth/refresh` on localhost — not the InsForge backend. Must exist as a route handler.
- **Login page uses `bg-accent-muted` on the left panel** — intentional deviation from ui-rules.md "no colored card backgrounds" rule. Rule applies to dashboard content cards, not the login marketing panel.

## Problems solved

- `app/(auth)/callback` resolves to `/callback` not `/auth/callback` — route groups are invisible in URLs. Fixed by using `app/auth/` (no parentheses).
- Middleware had stale `/login` references — updated to `/auth/login`.
- `/api/auth/refresh` was 404 — `createBrowserClient` calls this local route. Created with `createRefreshAuthRouter()`.
- After OAuth exchange, tokens in-memory only — middleware couldn't read them. Fixed by server-side callback + `setAuthCookies()`.
- `401` console error on login page — `createBrowserClient` probing for session on init. Normal when no session exists. Not a real error.
- Callback route had no try/catch — non-JSON InsForge responses (502s, timeouts) would produce 500. Fixed.
- Context files documented wrong redirect target (`/dashboard` changed to `/profile` mid-session, then rolled back to `/dashboard`). Now accurate.

## Current state

- OAuth with Google works end to end: login → Google → `/auth/callback` → `/dashboard` ✓
- GitHub OAuth wired identically, should work the same
- Login page: two-column redesign live, matches user-provided design reference
- Middleware protects all required routes
- Context files are accurate and consistent with the codebase
- `/api/auth/refresh` responds 401 when no session (correct), 200 with new token when session exists

## Next session starts with

Feature 03 — PostHog Initialization. Per `context/build-plan.md`:
- Create `lib/posthog-client.ts` — PostHog browser client
- Create `lib/posthog-server.ts` — PostHog server client with `flushAt: 1` and `flushInterval: 0`
- Initialize PostHog in root `app/layout.tsx` — wraps entire app
- `posthog.identify()` called after successful login with user ID
- `posthog.reset()` called on logout

Run `/architect` before starting. Read `context/build-plan.md` feature 03 in full first.

## Open questions

- GitHub OAuth not yet verified in real browser (only Google was tested end-to-end)
- `app/dashboard/page.tsx` is a placeholder ("Coming soon") — needs real content in Phase 5
- `app/profile/page.tsx` is a placeholder ("Coming soon") — needs real content in Phase 2
