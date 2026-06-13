# Memory — Job Import, Research, Cover Letter, Spinners

Last updated: 2026-06-13

## What was built

### agent/research-company.ts — save fix + warning + contact page fix
- **Save fix**: `insforge.database.rpc()` silently drops JSONB params. Replaced with `insforge.getHttpClient().post("/api/database/rpc/update_job_research", { p_job_id, p_user_id, p_research: JSON.stringify(dossier) })`.
- **Warning return**: After save, checks `dossier.contactInfo` and `dossier.companyAddress`. If either is missing, returns `{ success: true, warning: "..." }`.
- **Contact page scraping fix**: When `link.kind === "contact"`, uses a different Stagehand extract instruction specifically emphasising address extraction (not "Ignore footers/marketing" which caused AI to skip addresses).
- **Extra HTTP fallback paths**: Added `/kontakt-os`, `/kontaktoplysninger`, `/vi-er-her`, `/company/contact`.
- **`ResearchCompanyResult` type**: Extended with `warning?: string`.

### agent/import-job-from-url.ts — major refactor
- **LinkedIn SPA URL support**: `extractLinkedInJobId(url)` extracts job ID from `currentJobId` query param or `/jobs/view/{id}` path. Canonical URL always normalised to `https://www.linkedin.com/jobs/view/{id}/`.
- **LinkedIn guest API**: `fetchLinkedInJob(jobId)` calls `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{jobId}`. Pre-strips `<style>` and `<script>` tags before `stripHtml` (important — stripHtml doesn't strip their content, only tags).
- **Angular SSR / Next.js / Nuxt support**: `extractEmbeddedState(html)` extracts named framework state scripts (`ng-state`, `__NEXT_DATA__`, `__NUXT_DATA__`, `initial-state`). No catch-all — generic `application/json` scripts excluded (too likely to be analytics blobs).
- **Stagehand browser fallback**: `fetchWithBrowser(url)` uses Browserbase + Stagehand for pure client-side SPAs. Stores `sessionId` separately before Stagehand constructor to handle init failures — `REQUEST_RELEASE` sent in `finally` if Stagehand never initialised.
- **Three-stage pipeline**: static fetch → embedded state extraction → Stagehand render. Falls through to next stage only if `rawText.length < 200`.
- **GPT-4o extraction prompt**: Updated to parse JSON input (framework state blobs), bumped context to 6000 chars, extended location extraction rules.

### agent/generate-cover-letter.ts
- **OPENING_STRATEGIES**: Module-level array of 5 distinct opening strategies. One selected randomly per call via `Math.floor(Math.random() * OPENING_STRATEGIES.length)`.
- **Temperature**: 0.7 → 0.9 for more variety.
- **Banned phrases** in system prompt: "excited", "thrilled", "passion", "couldn't help", "perfect opportunity", "dream role", "long-time admirer", "ideal candidate". Never start with "I". No flattery openers. Confident CTA close.

### lib/toast.ts
- Added `"warning"` to type union: `type: "error" | "success" | "warning" = "error"`.

### components/ui/Toaster.tsx
- `ToastItem` type includes `"warning"`.
- Added `WarningIcon` SVG (filled triangle with exclamation).
- Warning toast: `bg-surface border-warning text-warning`.

### components/find-jobs/ResearchButton.tsx
- **Primary** (`hasResearch=false`): accent button, SearchIcon → SpinnerIcon while loading.
- **Re-run** (`hasResearch=true`): compact border button, RefreshIcon with `animate-spin` while loading.
- **Warning persistence**: `useEffect` on mount reads `sessionStorage.getItem(RESEARCH_WARNING_KEY)` and fires `toast(pending, "warning")`. Before `window.location.reload()` stores `sessionStorage.setItem(RESEARCH_WARNING_KEY, json.warning)`.

### components/find-jobs/TailoredResumeButton.tsx
- Added SpinnerIcon replacing DocumentIcon when `loading`.

### components/profile/ProfileForm.tsx
- Save button: `flex items-center justify-center gap-2` + inline SpinnerIcon while `saving`.

### app/api/agent/research/route.ts
- Returns `{ success: true, warning: result.warning ?? null }`.

### context/ui-registry.md — fully updated
- ResearchButton entry updated (two-state design, spinner pattern, sessionStorage warning).
- TailoredResumeButton entry added.
- Toaster entry added (three types, token classes).
- ProfileForm save button updated (inline spinner).
- **Standard spinner documented**: 24×24 SVG, faded circle + arc, `w-4 h-4 animate-spin`.

## Decisions made

- **InsForge SDK JSONB workaround**: `insforge.database.rpc()` and `.update()` both silently drop JSONB-typed parameters. Always use `insforge.getHttpClient().post("/api/database/rpc/{fn}", body)` for any RPC that takes JSONB. This is not a one-off — affects any future RPC with JSONB params.
- **Warning toast via sessionStorage**: `window.location.reload()` destroys React state. Cannot show a toast after reload. Pattern: store warning in sessionStorage before reload, read and clear in `useEffect` on mount. Established pattern for any post-reload notification.
- **SpinnerIcon is the standard loading indicator**: 24×24 SVG with faded circle + arc, `w-4 h-4 animate-spin`. Replace the action icon while loading, restore it when done. All buttons follow this pattern.
- **LinkedIn import**: Always normalise SPA collection/search URLs to canonical `/jobs/view/{id}/` for dedup and storage. Guest API is public (no auth required).
- **extractEmbeddedState catch-all removed**: Generic `type="application/json"` script extraction was dangerous (matches analytics blobs). Only named framework patterns retained.

## Problems solved

- **InsForge SDK silently drops JSONB**: Fixed by bypassing SDK entirely and using `getHttpClient().post()` to path `/api/database/rpc/{fn}`.
- **Warning toast destroyed by page reload**: Fixed with sessionStorage persistence pattern.
- **emagine Angular SSR**: `stripHtml` stripped `<script id="ng-state">` leaving only 117 chars. Fixed with `extractEmbeddedState()`.
- **Contact page ignoring addresses**: Stagehand "Ignore footers/marketing" prompt caused AI to skip addresses. Fixed with contact-page-specific prompt.
- **Browserbase session leak on Stagehand init failure**: Fixed by storing `sessionId` before Stagehand constructor, `REQUEST_RELEASE` in `finally`.
- **LinkedIn SPA URLs**: Collection/search URLs not previously handled. Fixed with `extractLinkedInJobId()`.
- **fetchLinkedInJob CSS pollution**: `stripHtml` doesn't strip `<style>/<script>` content. Fixed by pre-stripping those tags.

## Current state

All features from this session are complete, reviewed, and imprinted:
- Job import from LinkedIn (SPA + canonical URL) ✓
- Job import from Angular SSR portals (ng-state extraction) ✓
- Browser render fallback for pure SPAs (Stagehand/Browserbase) ✓
- Company research save (JSONB fix) ✓
- Warning toast when contact info / address not found ✓
- Warning persists across page reload via sessionStorage ✓
- Cover letter variety (5 strategies, temperature 0.9, banned phrases) ✓
- Spinner on every loading button ✓
- /review issues all fixed ✓
- /imprint complete ✓

## Next session starts with

Check `context/build-plan.md` and `context/progress-tracker.md` to identify the next planned feature. Feature 21 (Scheduled Job Alert Emails) is next on the plan — uses Resend for email, cron endpoint at `/api/cron/job-alerts` protected by `CRON_SECRET`. Or continue with user-directed UX polish.

## Open questions

- InsForge SDK JSONB bug affects any future RPC with JSONB params. Consider documenting in `context/library-docs.md`.
- Research quality depends on Stagehand reaching contact pages. No Stagehand fallback for research (only for job import). If a contact page is JS-heavy and the HTTP attempt fails, research may miss contact info.
- Feature 13 company research ~60-120s — will timeout on Vercel free tier. Address at deployment.
- Dashboard CompanyResearchChart is single child in 2-col grid — renders half-width on desktop. Consider col-span-2 or pairing with another card.
- next/image OAuth avatar URLs — may need remotePatterns in next.config.ts if broken images appear.
