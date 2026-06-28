# Memory — Custom Domain devjob.info Connected to InsForge

Last updated: 2026-06-28 19:15

## What was built

- **devjob.info** connected as the custom domain for the Job-pilot InsForge deployment (Vercel-backed). Domain ownership verified and DNS pointing to Vercel confirmed.
- No code files were modified this session.

## Decisions made

- **devjob.info is the production domain** — replaces the previous `findjob.insforge.site` slug. The `insforge.toml` already had `https://devjob.info` and `https://www.devjob.info` in `[auth] allowed_redirect_urls`.
- **Vercel apex domain uses `76.76.21.21`** — not the InsForge-provided A record (`216.150.16.1`, which was only for ownership verification). Root domain A record must be `76.76.21.21`; www uses CNAME `cname.vercel-dns.com`.

## Problems solved

- **GoDaddy locked A records** — When buying a domain on GoDaddy, they auto-attach a Website Builder/hosting product that locks two A records (`15.197.225.128`, `3.33.251.168`). These cannot be deleted until the GoDaddy product is disconnected/cancelled from the domain under My Products. After disconnecting, the locked records became deletable.
- **Two-step DNS process for InsForge custom domains**:
  1. InsForge gives you their own A record (`216.150.16.1`) — add this first to verify domain ownership.
  2. After ownership is verified, change the A record to Vercel's IP (`76.76.21.21`) for traffic routing.
  3. InsForge will then show the domain as fully verified.

## Current state

- **devjob.info** is verified and live — pointing to the Job-pilot InsForge deployment.
- `insforge.toml` has correct auth redirect URLs for `devjob.info` — but `npx @insforge/cli config apply` has **not been confirmed run yet**. Should be done next session if not already done.
- **Uncommitted files from previous session still pending:**
  - `components/homepage/Features.tsx` — `py-12` padding fix
  - `.design-sync/config.json`, `.design-sync/conventions.md`, `.design-sync/NOTES.md`
  - `app/api/jobs/[id]/cover-letter-advice/route.ts` — review before committing
- Design system: 33 components, all validated and uploaded to Claude Design project.

## Next session starts with

1. Run `npx @insforge/cli config apply` to push the `devjob.info` auth redirect URLs to the live backend.
2. Commit the pending design-sync files:
   ```
   git add components/homepage/Features.tsx \
           .design-sync/config.json \
           .design-sync/conventions.md \
           .design-sync/NOTES.md
   ```
   Commit message: "feat: apply Features section padding fix and add design system conventions header"
3. Review `app/api/jobs/[id]/cover-letter-advice/route.ts` and commit separately if needed.

## Open questions

- Has `npx @insforge/cli config apply` been run? The auth redirect URLs in `insforge.toml` need to be applied to the backend for `devjob.info` logins to work.
- Emails not working in production — Resend + sender domain verification still pending (carried forward from June 25 session). Now that `devjob.info` is the production domain, decide whether to verify a `devjob.info` sender address with Resend instead of `bandfolio.ai`.
- Should `HowItWorks` and `Testimonial` sections also get `py-12` outer padding for standalone design preview framing?
- SVG logos rendering in the Claude Design project — not confirmed after the path-rewrite fix.
