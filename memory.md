# Memory — Feature 04 Database Schema (complete)

Last updated: 2026-06-09

## What was built

**Feature 04 — Database Schema (completed this session)**

All four tables created in InsForge via `run-raw-sql` MCP tool:

- `profiles` — full column set from architecture.md. `id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`. Includes `updated_at` trigger (auto-updates on every row change) and `on_auth_user_created` trigger on `auth.users` INSERT (auto-creates a profiles row for every new user).
- `agent_runs` — `user_id uuid REFERENCES profiles(id) ON DELETE CASCADE`
- `jobs` — `user_id uuid REFERENCES profiles(id) ON DELETE CASCADE`, `run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL` (run_id is nullable per architecture)
- `agent_logs` — `user_id uuid REFERENCES profiles(id) ON DELETE CASCADE`, `run_id uuid REFERENCES agent_runs(id) ON DELETE CASCADE`, `job_id uuid REFERENCES jobs(id) ON DELETE SET NULL`

RLS enabled on all four tables. SELECT/INSERT/UPDATE/DELETE all scoped to `auth.uid()` (using `id` for profiles, `user_id` for others).

Storage bucket `resumes` created (private, `isPublic: false`) via `create-bucket` MCP tool. Storage RLS policies scoped to `resumes/{user_id}/...` using `split_part(key, '/', 1)`.

**Also fixed this session:**
- `context/code-standards.md` — PostHog events table updated from 4 to 8 events. Added: `oauth_login_clicked`, `user_signed_in`, `auth_failed`, `user_signed_out`.
- `context/progress-tracker.md` — Feature 04 marked complete, next set to Feature 05.

## Decisions made

- **profiles.id = auth user UUID** — `profiles.id` is the auth user's UUID (same as `auth.uid()`), not a generated ID. Other tables use `user_id` as FK to `profiles.id`.
- **DB trigger auto-creates profile row** — `on_auth_user_created` trigger fires on `auth.users` INSERT. Every authenticated user always has a profiles row. Features 05+ can assume non-null profile exists.
- **updated_at is trigger-managed** — DB trigger auto-sets `updated_at = NOW()` on every profiles UPDATE. Server Actions do not need to pass a timestamp.
- **Cascade deletes throughout** — profiles cascades from auth.users; agent_runs, jobs, agent_logs all cascade from profiles. Deleting an auth user removes all their data.
- **jobs.run_id uses SET NULL** — not cascade, because run_id is nullable (jobs can come from URL input with no associated agent run).
- **InsForge storage schema** — NOT Supabase-compatible for storage. Uses `bucket` (not `bucket_id`) and `key` (not `name`) columns on `storage.objects`. Storage RLS uses `split_part(key, '/', 1)` to extract user_id from path.

## Problems solved

- **InsForge storage.objects column names differ from Supabase** — `bucket_id` → `bucket`, `name` → `key`. Discovered when first storage policy attempt failed. Fixed using `split_part(key, '/', 1)` for path-based RLS.

## Current state

- Feature 01 Homepage: **complete**
- Feature 02 Auth: **complete** — OAuth end-to-end, middleware protecting routes
- Feature 03 PostHog: **complete** — browser init, server client, EU reverse proxy, user identify/reset
- Feature 04 Database Schema: **complete** — all tables, triggers, RLS, storage bucket
- Phase 1 Foundation: **complete**
- InsForge DB now has: `profiles`, `agent_runs`, `jobs`, `agent_logs` tables + `resumes` bucket
- No application code touches the DB yet — that starts in Feature 06

## Next session starts with

**Feature 05 — Profile Page Full UI.**

Build the complete profile page UI with mock data. No save logic yet. Full spec in `context/build-plan.md` under "05 Profile Page — Full UI":
- Profile needs attention banner (completion % ring, missing field tags)
- Resume upload section (drag and drop)
- Profile Information form (5 sections: Personal, Professional, Work Experience, Education, Job Preferences)
- Save Profile button

Run `/architect` first before building, per project rules.

## Open questions

- GitHub OAuth not yet verified in a real browser (only Google tested end-to-end)
- Does the InsForge direct OAuth exchange endpoint path (`/api/auth/oauth/exchange`) need verification against production?
- Should `PostHogIdentitySync` be removed from public pages to avoid unnecessary network calls?
- PostHog dashboard still needs to be created once MCP auth is completed
- `updated_at` trigger was only added to `profiles` — if `agent_runs` or `jobs` ever need auto-updating timestamps, triggers would need to be added then
