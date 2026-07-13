# Memory — Resume Motivation Generation Fix

Last updated: 2026-07-13

## What was built

**Payment system (from prior session):**
- Stripe integration with credit balance management
- `PaymentClient` component, payment success handling
- Credit balance display in dashboard

**Resume motivation generation (`app/api/jobs/[id]/resume-motivation/route.ts`):**
- Completely rewrote the POST handler to produce a proper resume paragraph instead of a cover letter
- Key fixes:
  - Removed company name and `company_research` from the Claude prompt (they triggered cover-letter framing)
  - Changed to `temperature: 0.3` (was 0.7 — too high for strict instruction-following)
  - Simplified system prompt with explicit NO rules (no greeting, no closing, no names)
  - Added `isCoverLetter()` guard to skip `profile.motivation` if it contains cover letter text
  - System prompt now instructs first-person ("I have", "I bring") focused on what candidate brings to the role

**Current system prompt approach:**
- Tells Claude to write a first-person "I" paragraph (3-5 sentences)
- Focus: what the candidate brings to this specific role + why they are motivated
- Forbidden: greetings, sign-offs, person names, company/org names, bullet points, markdown
- Job context: role title, about_role, responsibilities, requirements only (no company_research)
- Profile context: title, skills, motivation (filtered), career_vision, energy_tasks, personal_interests

## Decisions made

- `company_research` JSON excluded from motivation prompt — it contains cover-letter-style talking points (`whyThisRole`, `yourEdge`) that anchor Claude into cover letter format
- Company name excluded from motivation prompt for same reason
- temperature 0.3 for motivation (not 0.7) — better rule-following
- `isCoverLetter()` regex: `/^Hi\b|^Dear\b|Best regards|Yours sincerely|Kind regards/i`

## Problems solved

- **Root cause of cover letter output**: The `.next` dev cache was serving a stale compiled route for months. All apparent "generation" was returning the cached DB value. After `rm -rf .next`, the real Claude calls ran — and Claude was generating cover letters because: (1) company name in prompt triggered "write to company" framing, (2) `company_research` JSON had cover-letter talking points, (3) temperature 0.7 was too high.
- **Assistant prefill not supported**: `claude-sonnet-4-6` does not support assistant message prefill — throws 400 `invalid_request_error`.
- **`require("fs")` in Next.js App Router**: Doesn't work reliably in ESM route handlers for file writes.

## Current state

- Motivation generation working correctly in **production** (verified by user)
- Local dev has stale `.next` cache issue — `rm -rf .next && npm run dev` needed each time changes don't reflect
- Resume motivation: generates first-person paragraph focused on what candidate brings to role
- All token tracking from prior session still in place

## Next session starts with

Verify motivation output in local dev after cache clear. Then continue with whatever feature comes next — the resume PDF visual verification from the prior session was still pending.

## Open questions

- Local dev `.next` cache issue: why does hot reload not pick up changes to this specific route? May need `experimental.turbo` config adjustment or a consistent `rm -rf .next` habit.
- Resume PDF visual verification (from prior session) still not confirmed done.
