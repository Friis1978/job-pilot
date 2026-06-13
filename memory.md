# Memory — Cover Letter PDF, Avatar Crop, Language Detection

Last updated: 2026-06-13

## What was built

### components/profile/ProfileForm.tsx — AvatarCropModal wired in
- `handleAvatarChange` now creates an object URL and sets `cropImageSrc` state instead of uploading directly
- `handleCropConfirm(blob)`: uploads JPEG blob to `avatars/{userId}/avatar.jpg`, always `.jpg` extension
- `handleCropCancel()`: revokes object URL, clears modal
- Input value reset to `""` after file pick so the same file can be re-selected after cancel
- Renders `<AvatarCropModal>` when `cropImageSrc` is set

### app/api/jobs/[id]/cover-letter/route.ts — multiple fixes
- **Avatar in PDF**: passes `avatarUrl` (raw URL string) directly to `CoverLetterPDF` — react-pdf fetches the public image itself during `renderToBuffer`. No base64 conversion needed.
- **Photo toggle**: reads `?photo=0` query param. If present, `avatarUrl` is null → image excluded from PDF.
- **Auth email fallback**: `email = profile.email || authData.user.email || null` — covers users who haven't filled profile email.
- **Language detection**: concatenates `title + about_role + responsibilities + requirements` before calling `detectLanguage`. Also selects those fields in the DB query.

### app/api/jobs/[id]/cover-letter/CoverLetterPDF.tsx
- Prop renamed `avatarBase64 → avatarUrl: string | null`
- `<Image src={avatarUrl}>` — react-pdf fetches URL directly

### components/find-jobs/CoverLetterSection.tsx — photo toggle
- `includePhoto` state (default `true`)
- Photo toggle button shown only when `hasAvatar` — accent-colored with checkmark when active, muted when inactive
- Download appends `?photo=0` when `!includePhoto`

### lib/detect-language.ts — expanded markers
- Danish markers greatly expanded: added stop words (vi, du, din, vores, hos, vil, kan) and job-posting words (stilling, ansøgning, søger, udvikler, udvikling, virksomhed, erfaring, hjemmeside, forsikring, pension, arbejde)
- All other languages similarly expanded with job-posting vocabulary
- Now detects Danish from sparse text like "Senior frontendudvikler (Nuxt)" — "udvikler" is in markers

### agent/generate-cover-letter.ts — language-aware generation
- Imports `detectLanguage` + `LANGUAGE_NAMES` map (8 languages)
- Concatenates `title + about_role + responsibilities + requirements` for detection
- Adds to system prompt: "Write the entire letter in {language} — the job description is in {language}, so the letter must be too"
- Also selects `title, responsibilities, requirements` in the job DB query (previously only selected `about_role`)

## Decisions made

- **react-pdf Image + public storage**: Pass the storage URL directly to `<Image src>`. React-pdf fetches it in Node.js during `renderToBuffer`. No need to pre-fetch or convert to base64. The `avatars` bucket is public so no auth needed.
- **Avatar always .jpg**: AvatarCropModal outputs JPEG via canvas `toBlob('image/jpeg', 0.92)`. Always stored as `{userId}/avatar.jpg`. No extension ambiguity.
- **Language detection at generation time**: No `language` column in DB. Detection runs fresh from all job text fields each time. Consistent between cover letter generation and PDF download.
- **Combined job text for detection**: `[title, about_role, ...responsibilities, ...requirements].join(" ")` — handles jobs where `about_role` is sparse (e.g. URL import only captured the title).

## Problems solved

- **Avatar URL has `?v=...` cache param**: SDK download approach used regex to extract storage key, but `?v=c2df9540...` got included in the key, breaking the download. Fixed by using plain URL — bucket is public, no auth needed.
- **Avatar not appearing in PDF**: Previous base64 approach was fragile (fetch → buffer → base64 → data URL). Switched to passing URL directly to react-pdf `Image` — it handles fetching internally.
- **F&P job not detected as Danish**: `about_role` was only "Senior frontendudvikler (Nuxt) - Forsikring & Pension hjemmeside". Stop words absent. Fixed by adding "udvikler" and other Danish words to markers, and using all job text fields for detection.
- **Cover letter generated in English for Danish jobs**: `generate-cover-letter.ts` had no language instruction. Fixed by detecting language and injecting "Write in {language}" into system prompt.

## Current state

- Avatar crop modal: fully working. File pick → crop modal → JPEG upload → URL saved to DB.
- Cover letter PDF photo: passes URL directly to react-pdf `Image`. Photo toggle working (default on).
- Cover letter header: phone, email (with auth fallback), portfolio — all dynamic from profile.
- Language detection: expanded markers + all job text fields. Should correctly detect Danish from job titles/descriptions.
- Language-aware cover letter generation: GPT-4o instructed to write in the detected language.

## Next session starts with

Check `context/build-plan.md` and `context/progress-tracker.md` to identify the next planned feature. Feature 21 (Scheduled Job Alert Emails) is next on the plan — Resend for email, cron endpoint at `/api/cron/job-alerts` protected by `CRON_SECRET`. Or continue with user-directed fixes.

## Open questions

- Cover letter PDF photo: unconfirmed whether react-pdf successfully fetches the public URL. User should test after this session.
- `overflow: hidden` + `borderRadius` on react-pdf `View` may not clip the image into a circle — it might render as a square. This is a known react-pdf limitation. If needed, the workaround is to clip the image client-side (already done via AvatarCropModal canvas) and trust the square crop will still look fine in the PDF.
- InsForge SDK JSONB bug: still affects any future RPC with JSONB params. Document in `context/library-docs.md`.
- Feature 13 company research ~60-120s — will timeout on Vercel free tier. Address at deployment.
