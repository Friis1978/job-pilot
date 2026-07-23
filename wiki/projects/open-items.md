# Open Items

Loose ends and pending decisions. `tags: todo`

## Pending decisions (owner)
- **Two locked-out users** — `thorecaspersen@gmail.com`, `hansenrasmusfriis@gmail.com`
  have no Anthropic key and are locked out by the BYOK requirement (see [[ai-and-byok]]).
  Decide: email them, or let them hit the key screen.
- **Onboarding key step** — whether to add a guided "create your Anthropic key" step to
  onboarding (a key is now required before any AI feature works).

## Cleanup (safe, not yet done)
- **Stale deployment env vars** — `OPENAI_API_KEY`, `STRIPE_SK`, `STRIPE_PK`,
  `STRIPE_WEBHOOK_SECRET` are dead after the Claude migration + Stripe removal.
  Safe to delete via `insforge deployments env delete <id>` (see [[deployment]]).
- **Legacy DB objects** — `payments` table and `profiles.credit_balance_usd` are unread;
  a later migration should drop them.
- **Vercel CLI** — installed globally during a wrong-turn diagnosis; removable
  (`npm rm -g vercel` + `vercel logout`).

## Security follow-through (done, noted for the record)
- InsForge `ik_` project key was leaked via committed `.mcp.json`/`.codex/config.toml`,
  then rotated; old key confirmed revoked (401). Files now gitignored.
- Anthropic key rotated after being pasted in chat; demo + friis1978 `user_ai_keys`
  rows re-seeded with the new key.
