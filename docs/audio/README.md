# Audio assets

Reusable, cleared audio for the walkthrough video and future clips.

## the-grey-room.mp3
- **Source:** YouTube Audio Library (original filename: `Reviver - The Grey Room _ Density & Time.mp3`).
- **License:** downloaded under the **"attribution not required"** filter — cleared for
  commercial/public use, no credit line needed. Safe to reuse in this repo's videos.
- **Character:** majestic / cinematic-orchestral bed. 154s.
- **Used in:** `docs/walkthrough-voiced.mp4` — mixed under the narration, loudness-normalized
  to ~11 LU below the voice and sidechain-ducked so it dips under speech and breathes in the
  gaps. See the mix recipe in `docs/walkthrough-script.md`.

To reuse it under a new clip, follow the same ffmpeg recipe (loudnorm bed → afade in/out →
`sidechaincompress` keyed by the voice → amix → alimiter).
