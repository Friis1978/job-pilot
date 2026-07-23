# AI & BYOK

Every AI feature runs on Claude, on each user's own Anthropic key. `tags: ai, claude, byok, security`

## All AI on Claude
Every AI call goes through `lib/ai/claude.ts` (`complete` / `completeJson`).
OpenAI is fully removed (package uninstalled). Tiers:
- `MODEL_SMART = claude-sonnet-5` — judgement/writing (scoring, cover letters, resumes, research, extraction).
- `MODEL_FAST = claude-haiku-4-5` — mechanical work (summaries, translation, sentence rewrites).

Model gotchas baked into the helper:
- Sonnet 5 rejects `temperature`/sampling params (400) — steer with prompt + `effort`.
- Haiku rejects `effort` — the helper strips it for the fast tier.
- `thinking` is always sent explicitly (per-model default differs and counts against `max_tokens`).
- JSON shape is pinned via `output_config.format` (json_schema), not prompt-only.

## BYOK — users bring their own key (required)
A key is **required** for every AI feature; there is no platform fallback.
- Stored per-user in the `user_ai_keys` table, encrypted app-side with **AES-256-GCM**
  (`lib/ai/byok.ts`). Key env var `BYOK_ENCRYPTION_KEY` (32-byte base64) — must match
  in `.env.local` and the deployment env (see [[deployment]]) or stored keys can't decrypt.
- Owner-only RLS with **no admin exception** + `FORCE ROW LEVEL SECURITY` (admin writes
  need a NO FORCE / FORCE toggle around them).
- UI at `/settings/api-key`; key is write-only across the boundary (only last-4 shown).
- `clientFor(userId)` uses the user's key; a keyless call throws `UserKeyError`.
- Every AI route calls `keyGuard()` up front → 403 `{code: missing_api_key|invalid_api_key, settingsUrl}`.
- Anthropic keys scrubbed from Sentry via `beforeSend` (client/server/edge) — `lib/ai/redact.ts`.
- The `/api/settings/ai-key` route wraps handlers so a thrown error always returns JSON
  (a bare throw returned an empty body → client "Unexpected end of JSON").

## Stripe & credit removed
No `/payment`, no `stripe` dep, no credit gate in `proxy.ts` (gates on `jp_approved` only).
`payments` table and `profiles.credit_balance_usd` still exist but are unread (legacy
Stripe test-mode data; a later migration drops them). Dashboard/admin show token usage,
not credit. Each user pays Anthropic directly, so the app never bills anyone.

## When adding a new AI feature
Thread `userId` into the call, guard the route with `keyGuard()`, never add a
platform-key path or reintroduce OpenAI.
