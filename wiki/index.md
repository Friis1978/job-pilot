# Wiki Index

The persistent, compounding knowledge base for job-pilot (DevJobInfo). Read this
first to orient, then drill into the page you need. Maintained via `/wiki-ingest`,
`/wiki-query`, `/wiki-lint` (see [[conventions]]).

Paired with the **graphify** code graph (`graphify-out/`): the graph answers
"where is X in the code", the wiki answers "why is it this way / how does it fit".

## How to use it
- **Architecture questions** → read the relevant `architecture/` page here before reading source.
- **What's in flight / open decisions** → `projects/`.
- **What changed and when** → [[log]].

## Conventions
- [[conventions]] — how this wiki is structured and maintained · `tags: meta`

## Architecture
- [[deployment]] — how the app deploys (InsForge → Vercel) and where live env vars live · `tags: ops, insforge, vercel, env`
- [[ai-and-byok]] — all AI on Claude via users' own keys; Stripe/credit removed · `tags: ai, claude, byok, security`

## Projects
- [[open-items]] — loose ends and decisions still pending · `tags: todo`
