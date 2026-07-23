# Wiki Log

Append-only. One line per action: `## [YYYY-MM-DD] <action> | <details>`.

## [2026-07-23] wiki-init | Scaffolded wiki/ (index, conventions, log, architecture/, projects/) and the /wiki-ingest, /wiki-query, /wiki-lint commands. Seeded [[deployment]] and [[ai-and-byok]] from the OpenAI→Claude migration, BYOK build, Stripe removal, and the InsForge→Vercel deployment work. Recorded loose ends in [[open-items]].
## [2026-07-23] graphify-setup | Installed graphify (graphifyy 0.9.25 via pipx); built code graph (1001 nodes / 1906 edges, local AST); wired Claude Code hooks + skill; generated labeled graphify-out/wiki/ (97 articles) via the local claude backend.
## [2026-07-23] video-voiceover | Re-generated docs/walkthrough-voiced.mp4 with Google gemini-3.1-flash-tts-preview (voice Iapetus, inline [tag] delivery) replacing the OpenAI gpt-4o-mini-tts voice. Single AI Studio take → split into 12 per-line files (word-count boundaries snapped to silence, no Whisper) → build-voiceover.sh placed/mastered/muxed. L1 nudged ~9% faster to clear L2's cue; held to full 90.1s so the end card lingers. Updated docs/walkthrough-script.md.
## [2026-07-23] remove-ptc-agent | Removed the Open PTC Agent setup — deleted tracked PTC_AGENT_SETUP.md and stripped the [mcp_servers.ptc-agent] blocks from .codex/config.toml (gitignored). No longer used. The external ~/Documents/GitHub/open-ptc-agent clone and ~/.ptc-agent are outside this repo and left untouched.
