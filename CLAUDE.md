@AGENTS.md

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## LLM Wiki (`wiki/`)

A persistent, hand/agent-maintained knowledge base at `wiki/` — the "why / how it fits" layer on top of graphify's "where is it" code graph. **This is `wiki/`, not `graphify-out/wiki/`** (the latter is a graph export). See `wiki/conventions.md`.

Rules:
- **Startup:** read `wiki/index.md` first to orient before answering architecture questions or planning changes.
- **Order of lookup for a codebase question:** `wiki/` → `graphify query` → raw source (last).
- **After changing code:** update the matching `wiki/architecture/` page and append one line to `wiki/log.md` in the same session.
- **Never duplicate a concept** — merge into the existing page; link with `[[wikilinks]]`.
- Do **not** read `graphify-out/` or `.raw/` during normal work (prompt-cache hygiene).
- Operations: `/wiki-ingest <path>`, `/wiki-query <question>`, `/wiki-lint`.
