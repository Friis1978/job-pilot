# Memory — Avatar in Navbar, Role Validation, Add Role UX

Last updated: 2026-06-13

## What was built

### Navbar avatar — profile photo preferred over OAuth avatar (all pages)
- `app/profile/page.tsx`: `avatarUrl: profile?.avatar_url ?? authData.user?.user_metadata?.avatar_url`
- `app/find-jobs/[id]/page.tsx`: already had `profileData?.avatar_url` from DB query — Navbar updated to use it with OAuth fallback
- `app/dashboard/page.tsx`: added 8th query to `Promise.allSettled` — `profiles.select("avatar_url").eq("id", user.id).maybeSingle()` — used in Navbar
- `app/find-jobs/page.tsx`: added 3rd query to `Promise.allSettled` — same pattern — used in Navbar

### next.config.ts — InsForge image hostname
- Added `images.remotePatterns` with `{ protocol: "https", hostname: "**.insforge.app" }` to allow `next/image` to load profile avatars from InsForge storage
- Required restart of dev server to take effect

### components/profile/ProfileForm.tsx — Add Role scroll-to-view
- Added `workExperienceEndRef` and `shouldScrollToRole` state
- `addRole` now uses functional state update (`setData(prev => ...)` instead of `setField(...)`) to avoid stale closure
- After adding a role, `setShouldScrollToRole(true)` triggers a `useEffect` that calls `scrollIntoView({ behavior: "smooth", block: "start" })` on the last role card
- Prevents user from clicking "Add role" multiple times because the new card is off-screen

### components/profile/ProfileForm.tsx — Work experience validation
- Added `roleErrors: Record<string, Set<string>>` state — maps role id → set of invalid field names
- Added `firstErrorRoleRef` to scroll to first invalid role on failed save
- Required fields: `company`, `title`, `startDate`, `endDate` (unless `currentlyWorking`)
- On save attempt: validates all roles, blocks save, scrolls to first error role
- Role card border turns `border-error` (red) when that role has errors
- Individual inputs get `border-error focus:ring-error focus:border-error` when their field is invalid
- Labels show `*` asterisk on required fields; End Date asterisk hidden when `currentlyWorking` is checked
- Errors clear field-by-field as user fills them in (inline `setRoleErrors` in each onChange)
- Checking "Currently working here" clears the `endDate` error for that role
- **Missing fields panel** above Save button: appears after failed save, lists "Role N — Field Name" for every missing field, disappears as user fixes things

## Decisions made

- **Functional state update in addRole**: `setData(prev => ...)` instead of spreading current `data` — avoids potential stale closure if React batches updates
- **Validation at save time only**: no live validation on blur — errors only appear after user attempts to save. Fields clear errors as they are filled.
- **Missing fields panel replaces toast**: cleaner than a toast for multiple missing fields. Panel persists until all errors are fixed.

## Problems solved

- **next/image blocked InsForge storage URLs**: Next.js requires explicit hostname config for `next/image`. Fixed with wildcard `**.insforge.app` pattern.
- **"Add role" appeared broken**: Button was working but new role appeared at the bottom of a long list, off-screen. User kept clicking, creating multiple empty roles. Fixed with scroll-to-new-role behavior.
- **Multiple empty roles accumulating**: Consequence of the above. Now visually resolved.

## Current state

- All four pages use `profile.avatar_url` (preferred) with OAuth avatar as fallback in the Navbar
- InsForge storage images load correctly via `next/image`
- Work experience "Add role" scrolls the new card into view
- Save validation: highlights missing required fields, shows panel listing what's missing, blocks save until complete

## Next session starts with

Check `context/build-plan.md` and `context/progress-tracker.md` to identify the next planned feature. Feature 21 (Scheduled Job Alert Emails) is next — Resend for email, cron endpoint at `/api/cron/job-alerts` protected by `CRON_SECRET`. Or continue with user-directed fixes.

## Open questions

- Cover letter PDF photo: unconfirmed whether react-pdf successfully fetches the public InsForge URL during `renderToBuffer` in production (was fixed this way but not verified in prod).
- `overflow: hidden` + `borderRadius` on react-pdf `View` may not clip avatar into a circle — known react-pdf limitation. If it appears square in the PDF, that is expected.
- InsForge SDK JSONB bug still affects any future RPC with JSONB params — document in `context/library-docs.md`.
- Feature 13 company research ~60-120s — will timeout on Vercel free tier. Address at deployment.
