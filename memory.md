# Memory — Branding, CI Deploy, Profile UX

Last updated: 2026-06-14

## What was built

- **`app/icon.svg`** — replaced hand-crafted purple dashboard icon with the official `jobpilot-icon.svg` (briefcase + magnifying glass, blue gradient `#1E3A8A` → `#2563EB`)
- **`components/layout/Navbar.tsx`** — logo changed from `/logo.png` to `/jobpilot-logo-horizontal.svg`
- **`components/layout/Footer.tsx`** — same logo swap
- **`app/globals.css`** — primary accent color changed from purple (`#7c5cfc`) to blue (`#2563EB`), dark variant `#1E3A8A`, light/muted updated to `#dbeafe` / `#eff6ff`; hero-gradient updated from pink/purple to blue tones
- **`components/profile/ProfileForm.tsx`** — sticky save footer got `shadow-[0_-4px_16px_rgba(0,0,0,0.08)]` so it lifts visually from content
- **`.github/workflows/deploy.yml`** — fixed CI auth: calls InsForge token exchange endpoint to get fresh `access_token`, writes complete `~/.insforge/credentials.json` (access_token + refresh_token + user object) + `.insforge/project.json` with project config, then runs `npx @insforge/cli@latest deployments deploy .` — **CI is now working (green)**

Earlier this session (carried forward from prior context):

- **`app/api/resume/generate/route.ts`** — streams PDF bytes directly (not URL); caches in private storage server-side
- **`components/profile/ProfileForm.tsx`** — blob download for resume, hydration fix for accordion Remove button (div wrapper + sibling buttons)
- **`app/api/resume/ResumePDF.tsx`** — name→title spacing (marginBottom 3→8), `wrap={false}` on role blocks
- **`middleware.ts`** + **`lib/insforge-server.ts`** — forward access token via `x-insforge-access-token` header to bypass cookie visibility issue in route handlers
- **`app/icon.svg`** (original) — SVG favicon (now replaced by jobpilot-icon above)
- **`README.md`** — full project README with stack, pages, env vars, deployment docs

## Decisions made

- **Blue as primary**: `#2563EB` is `--color-accent`, `#1E3A8A` is `--color-accent-dark`. Taken directly from official brand SVG gradients.
- **CI deploy auth**: exchange `INSFORGE_REFRESH_TOKEN` secret for fresh access token at run time, write full credentials JSON manually → bypasses browser OAuth. `INSFORGE_PROJECT_API_KEY` secret provides project API key.
- **PDF delivery via stream, not URL**: resumes bucket is private. Server streams bytes through API route — browser never touches storage URLs.
- **Auth token forwarding via custom header**: Next.js route handlers don't see cookies set by middleware on the response. Custom request header is the reliable path.
- **`wrap={false}` on role blocks**: prevents page breaks mid-role in PDF.

## Problems solved

- **GitHub Actions browser OAuth loop**: CLI `requireAuth()` needs `credentials.access_token` in `~/.insforge/credentials.json`. Fixed by pre-populating with freshly exchanged token before deploy step.
- **AUTH_INVALID_CREDENTIALS on resume download**: private storage URL requires bearer token browser doesn't have. Fixed by streaming through API route.
- **Button-in-button hydration error**: accordion Remove button nested inside accordion toggle button. Fixed with div wrapper + sibling buttons.
- **Middleware cookie forwarding**: refreshed token on middleware response not visible in route handler `cookies()`. Fixed via custom request header.

## Current state

- App is live at https://8kj4iaqv.insforge.site
- CI deploy on push to `main` is working (last run: success)
- Brand colors are blue throughout (accent, nav active state, buttons, avatar background)
- Profile form sticky save bar has upward shadow
- Resume PDF generates and downloads correctly

## Next session starts with

No outstanding tasks. Check `context/build-plan.md` and `context/progress-tracker.md` for the next planned feature. Feature 21 (Scheduled Job Alert Emails) was previously identified as next.

## Open questions

- Cover letter `max_tokens: 800` may cut off with longer prompts — worth verifying
- react-pdf avatar clipping: `overflow: hidden` + `borderRadius` may not clip into circle in production
- Cover letter PDF photo: unconfirmed whether react-pdf fetches InsForge public URL during `renderToBuffer` in production
- InsForge SDK JSONB bug still affects any future RPC with JSONB params — document in `context/library-docs.md`
- Feature 13 company research ~60-120s may timeout on Vercel free tier — address if needed
