# Conventions

How this wiki works. `tags: meta`

## Layout
- `wiki/index.md` — the catalog. Every page appears here with a link, tags, and a one-line summary.
- `wiki/log.md` — append-only, chronological. One line per action: `## [YYYY-MM-DD] <action> | <details>`.
- `wiki/architecture/` — how sub-modules and system mechanics actually work.
- `wiki/projects/` — active task lists, constraints, pending decisions.

## Rules
- **Never duplicate a concept.** Merge new information into the existing page; create a new page only for a genuinely new concept.
- **Link, don't repeat.** Cross-reference with `[[wikilinks]]` (bare page name, no path, no `.md`).
- **Update after code changes.** When code changes, update the matching architecture page in the same session and append to [[log]].
- **Keep pages tight and factual.** The wiki is a compiler, not a diary — say what is true and why, drop the narration.

## Operations
- `/wiki-ingest <path>` — compile raw notes from `.raw/` into pages here.
- `/wiki-query <question>` — answer from the wiki before scanning source.
- `/wiki-lint` — fix broken links, index missing pages, clean formatting.

## Relationship to graphify
The graph (`graphify-out/`) is the deterministic code map — regenerated with
`graphify update .`, never hand-edited, gitignored. This wiki is the human/agent
layer on top: decisions, rationale, gotchas. Do not read `graphify-out/` or
`.raw/` during normal work — it invalidates prompt caching.
