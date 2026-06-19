# Memory — User Approval Gate + Admin Panel + README

Last updated: 2026-06-19

## What was built

### README
- Fully updated `README.md` to reflect current app state: added `/pending` and `/admin` pages, Resend to stack table, all new env vars, user approval flow as a key flow, admin setup SQL snippet, and production notes about cookie lifetime and Resend sender domain
- README is now a living document — must be updated before every commit

### User Approval System (complete)
**Database (live on InsForge):**
- Added columns to `profiles`: `approval_status text NOT NULL DEFAULT 'pending'` (pending/approved/rejected), `is_admin boolean NOT NULL DEFAULT false`, `welcomed_at timestamptz`
- Set `friis1978@gmail.com` as `approval_status = 'approved'` and `is_admin = true`
- Added index on `approval_status`
- Added `SECURITY DEFINER` function `current_user_is_admin()` + two RLS policies: `admin_select_all_profiles` and `admin_update_profiles`

**New files:**
- `lib/resend.ts` — Resend client + 3 email functions: `sendPendingEmail`, `sendApprovedEmail`, `sendAdminNotificationEmail`. Non-fatal. FROM from `RESEND_FROM_EMAIL` env var.
- `app/pending/page.tsx` + `app/pending/LogoutButton.tsx` — pending approval page
- `app/admin/page.tsx` — admin panel server component, double-checks `is_admin` server-side
- `components/admin/AdminUsersTable.tsx` — Approve/Reject table with loading states and toasts
- `app/api/admin/approve/route.ts` — approves user + sends email
- `app/api/admin/reject/route.ts` — rejects user

**Modified files:**
- `proxy.ts` — `jp_approved` check on protected routes, `jp_admin` check on `/admin`, `/admin/:path*` in matcher
- `app/auth/callback/route.ts` — creates temp client with `data.accessToken` (not `createInsforgeServer()` — cookies not set yet), first-login detection via `welcomed_at === null`, sends emails only if `approval_status = 'pending'`, sets `jp_approved`/`jp_admin` httpOnly cookies, redirects to `/pending` or `/dashboard`
- `app/api/auth/logout/route.ts` — clears `jp_approved` and `jp_admin` on logout
- `types/index.ts` — added `approval_status`, `is_admin`, `welcomed_at` to `Profile`
- `.env.local` — added `RESEND_API_KEY`, `ADMIN_EMAIL=friis1978@gmail.com`, `RESEND_FROM_EMAIL=noreply@bandfolio.ai`, `NEXT_PUBLIC_APP_URL=https://findjob.insforge.site`
- `components/layout/Navbar.tsx` — added `isAdmin?: boolean` prop; Admin nav link shown conditionally
- `app/dashboard/page.tsx`, `app/find-jobs/page.tsx`, `app/find-jobs/[id]/page.tsx`, `app/profile/page.tsx`, `app/admin/page.tsx` — all pass `isAdmin` to Navbar; profile selects include `is_admin`; admin page uses `callerProfile.avatar_url` for avatar

## Decisions made

- **No service key client** — RLS policies with `SECURITY DEFINER` function instead. Admin routes use `createInsforgeServer()` (admin user's token), RLS handles access.
- **Cookie-based gate in proxy** — `jp_approved` and `jp_admin` are httpOnly cookies set in callback, checked by proxy on every request. No DB call in proxy. Trade-off: revoked users keep access for up to 7 days.
- **Temp client in callback** — `createInsforgeServer()` can't be used in callback because auth cookies aren't set yet at that point. Solution: `createServerClient` directly with `data.accessToken`.
- **First-login emails only when pending** — `welcomed_at === null` triggers first-login flow, but pending emails only send if `approval_status = 'pending'`. Approved users (like Rasmus) just get `welcomed_at` set, no emails.
- **FROM email** — `noreply@bandfolio.ai`. Must be verified in Resend dashboard before emails deliver.
- **README updated on every commit** — standing rule going forward.

## Problems solved

- **Service key bypass** — InsForge `api_key` format (`ik_...`) is not a JWT, can't be used as `accessToken`. Solved with `SECURITY DEFINER` RLS policies.
- **Callback can't use createInsforgeServer()** — cookies not set yet at callback time. Solved with one-off `createServerClient` using `data.accessToken`.
- **Admin link missing from navbar** — added `isAdmin` prop to Navbar, all pages pass it from profile.
- **Admin page not using profile avatar** — was using OAuth metadata only; fixed to prefer `callerProfile.avatar_url`.
- **Emails not arriving** — env vars only in `.env.local`, not deployed. `onboarding@resend.dev` only delivers to Resend account owner. User switched to `noreply@bandfolio.ai`.

## Current state

- Approval system fully implemented and DB migration is live
- Rasmus is approved + admin, sees Admin link in navbar on all pages
- `/admin` shows all users with Approve/Reject buttons
- Emails NOT yet working in production — env vars need to be added to InsForge deployment settings
- `bandfolio.ai` domain needs to be verified in Resend dashboard (resend.com/domains)
- README is up to date

## Next session starts with

1. Add env vars to InsForge deployment: `RESEND_API_KEY`, `ADMIN_EMAIL`, `RESEND_FROM_EMAIL=noreply@bandfolio.ai`, `NEXT_PUBLIC_APP_URL=https://findjob.insforge.site`
2. Verify `bandfolio.ai` in Resend dashboard
3. Test full flow with a second Google/GitHub account — should land on `/pending`, trigger emails

## Open questions

- Should rejected users see a different message than pending users on `/pending`?
- Should the Admin nav link show a badge count for pending users?
- Should the resume PDF show all education entries or just the most recent? (carried from previous session)
