# Deployment

How devjob.info ships and where its live configuration lives. `tags: ops, insforge, vercel, env`

## The one non-obvious fact
The app is deployed through **InsForge**, which hosts the Next.js app on
**Vercel infrastructure under InsForge's own Vercel account**. Responses carry
`server: Vercel` / `x-vercel-id`, but the project owner has **no Vercel project
of their own** for this app — don't look in a personal Vercel dashboard. The
InsForge→Vercel indirection is invisible from the headers, which is exactly why
"set the env var in Vercel" is a dead end.

## Where the live app's env vars live
**`npx @insforge/cli deployments env` (list / set / delete).** Not Vercel, not
`.env.local` (local dev only), not `insforge secrets` (those are platform-internal:
API_KEY, JWT_SECRET, ANON_KEY, VERCEL_WEBHOOK_SECRET).

A var present in `.env.local` but missing here 500s the live app while local works
fine — that exact split is how `BYOK_ENCRYPTION_KEY` broke production key-saving
(see [[ai-and-byok]]). `BYOK_ENCRYPTION_KEY` **must be byte-identical** in
`.env.local` and here, or stored user keys become undecryptable.

## Deploying
- CI: `.github/workflows/deploy.yml` → `insforge deployments deploy .`, then polls
  https://devjob.info/ for 200. The push trigger occasionally doesn't fire —
  dispatch manually: `gh workflow run "Deploy to InsForge" --ref main`.
- Env-var changes only take effect on the **next deploy**.
- Auth in CI: `INSFORGE_USER_API_KEY` (a `uak_` key) for `insforge login`;
  `INSFORGE_PROJECT_API_KEY` (an `ik_` key) written into `.insforge/project.json`.

## Two InsForge key types (easy to confuse — this cost hours once)
- **`ik_` = project API key** → `.insforge/project.json` `api_key`, `.mcp.json`,
  `.codex/config.toml`. Backend/CLI access. Regenerate in the InsForge **project**
  dashboard; repopulate with `insforge link --project-id <id> --org-id <id>`.
- **`uak_` = user API key** → GitHub secret `INSFORGE_USER_API_KEY`. Lives under
  **Profile → API Keys**, a different screen. A `uak_` in the `ik_` slot breaks
  `db query` with "Invalid token".

`.mcp.json` and `.codex/config.toml` are **gitignored** (they held a leaked `ik_`
once — never commit them).
