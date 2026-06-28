# Memory — Design System Re-sync + Features Padding Fix

Last updated: 2026-06-28

## What was built

- **`components/homepage/Features.tsx`** — added `py-12` to the outer `<section>` (from design handoff `design_handoff_features_padding/README.md` in the Claude Design project). Provides vertical padding for standalone preview framing; does not change full homepage behaviour (Hero's `pt-5` already provides the top gutter there).
- **`.design-sync/conventions.md`** (new) — conventions header for the Claude Design agent. Documents: no provider wrapper needed, full token vocabulary (`bg-background`, `bg-surface`, `bg-surface-muted`, `bg-accent`, `bg-accent-dark`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-border`, etc.), font setup (Inter via Google Fonts at runtime, `runtimeFontPrefixes`), and an idiomatic build snippet using Navbar + StatsBar + JobsTable.
- **`.design-sync/config.json`** — added `"readmeHeader": ".design-sync/conventions.md"` so conventions are prepended to the generated README in every bundle build.
- **`.design-sync/NOTES.md`** — added notes on: malformed-anchor warning (expected when scriptsSha changes between script versions), conventions.md authoring, Features py-12 decision, and "Known render warns: none".
- **Full re-upload to Claude Design project** — 173 files, all 33 components, validate clean, 33/33 renders pass. Project: https://claude.ai/design/p/c9a905c8-87c3-49bf-bae7-c24aa30994de

## Decisions made

- **`py-12` not `py-6`** for Features padding — matches the generous interior rhythm of the inner content block (`py-12`/`lg:py-20` in the right column). `HowItWorks` and `Testimonial` are also candidates for the same fix if standalone framing matters for those.
- **Design agent artifacts left untouched** — the design project contains `design_handoff_features_padding/`, `templates/`, `screenshots/`, `uploads/`, `images/`, and SVGs. These are not sync artifacts and are excluded from all `deletePaths`; they persist across re-syncs.
- **Conventions header scope** — kept to ~2.5k characters. Token table names real classes verified against `ds-bundle/_ds_bundle.css`. Do not expand without re-verifying each name against the built CSS.

## Problems solved

- **Remote anchor malformed on re-sync** — when bundled scripts update between syncs, the `scriptsSha` in the uploaded `_ds_sync.json` won't match. Driver logs `! remote sidecar malformed — treating as no anchor` and falls back to full scope. This is expected and harmless — all grades carry forward from `.design-sync/.cache/` and the full upload is idempotent.
- **SVG logos** — `jobpilot-icon.svg`, `jobpilot-logo-horizontal.svg`, `jobpilot-logo-stacked.svg` ARE in the project (confirmed by `list_files`) and are NOT re-uploaded on re-sync. The `next-image-mock.mjs` rewrites `/`-prefixed paths to `../../../`-relative. If logos still don't show, check browser console for 404s.

## Current state

- **33 components** uploaded and validated. All render cleanly. All grades "good".
- **conventions.md** live in the project (stitched into README at build time).
- **Features.tsx** has `py-12` on the outer section — **not yet committed**.
- **`.design-sync/config.json`**, **`.design-sync/conventions.md`**, **`.design-sync/NOTES.md`** updated locally — **not yet committed**.
- **`app/api/jobs/[id]/cover-letter-advice/route.ts`** was modified before this session (unrelated to sync) — still uncommitted.

## Next session starts with

**Commit the durable sync files:**
```
git add components/homepage/Features.tsx \
        .design-sync/config.json \
        .design-sync/conventions.md \
        .design-sync/NOTES.md
```
Commit message: "feat: apply Features section padding fix and add design system conventions header"

Also decide whether to commit `app/api/jobs/[id]/cover-letter-advice/route.ts` (separate commit — check what changed there first).

## Open questions

- Should `HowItWorks` and `Testimonial` also get `py-12`? Design handoff says yes if standalone framing matters (they also lack vertical padding on the outer section). User applied only `Features` this session.
- SVG logos — are they rendering in Navbar and Footer in the design project? The Image mock path-rewrite fix was shipped in the previous session. User confirmed the SVGs are in the project but didn't confirm they're rendering after the hard refresh.
- `app/api/jobs/[id]/cover-letter-advice/route.ts` — what was changed there? Review before committing.
- Emails not working in production (env vars + Resend `bandfolio.ai` verification needed — carried forward from June 25 session).
