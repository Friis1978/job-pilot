---
description: Check and repair the wiki/ knowledge base (links, cross-refs, index)
---

Scan `wiki/` for integrity problems and fix them.

Do this:

1. Collect every page under `wiki/` and every `[[wikilink]]` used across them.
2. Report and fix:
   - **Broken wikilinks** — a `[[name]]` with no matching `wiki/**/name.md`. Either point it at the right page or create a stub and note it.
   - **Unindexed pages** — a file under `wiki/` not listed in `wiki/index.md`. Add it (link + tags + one-line summary).
   - **Orphans** — a page nothing links to. Add a cross-reference from the nearest related page.
   - **Formatting** — inconsistent headings, missing one-line summaries, stale links.
3. Rebuild `wiki/index.md` so it reflects the real tree.
4. Append one line to `wiki/log.md`: `## [YYYY-MM-DD] wiki-lint | <what was fixed>`.

Only touch `wiki/`. Report a short before/after summary of issues found and fixed.
