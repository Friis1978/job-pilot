# Memory — TypeScript Error Cleanup

Last updated: 2026-06-14

## What was built

### TypeScript errors fixed — zero errors remain (`npx tsc --noEmit` clean)

**app/dashboard/page.tsx**
- Added `import { redirect } from "next/navigation"`
- Added null guard: `if (!user) redirect("/")` after `getCurrentUser()`
- Added `const userMeta = user.metadata as { full_name?: string; name?: string; avatar_url?: string } | null`
- Replaced all `user.user_metadata?.*` with `userMeta?.*` in Navbar prop

**app/find-jobs/page.tsx**
- Same pattern: redirect import, null guard, userMeta helper, Navbar fix

**app/find-jobs/[id]/page.tsx**
- Added `redirect` to existing `next/navigation` import alongside `notFound`
- Same pattern: null guard, userMeta helper, Navbar fix

**app/profile/page.tsx**
- Added `const userMeta = (authData.user?.metadata ?? null) as { full_name?: string; name?: string; avatar_url?: string } | null`
- Replaced `authData.user?.user_metadata?.*` with `userMeta?.*` in Navbar prop

**components/profile/ProfileForm.tsx**
- Removed third argument from `insforge.storage.from("avatars").upload(path, blob)` — SDK only accepts 2 args

## Decisions made

- **InsForge user type uses `metadata` not `user_metadata`**: The InsForge SDK user object has `metadata: Record<string, unknown> | null`, not `user_metadata`. All pages that read OAuth name/avatar from the user object must cast: `user.metadata as { full_name?: string; name?: string; avatar_url?: string } | null`.
- **Null guard pattern for authenticated pages**: All server-side pages that use `user.id` directly add `if (!user) redirect("/")` immediately after `getCurrentUser()`. This narrows the type and removes TS18047 errors.
- **InsForge storage.upload is 2-arg only**: No options/metadata object as third argument.

## Problems solved

- **TS2339 `user_metadata` does not exist**: InsForge SDK changed from Supabase-style `user_metadata` to `metadata`. Fixed by casting `user.metadata` to the expected shape.
- **TS18047 `user` is possibly null**: Pages used `user.id` without null check. Fixed with redirect guard.
- **TS2554 Expected 2 arguments, got 3**: InsForge `storage.upload()` doesn't accept options object. Removed it.

## Current state

- TypeScript compiles clean — zero errors
- All authenticated pages (dashboard, find-jobs, find-jobs/[id], profile) correctly handle null user and correctly read OAuth metadata

## Next session starts with

Check `context/build-plan.md` and `context/progress-tracker.md` for next planned feature. Feature 21 (Scheduled Job Alert Emails) is next — Resend for email, cron endpoint at `/api/cron/job-alerts` protected by `CRON_SECRET`.

## Open questions

- Cover letter `max_tokens: 800` may cut off with longer prompts (full work history now in prompt) — worth verifying
- react-pdf avatar clipping limitation: `overflow: hidden` + `borderRadius` may not clip into a circle
- Cover letter PDF photo: unconfirmed whether react-pdf successfully fetches the public InsForge URL during `renderToBuffer` in production
- InsForge SDK JSONB bug still affects any future RPC with JSONB params — document in `context/library-docs.md`
- Feature 13 company research ~60-120s will timeout on Vercel free tier — address at deployment
