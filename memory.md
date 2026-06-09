# Memory — MCP Playwright Setup

Last updated: 2026-06-09

## What was built

- Added Playwright MCP server (`@playwright/mcp@latest`) to Claude Code config for this project
- Removed the deprecated Puppeteer MCP entry that was already present in `~/.claude.json`

## Decisions made

- Chose `@playwright/mcp` (Microsoft, actively maintained) over `@modelcontextprotocol/server-puppeteer` (deprecated as of 2025)
- MCP servers are configured via `claude mcp add` CLI command, which writes to `~/.claude.json` under the project key — NOT in `settings.json` (that file doesn't support `mcpServers`)

## Problems solved

- Attempted to add `mcpServers` to `~/.claude/settings.json` — rejected by schema validation. Correct method is `claude mcp add` command.

## Current state

- Playwright MCP is configured in `~/.claude.json` under project `/Users/rfh/Documents/GitHub/job-pilot`
- Puppeteer MCP entry removed
- Claude Code restarted — Playwright MCP should now be active (look for `mcp__playwright__*` in deferred tools)

## Next session starts with

Verify Playwright MCP tools are available. If not, run `! claude mcp list` to debug.

## Open questions

- Whether Playwright MCP should be added globally (all projects) rather than just this project

---

# Memory — Homepage Polish

Last updated: 2026-06-09

## What was built

Landing page QA and visual polish pass. No new components created — only existing homepage components modified.

**Files modified:**
- `components/layout/Navbar.tsx` — mobile-first responsive layout (flex-wrap, order-based nav stacking, text-xs sm:text-sm scaling)
- `components/layout/Footer.tsx` — same responsive treatment as navbar, fixed "Terms & Condition" → "Terms & Conditions"
- `components/homepage/Hero.tsx` — responsive headline (text-3xl sm:text-5xl), stacked CTAs on mobile (flex-col sm:flex-row, w-full sm:w-auto), dashboard image container uses bg-surface-muted, removed all borders
- `components/homepage/HowItWorks.tsx` — split-panel layout: outer section bg-surface-muted, left column is full-bleed white card (bg-surface fills grid cell edge-to-edge, no padding on outer container), right column is image centered in muted canvas, removed image wrapper border, grid-cols-1 lg:grid-cols-2
- `components/homepage/Features.tsx` — same split-panel layout, left column muted canvas with image, right column full-bleed white card, feature list items now use pl-4 border-l-2 accent pattern (border-accent on index 1 "AI-Powered Job Matching"), removed all borders
- `components/homepage/Testimonial.tsx` — replaced inline style={{ fontSize, lineHeight }} with utility classes (text-2xl leading-[1.45]), removed border
- `components/homepage/BottomCTA.tsx` — responsive spacing and stacked CTAs, removed border from secondary button
- `public/images/agent-log.png` — renamed from agnet-log.png (typo fixed)
- `context/ui-registry.md` — updated patterns for all modified components
- `context/progress-tracker.md` — logged all decisions made

## Decisions made

- **Split-panel layout:** HowItWorks and Features use `overflow-hidden` on the outer container + `items-stretch` grid so the white card column fills 100% height edge-to-edge. No padding on the outer section wrapper — padding lives inside each column div.
- **Section backgrounds:** Hero gradient card + BottomCTA use `hero-gradient`. Dashboard image, HowItWorks, and Features outer panels use `bg-surface-muted`. White text columns use `bg-surface`. Testimonial uses `bg-surface`.
- **No borders on any landing page section** — all `border border-border` removed from section cards, image containers, and CTA secondary buttons.
- **Accent left border:** First feature item in HowItWorks (index 0) uses `border-accent`. "AI-Powered Job Matching" in Features (index 1) uses `border-accent`. All others use `border-border`.
- **Mobile nav:** Uses `flex-wrap` + CSS `order` to push nav links below logo/CTA on small screens without any JS/state. No hamburger menu — nav links stay visible, just stacked.

## Problems solved

- Horizontal overflow on mobile (390px) was caused by fixed 2-column grids — fixed with grid-cols-1 lg:grid-cols-2.
- `max-w-[1440px]` flagged by linter → replaced with `max-w-360`.
- `sm:order-none` flagged by linter → replaced with `sm:order-0`.
- Asset typo `agnet-log.png` caused no 404 (Next.js image optimizer was masking it) but was inconsistent — renamed the file and updated the src reference.

## Current state

Homepage is complete and polished. All sections render correctly at mobile (390px) and desktop. No compile or lint errors. No horizontal overflow. Split-panel sections match the provided design mockup. All context/progress docs are up to date.

**Next phase per build plan:** 02 Auth — InsForge authentication with Google and GitHub OAuth.

## Next session starts with

Build the login page (`app/(auth)/login/page.tsx`) with Google OAuth and GitHub OAuth buttons wired to InsForge. Then create the OAuth callback handler (`app/(auth)/callback/page.tsx`) and middleware protecting `/dashboard`, `/profile`, `/find-jobs`, `/find-jobs/[id]`. After login → redirect to `/dashboard`.

Read `context/library-docs.md` InsForge section and check AGENTS.md for an installed InsForge skill before writing any auth code.

## Open questions

- None. Homepage is signed off. Ready to move to 02 Auth.
