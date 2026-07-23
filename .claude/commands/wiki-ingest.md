---
description: Compile raw notes from .raw/ into the persistent wiki/ knowledge base
---

Ingest unorganized material into the compounding wiki at `wiki/`.

Target: `$ARGUMENTS` — a file or folder under `.raw/`. If empty, process every file in `.raw/`.

Do this:

1. Read the target file(s) from `.raw/` (only these — do not scan the rest of the repo).
2. For each concept, find the existing `wiki/` page it belongs to (check `wiki/index.md` first). **Merge into it — never create a duplicate page for a concept that already exists.** Only create a new page when the concept is genuinely new.
3. Write concept pages under `wiki/architecture/` (system mechanics, module maps) or `wiki/projects/` (tasks, constraints, decisions). Link related concepts with `[[wikilinks]]` (bare page name, no path, no `.md`).
4. Rebuild `wiki/index.md` so every page has a link, tags, and a one-line summary.
5. Append one line to `wiki/log.md`: `## [YYYY-MM-DD] wiki-ingest | <what was ingested and where it landed>`.
6. Report which pages were created vs. merged.

Keep pages tight and factual. Prefer merging and cross-linking over sprawl.
