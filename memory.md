# Memory — Feature 06 Profile Save Logic (complete)

Last updated: 2026-06-09

## What was built

**Feature 06 — Profile Save Logic (completed this session)**

New files created:

- `types/index.ts` — `WorkExperience`, `Education`, `Profile` (mirrors DB snake_case columns), `ProfileFormInput` (form camelCase fields)
- `actions/profile.ts` — two Server Actions:
  - `saveProfile(input)` — maps form camelCase→DB snake_case, splits comma strings to arrays, composes education jsonb, strips React `id` from work experience, calculates `is_complete` from 11 fields, checks if row exists first then does `update()` or `insert()` (InsForge has no upsert), calls `revalidatePath('/profile')`
  - `updateResumeUrl(url)` — single-column update, called after storage upload

Modified files:

- `app/profile/page.tsx` — now async Server Component; fetches profile via `createInsforgeServer()`, computes `completionPercentage` + `missingFields` server-side, passes to all child components; added `key={profile?.updated_at ?? "empty"}` on `<ProfileForm>` to force remount after save
- `components/profile/ProfileForm.tsx` — accepts `initialData?: Profile | null`; `profileToFormData()` maps DB→form; state initialized via `useState(() => profileToFormData(initialData))`; real `onSubmit` calls `saveProfile()`, shows saving/error/success states
- `components/profile/ResumeUpload.tsx` — accepts `initialResumeUrl`; on file select: gets userId via `insforge.auth.getCurrentUser()`, deletes existing file at `${userId}/resume.pdf`, uploads, calls `updateResumeUrl(data.url)`
- `context/progress-tracker.md` — Feature 06 marked complete, next = Feature 07

Also added this session:

- `components/profile/ConnectedAccounts.tsx` — Client component showing LinkedIn "Connect" UI (LinkedIn logo SVG, `bg-linkedin` token, connect button). OAuth flow is a future feature — button is a no-op.

## Decisions made

- **No upsert in InsForge SDK** — only `insert()`, `update()`, `delete()`, `select()`. `saveProfile` selects first to check row existence, then branches to update or insert.
- **Server-side pre-fill** — `app/profile/page.tsx` fetches profile as async Server Component. No loading states, no client-side fetch.
- **`key={profile?.updated_at}` on ProfileForm** — forces component remount after save so `useState` re-initializes from fresh `initialData`. Without this, React keeps the component alive and the lazy initializer doesn't re-run.
- **InsForge storage auto-renames files** — must `remove()` before `upload()` to maintain consistent path. ResumeUpload deletes existing `${userId}/resume.pdf` first.
- **`insforge.database` not `insforge.db`** — confirmed from TypeScript declarations.

## Problems solved

- **Profiles table empty despite trigger** — `on_auth_user_created` trigger only fires for new signups. The existing users (`friis1978@gmail.com` and anonymous) were created before the trigger was set up in Feature 04. Backfilled both rows with direct SQL. `saveProfile` now also handles missing rows via insert fallback — resilient for any future edge cases.
- **Silent save failure** — `update().eq('id', userId)` on a missing row updates 0 rows, returns no error, but data is never saved. Fixed by the check-then-insert/update pattern.
- **InsForge storage RLS** — uses `bucket`/`key` columns (not Supabase's `bucket_id`/`name`). Storage RLS policies must use `split_part(key, '/', 1)` to extract user_id path segment.
- **`useState` lazy initializer stale** — after `revalidatePath` triggers server re-render, React keeps ProfileForm mounted and `useState(() => ...)` doesn't re-run. Fixed with `key` prop on `<ProfileForm>` in page.

## Current state

- Phase 1 Foundation: **complete** (01–04)
- Feature 05 Profile Page UI: **complete**
- Feature 06 Profile Save Logic: **complete** — form saves, pre-fills on reload, completion ring is real, resume upload to InsForge Storage works
- ConnectedAccounts card shown (LinkedIn connect button is a no-op — OAuth flow future feature)
- No shadcn/ui installed — all UI is plain Tailwind

## Next session starts with

**Feature 07 — AI Profile Extraction from Resume.**

Run `/architect feature 07` first per project rules, then implement.

Reference: `context/build-plan.md` under "07 AI Profile Extraction from Resume" for full spec.

## Open questions

- None.
