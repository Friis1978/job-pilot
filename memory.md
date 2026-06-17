# Memory — Profile Enrichment: What Drives You + Personal Projects

Last updated: 2026-06-17

## What was built

### jobviewtrack URL resolution (continued from last session)
- **`agent/find-jobs.ts`** — New `resolveTrackingUrl` function sends `Referer: https://www.careerjet.dk/` when following jobviewtrack URLs. Called before `enrichJobDescription`. If resolution succeeds, the employer URL replaces the tracking URL in the saved job. `AGGREGATOR_DOMAINS` moved to module level, shared by both functions.

### "What Drives You" profile section
New DB columns added to `profiles`: `motivation`, `proud_achievement`, `energy_tasks`, `company_type_preference` (text[]), `career_vision`

- **`types/index.ts`** — Added all 5 fields to `Profile` and `ProfileFormInput`
- **`actions/profile.ts`** — All 5 fields mapped and saved
- **`components/profile/ProfileForm.tsx`** — New `SectionAccordion` section "What Drives You" (between Job Preferences and Cover Letter Instructions):
  - Motivation (textarea)
  - Key Achievement (textarea)
  - What Gives You Energy (textarea)
  - Preferred Company Type (toggle pill multi-select: Startup, Scale-up, Established corporation, Agency/consultancy, Public sector, Non-profit)
  - Career Vision (textarea)
- **`agent/generate-cover-letter.ts`** — All 5 fields passed into candidate context; company type preference adds a rule to the system prompt

### Personal Projects section
New DB column: `personal_projects JSONB` on `profiles`

- **`types/index.ts`** — New `PersonalProject` type: `{ name, description, url?, skills[], startDate?, endDate?, currentlyWorking? }`. Added to `Profile` and `ProfileFormInput`
- **`actions/profile.ts`** — `personal_projects` saved as JSONB
- **`components/profile/ProfileForm.tsx`** — New "Personal Projects" section (between Work Experience and Education):
  - Per-project accordion (chevron toggle, opens by default when added)
  - Fields: Project Name, From (month), To (month) + "Still active" checkbox, Description, URL, Skills Used
  - Skills use chip UI with "from your profile" suggestions; rendered in accent color
  - Accordion header shows name + date range
- **`lib/utils.ts`** — `computeSkillYears` now accepts optional `extraPeriods` second arg so personal project skill durations are counted alongside work experience
- **`agent/find-jobs.ts`** — Personal projects passed to `computeSkillYears` in scoring context; project names + skills appended to candidate context
- **`agent/generate-cover-letter.ts`** — Personal projects included in candidate context with date range, description, and skills; also passed to `computeSkillYears` for skill years tracking

## Decisions made

- **`PersonalProject` shape mirrors `WorkExperience`** for date fields (`startDate`, `endDate`, `currentlyWorking`) — this lets `computeSkillYears` accept both types via a shared `SkillPeriod` interface, no duplication.
- **Personal project skills are self-assessed** — no validation against work history; trust the user's own judgment on what skills they used.
- **`computeSkillYears` extended, not duplicated** — added optional `extraPeriods` parameter typed as `SkillPeriod[]` (duck-typed; accepts anything with the right shape). All callers still work without changes.
- **Refresh token source**: InsForge puts refresh token in `Set-Cookie` header on the exchange endpoint, not JSON body — always extract from header in `app/auth/callback/route.ts`.
- **`proxy.ts` not `middleware.ts`**: Next.js 16 uses `proxy.ts`. Never create `middleware.ts` — causes startup conflict.
- **Toast types**: success = save success, error = failures, warning = partial success, info = neutral outcomes.

## Problems solved

- **`personalProjects` declared after use in generate-cover-letter.ts**: `personalProjects` variable was referenced in `computeSkillYears` call before its `const` declaration. Fixed by moving declaration above `skillYears`.
- **Stale `p.year` reference**: After removing `year` from `PersonalProject`, the cover letter agent still referenced `p.year`. Fixed by computing `dateRange` from `startDate`/`endDate`/`currentlyWorking`.
- **jobviewtrack not resolving**: Required `Referer: https://www.careerjet.dk/` header — without it the server bounces back to Careerjet. Fixed with dedicated `resolveTrackingUrl`.
- **Persistent logout**: InsForge returns refresh token only via `Set-Cookie` header. Fixed in `app/auth/callback/route.ts`.

## Current state

- All "What Drives You" fields save and flow into cover letter generation.
- Personal Projects section fully functional: add/remove/edit projects with dates, skills, description, URL.
- Project skill years tracked through `computeSkillYears` and shown in job scoring and cover letters.
- Auth fix in place — not yet confirmed by a full login cycle in production.
- jobviewtrack Referer fix in place — not yet confirmed in production (needs a real Danish job search).

## Next session starts with

Test both unconfirmed fixes in production:
1. Run a Danish job search (e.g. "frontend udvikler" Copenhagen) — check imported jobs' `external_apply_url` in DB. Should be employer domain, not `jobviewtrack.com`.
2. Log out, log back in, wait 6+ minutes — confirm session persists (auth fix).

## Open questions

- Does the jobviewtrack Referer fix actually resolve to employer URLs in production?
- Has the auth fix been confirmed working after a full login cycle?
- `console.log` may still exist in `agent/research-company.ts` from a previous session — check and remove if present.
