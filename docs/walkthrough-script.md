# Walkthrough — voiceover script

For `docs/walkthrough.mp4` (90s, 1280×720). A narrated version exists as
`docs/walkthrough-voiced.mp4`, generated with Google's `gemini-3.1-flash-tts-preview`
(voice **Iapetus**), with per-line delivery steered by inline bracket cues. This is
what it speaks (the bracket tags below are direction, not spoken).

## How the audio is produced

1. The whole tagged script goes to `gemini-3.1-flash-tts-preview` (voice Iapetus)
   in a **single** generation in Google AI Studio
   ([aistudio.google.com/generate-speech](https://aistudio.google.com/generate-speech)),
   so it is one continuous performance. Inline cues like `[knowing]`, `[confident]`,
   `[sincere]` steer the delivery per line and are not spoken. A generation per line
   sounded like several narrators. (The browser path needs no key; scripting the API
   needs `GOOGLE_API_KEY`.)
2. The single take is split into 12 per-line files by `scripts/split-take` logic:
   estimate each boundary from cumulative word count, then snap to the nearest real
   silence gap. Pure silence-splitting fails — the model pauses at commas as well as
   between lines — but snapping a word-count estimate to a real pause never cuts
   mid-word. No Whisper needed.
3. `scripts/build-voiceover.sh` masters each line (trim edge silence, high-pass,
   gentle compression, a presence lift, loudness normalised to −16 LUFS) and places
   it at its SRT cue, then muxes onto `walkthrough.mp4`.

**Delivery:** bright and energetic, like showing a friend something you are
pleased with — the bracket cues carry the arc (frustration → relief → confidence,
`[sincere]` on the two integrity lines). 12 lines over 90 seconds; roughly a
quarter of the runtime is silence, which is deliberate.

Timecodes are read off the recording, not estimated from the spec. Iapetus reads
a touch tighter than the previous voice, so line 1 is nudged ~9% faster (pitch
preserved) to clear line 2's cue, and the video is held to its full length so the
end card lingers after the last line.

---

> **00:01** Job hunting is the same work, over and over. DevJobInfo takes that part off your hands.
>
> **00:08** Everything lands on one dashboard — jobs found, your match rate, and where every application stands.
>
> **00:16** Plus how your match scores are spread, so you know you're aiming at the right roles.
>
> **00:22** It all rests on your profile. Drop in your CV, and it fills itself in.
>
> **00:33** Search five job boards at once — or paste a job URL straight in.
>
> **00:40** Every job is scored against your profile. And a thin posting gets capped, never oversold.
>
> **00:48** Then a cover letter, written from your real history, in the language of the posting.
>
> **00:57** Nothing invented — only what's actually in your profile.
>
> **01:03** Add your motivation for the role.
>
> **01:08** And a resume tailored to this job, reordered around what this employer asked for.
>
> **01:19** Both download as PDFs, ready to send.
>
> **01:25** DevJobInfo — devjob dot info.

---

## Notes

- The on-screen captions carry their own wording; the narration deliberately
  differs so the voice adds context rather than reading the screen aloud.
- **"devjob dot info"** is spelled out for the speech engine. A human reader
  should just say "devjob dot info" naturally.
- To re-record with a human voice, keep the timecodes above — the video is cut
  to them. `walkthrough.srt` holds the same lines as subtitles.
- The recording is sped up 1.39× from the raw capture to reach 90 seconds, so
  on-screen captions pass quickly. The narration is the primary channel.
