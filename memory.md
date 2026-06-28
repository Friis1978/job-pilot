# Memory — DeveloperJobs Rebrand + Image & Auth Fixes

Last updated: 2026-06-28 20:30

## What was built

- **Homepage images switched to WebP** — `Hero.tsx` → `onboarding-profile.webp`, `HowItWorks.tsx` → `onboarding-jobs.webp`, `Features.tsx` → `onboarding-research.webp`. WebP files live in `public/images/`. Old PNGs still present but no longer referenced.
- **InsForge auth redirect URLs fixed** — `insforge.toml` `allowed_redirect_urls` updated to include the full `/auth/callback` path for all domains AND `http://localhost:3000/auth/callback`. Config applied to live backend via `npx @insforge/cli config apply --auto-approve`.

## Decisions made

- **Use WebP for homepage preview images** — the PNG files were being served correctly by the server, but browser HTTP cache was stuck on old versions. Switching to WebP files gave new URLs that bypassed all cached responses. The PNGs (`onboarding-*.png`) are still in `public/images/` but unused.
- **`allowed_redirect_urls` must use exact `/auth/callback` paths** — InsForge does exact URL matching, not prefix matching. Having just `https://devjob.info` was not sufficient; `https://devjob.info/auth/callback` was required. Same applies to all environments including localhost.

## Problems solved

- **Homepage images not updating despite `rm -rf .next/cache/images`** — The Next.js server was regenerating correctly, but the browser's HTTP disk cache was serving stale `/_next/image` responses. Hard refresh (`Cmd+Shift+R`) was insufficient. Solved permanently by switching to new WebP filenames (new URLs bypass all caches).
- **Google OAuth failing on devjob.info and localhost** — `insforge.toml` had `https://devjob.info` without the path; the app sends `redirect_uri=https://devjob.info/auth/callback`. Fixed by adding full path to all allowed URLs and running config apply.

## Current state

- **devjob.info** — auth working, new DeveloperJobs branding live
- **localhost:3000** — auth working, homepage images now show correctly via WebP
- **Large uncommitted diff** — the full DeveloperJobs rebrand (logo swap, metadata, package name, component text) plus the WebP image swap and insforge.toml fix are all unstaged. Nothing has been committed this session.
- **Resend sender domain** — still not verified. Emails not working in production. Deferred from last session.

## Next session starts with

Commit all pending changes in one or two logical commits:
1. **Rebrand commit** — all `components/`, `app/`, `lib/`, `public/` logo/branding changes + `package.json` name + deleted `jobpilot-*.svg` + new `developerjobs-*.svg`
2. **Infra/images commit** — `insforge.toml` (auth redirect fix), `public/images/onboarding-*.webp` (new files), updated image references in `Hero.tsx`, `HowItWorks.tsx`, `Features.tsx`

## Open questions

- Should the old `onboarding-*.png` files be deleted from `public/images/` now that WebP versions are in use?
- Resend sender domain verification — decide whether to verify a `devjob.info` sender address with Resend so production emails work.
- The `[deployments] subdomain = "findjob"` in `insforge.toml` — should this be updated to `developerjobs` or similar?
