# Walkthrough — voiceover script

For `docs/walkthrough.mp4` (90s, 1280×720). A narrated version already exists as
`docs/walkthrough-voiced.mp4`, generated with OpenAI `gpt-4o-mini-tts` (voice
`onyx`, deep male, energetic). This is what it speaks.

## How the audio is produced

The narration is a recorded human read, supplied as one continuous take.

It is transcribed for word timestamps and each line located in it, then placed
at its cue. Splitting on silence does not work — a reader pauses at commas as
well as between lines, so pause length alone cannot tell them apart.

Processing is deliberately light, since the take was already well recorded:
edges trimmed, rumble rolled off below 70 Hz, gentle 2:1 compression, and
loudness normalisation so every line sits at the same level.

**Delivery:** bright and energetic, like showing a friend something you are
pleased with. 12 lines, 148 words over 90 seconds — roughly a quarter of the
runtime is silence, which is deliberate.

Timecodes were read off the recording, not estimated from the spec.

The whole script is generated as a **single** TTS request and then split by
transcribing it for word timestamps. Generating a request per line made each
line a fresh performance — the same voice name, but a different delivery every
time, which sounded like several different narrators.

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
