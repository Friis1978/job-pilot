# Walkthrough recording

Playwright is used here to record the README video, not to test.

## Recording

```bash
export DEMO_EMAIL='demo@devjobinfo.com'
export DEMO_PASSWORD='...'                 # never commit this
export NEXT_PUBLIC_INSFORGE_URL='...'      # same values as .env.local
export NEXT_PUBLIC_INSFORGE_ANON_KEY='...'

npx playwright test e2e/videos/auth-smoke.spec.ts     # 8s — confirms the session works
npx playwright test e2e/videos/demo-walkthrough.spec.ts

# webm -> mp4 for the README
ffmpeg -y -i test-results/*/video.webm \
  -vf "fps=30,scale=1280:-2:flags=lanczos" \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -movflags +faststart \
  docs/walkthrough.mp4

ffmpeg -y -ss 21 -i docs/walkthrough.mp4 -frames:v 1 -q:v 3 docs/walkthrough-thumb.jpg
```

Run `auth-smoke` first. A session failure three minutes into a take is expensive;
the smoke test catches it in eight seconds.

## Rules

**Only the demo account is ever recorded.** The real account holds a real name,
email, phone and 1,457 imported LinkedIn contacts — actual people who never
agreed to appear in a public repo. Nothing from it belongs on camera.

- The dashboard segment uses `/demo-dashboard`, which renders the same
  components from fixed demo data. It needs no session, every chart is
  populated, and no real person can appear in it.
- The **Network** feature is deliberately absent from the walkthrough. The demo
  account has no connections, and the only account that does holds real ones.
- Demo jobs are copies of real postings — public information — with
  `cover_letter`, `tailored_resume_content` and `company_research` excluded.
  Those are generated from the real profile and name the candidate and, in the
  case of research, recruiter contact details.

## How the session is established

The login page is OAuth-only, so there is no email/password form to drive.
`establishSession()` calls `POST /api/auth/sessions` and plants the resulting
cookies, plus the `jp_approved` and `jp_has_credit` flags the proxy gates on.
The recording therefore opens on the product rather than a Google consent screen.

## Credit

Generation is a real AI call and is charged to the demo account. Top it up by
inserting a `payments` row — **not** by setting `profiles.credit_balance_usd`,
which `recompute_credit_balance` recalculates from
`SUM(payments) - SUM(token_usage)` on the next AI call and would wipe mid-take:

```sql
INSERT INTO payments (user_id, amount_usd, stripe_session_id, paid_at)
SELECT id, 20.00, 'demo_seed_no_stripe_charge', now()
FROM auth.users WHERE email = 'demo@devjobinfo.com';
```

## Gotchas

- The resume button reads **"Tailored Resume"**, not "Generate". Matching on
  `/^Generate$/` silently skipped the entire resume segment in the first take —
  the spec passed and the feature simply never appeared.
- Playwright acts instantly, which reads as glitching on video. `helpers.ts`
  adds an eased cursor, captions and smooth scrolling so actions are followable.
- The dev-server badge sits in the corner of every frame; `injectCursor()` hides
  it along with the other Next dev chrome.
- `retries` is 0 in `playwright.config.ts` on purpose — a retry mid-recording
  produces a second, partial video file.
