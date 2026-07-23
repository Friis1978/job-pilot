---
description: Answer a question from the wiki/ knowledge base before touching source
---

Answer from the persistent wiki at `wiki/`, not by scanning source files.

Question: `$ARGUMENTS`

Do this:

1. Read `wiki/index.md` first to find the relevant page(s).
2. Drill into those specific pages (and any `[[wikilinks]]` they point to) for the design/history/decision answer.
3. If the wiki genuinely does not cover it, say so, then fall back to `graphify query "$ARGUMENTS"` for a scoped code subgraph — and only read raw source after that.
4. Answer with citations to the wiki pages you used.

Do not read `graphify-out/` or `.raw/` to answer — that invalidates prompt caching.
