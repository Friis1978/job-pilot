# Design Sync Notes

## Re-sync risks and gotchas

### Private Next.js app — symlink required
The converter expects `node_modules/<pkg>/package.json`. This is a private app (not published to npm).
Fix: `ln -sfn /Users/rfh/Documents/GitHub/job-pilot node_modules/job_pilot`
Also: `ln -sfn ../.ds-sync/node_modules .design-sync/node_modules` (for the override bundle.mjs to resolve esbuild)

### Tailwind v4 CSS — compile before build
`app/globals.css` uses `@import "tailwindcss"` + `@theme {}` (v4 syntax). Must compile to static CSS first:
```
npx @tailwindcss/cli@4 -i app/globals.css -o .design-sync/compiled.css
```
The compiled.css has a Google Fonts `@import` prepended manually — preserve it on re-compile:
```
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
```

### process.* polyfill (bundle.mjs override)
The IIFE bundle crashes without a `process` shim. recharts, the InsForge SDK, and other deps reference
`process.platform`, `process.nextTick`, `process.stdout` etc. at module load time. These are polyfilled
via a `banner.js` inject in `.design-sync/overrides/bundle.mjs`. The esbuild `define` option cannot
handle function values so the banner approach is required.

### InsForge SDK init at module load
`lib/insforge-client.ts` calls `createBrowserClient()` immediately. It reads `process.env.NEXT_PUBLIC_INSFORGE_*`
at bundle time. Both env vars are baked into the bundle via `define` in the override — update them if
the InsForge project URL or anon key changes.

### Next.js routing hooks in previews
`useRouter()`, `usePathname()`, `useParams()`, `useSearchParams()` throw without the Next.js App Router
context. Solved with mock modules aliased via esbuild in the bundle.mjs override:
- `.design-sync/next-navigation-mock.mjs` → aliased as `next/navigation`
- `.design-sync/next-link-mock.mjs` → aliased as `next/link`
- `.design-sync/next-image-mock.mjs` → aliased as `next/image`

### Anchor malformed warning on re-sync
When the bundled scripts update between syncs, the `scriptsSha` in the remote `_ds_sync.json` won't match the current scripts. The driver logs `! remote sidecar malformed — treating as no anchor` and falls back to full scope (33 components "added"). This is expected — all grades carry forward from the `.cache/` and the full upload is idempotent.

### conventions.md
`.design-sync/conventions.md` was authored in the June 2026 re-sync and wired via `readmeHeader` in config. On future re-syncs, validate it: every class/token enumerated must still exist in `ds-bundle/_ds_bundle.css` and the component folders.

### Features section py-12 (applied June 2026)
`components/homepage/Features.tsx` — outer `<section>` got `py-12` added. Design handoff (`design_handoff_features_padding/README.md` in the project) notes this is cosmetic for standalone preview framing; Hero already provides the top gutter in the full homepage stack. `HowItWorks` and `Testimonial` are similar candidates if standalone framing matters there too.

### Known render warns
(none recorded — all 33 previews pass clean with zero bad/thin/overflow flags after the June 2026 sync)

### build command
```
node .ds-sync/package-build.mjs \
  --config .design-sync/config.json \
  --node-modules ./node_modules \
  --out ./ds-bundle
```

### validate command
```
node .ds-sync/package-validate.mjs ./ds-bundle
```
