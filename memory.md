# Memory — Features 02 Auth + 03 PostHog Initialization (complete)

Last updated: 2026-06-09

## What was built

**Feature 02 — Auth (confirmed complete from prior session, reviewed this session)**
- `app/auth/login/page.tsx` — two-column login page, Google + GitHub PKCE OAuth, fires `oauth_login_clicked`
- `app/auth/callback/route.ts` — server GET route: exchanges `insforge_code` + PKCE verifier with InsForge, calls `setAuthCookies()`, fires `user_signed_in` / `auth_failed`, calls `posthog.identify()`
- `app/api/auth/refresh/route.ts` — `createRefreshAuthRouter()` from `@insforge/sdk/ssr`
- `app/api/auth/logout/route.ts` — `clearAuthCookies()` from `@insforge/sdk/ssr`
- `app/dashboard/page.tsx` — placeholder, logout fires `user_signed_out` + `posthog.reset()` + dual signOut (SDK + `/api/auth/logout`)
- `app/profile/page.tsx` — same logout pattern as dashboard
- `lib/insforge-client.ts` — browser singleton via `createBrowserClient` from `@insforge/sdk/ssr`
- `lib/insforge-server.ts` — server factory via `createServerClient`, reads cookies via `next/headers`
- `middleware.ts` — `updateSession` from `@insforge/sdk/ssr`; protects `/dashboard`, `/profile`, `/find-jobs`; redirects authenticated users away from `/auth/login`
- `.env.local` — `NEXT_PUBLIC_INSFORGE_URL`, `NEXT_PUBLIC_INSFORGE_ANON_KEY`, `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`

**Feature 03 — PostHog Initialization (completed this session)**
- `instrumentation-client.ts` — PostHog browser init (EU instance: `api_host: "/ingest"`, `ui_host: "https://eu.posthog.com"`, `capture_exceptions: true`, `defaults: "2026-01-30"`)
- `lib/posthog-server.ts` — singleton server PostHog client (`flushAt:1`, `flushInterval:0`)
- `next.config.ts` — EU reverse proxy: `/ingest/static/*` + `/ingest/array/*` → `https://eu-assets.i.posthog.com`, `/ingest/*` → `https://eu.i.posthog.com`; `skipTrailingSlashRedirect: true`
- `components/PostHogIdentitySync.tsx` — client component; `useEffect` on mount calls `insforge.auth.getCurrentUser()` and `posthog.identify(user.id, { email })` if session exists
- `app/layout.tsx` — updated to render `<PostHogIdentitySync />` inside body
- `.posthog-events.json` — event plan: 4 already-captured events + 4 planned business events

## Decisions made

- **`@insforge/ssr` does not exist on npm.** SSR utilities live in `@insforge/sdk/ssr`. Architecture.md used a Supabase analogy. All imports use `@insforge/sdk/ssr`.
- **OAuth uses PKCE.** `signInWithOAuth({ skipBrowserRedirect: true })` returns URL + `codeVerifier`. Verifier stored as `insforge_pkce_verifier` cookie (path `/auth/callback`, max-age 300s). Server callback reads verifier and exchanges with InsForge directly.
- **Callback is a server route, not a page.** `app/auth/callback/route.ts` — code exchange and cookie setting happen server-side.
- **Logout is dual.** `insforge.auth.signOut()` (SDK state) + `POST /api/auth/logout` (clears httpOnly cookies). Both needed.
- **Middleware `as any` cast.** `NextRequest.cookies` / `NextResponse.cookies` don't satisfy InsForge's overloaded `CookieStore` interface signatures. Runtime is correct.
- **PostHog server client is a singleton.** `getPostHogClient()` — no `shutdown()` call. Works because `flushAt:1` + `flushInterval:0`. Deviates from `library-docs.md` pattern but is intentional.
- **PostHog init is via `instrumentation-client.ts`**, not `lib/posthog-client.ts`. Correct approach for Next.js 15.3+. Build plan naming was outdated.
- **Auth callback calls InsForge exchange endpoint directly:** `POST ${NEXT_PUBLIC_INSFORGE_URL}/api/auth/oauth/exchange` with `{ code, code_verifier }`.
- **Cookie names:** `insforge_access_token` (access), `insforge_refresh_token` (refresh) — found in `@insforge/sdk/dist/ssr.d.ts`.

## Problems solved

- **`@insforge/ssr` not on npm** — SSR exports are in `@insforge/sdk/ssr` subpath.
- **Middleware cookie type error** — `as any` cast resolves TS overload mismatch between Next.js and InsForge cookie interfaces.
- **`/api/auth/refresh` 404** — `createBrowserClient` calls this local Next.js route. Created with `createRefreshAuthRouter()`.
- **Auth route group confusion** — `app/(auth)/...` strips the segment, making URLs `/login` not `/auth/login`. Correct structure is `app/auth/...` (no parentheses).

## Current state

- Feature 02 Auth: **complete** — OAuth end-to-end, middleware protecting routes, server-side session management
- Feature 03 PostHog: **complete** — browser init, server client, reverse proxy, user identify on startup and after login, reset on logout
- Progress tracker: **next is Feature 04 — Database Schema**
- **Known issue (from review):** `code-standards.md` event list NOT updated. Four events in use that are not in the official list: `oauth_login_clicked`, `user_signed_in`, `auth_failed`, `user_signed_out`. Update the list before Feature 04.
- **Known issue (from review):** `PostHogIdentitySync` fires `getCurrentUser()` on every page load including public pages. Optional improvement: scope to authenticated routes only.
- InsForge backend has **no tables** — empty DB, no `profiles`, `jobs`, `agent_runs`, `agent_logs`
- PostHog dashboard not yet created (MCP auth was started but not completed)

## Next session starts with

**Feature 04 — Database Schema.**

1. First: update `code-standards.md` event list to add `oauth_login_clicked`, `user_signed_in`, `auth_failed`, `user_signed_out` as official events.
2. Use InsForge MCP tools to create tables:
   - `profiles` — full column set from `context/architecture.md`
   - `agent_runs`
   - `jobs` (including `company_research jsonb`)
   - `agent_logs`
3. Create `resumes` storage bucket (authenticated access only)
4. Add RLS policies on all four tables — always filter by `user_id`

Reference: `context/architecture.md` → "InsForge Database Schema" section for all column definitions.

## Open questions

- GitHub OAuth not yet verified in a real browser (only Google tested end-to-end)
- Does the InsForge direct exchange endpoint path (`/api/auth/oauth/exchange`) need verification against production?
- Should `PostHogIdentitySync` be removed from public pages to avoid unnecessary network calls?
- PostHog dashboard still needs to be created once MCP auth is completed
