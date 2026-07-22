import { test } from "@playwright/test";
import {
  caption,
  establishSession,
  injectCursor,
  moveAndClick,
  slowScroll,
  slowScrollToTop,
  typeInto,
  waitForImages,
} from "./helpers";

/**
 * The full README walkthrough, recorded as one continuous take:
 * landing → dashboard → profile → job search → match breakdown →
 * cover letter → tailored resume.
 *
 * Everything runs as demo@devjobinfo.com (Alex Jensen). The dashboard segment
 * uses /demo-dashboard, which renders the same components from fixed data, so
 * every chart is populated and no real person appears. The Network feature is
 * deliberately absent — the only account with contacts holds 1,457 real people.
 *
 * Cover letter and resume generation are recorded live; the waiting is cut in
 * post with ffmpeg rather than faked here.
 */
test.use({ video: { mode: "on", size: { width: 1280, height: 720 } } });

// A demo job with a full posting, so generation has real material to work from.
const JOB_ID = "9f6a476e-f3b1-4e6c-906c-5b3670d89564"; // Alice — Senior Full-Stack Engineer

test("devjobinfo walkthrough", async ({ context, page, baseURL }) => {
  await establishSession(context, baseURL!);

  // ── 1. Landing ────────────────────────────────────────────────────────────
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await waitForImages(page);
  await injectCursor(page);
  await page.waitForTimeout(600);

  await caption(page, "DevJobInfo — find the jobs, research the companies, land the role", 3200);
  await slowScroll(page, 650);
  await caption(page, "AI scores every role against your real skills", 2800);
  await slowScrollToTop(page);

  // ── 2. Dashboard ──────────────────────────────────────────────────────────
  await page.goto("/demo-dashboard");
  await page.waitForLoadState("networkidle");
  await waitForImages(page);
  await injectCursor(page);
  await page.waitForTimeout(700);

  await caption(page, "The dashboard — your whole search at a glance", 3000);
  await caption(page, "Jobs found, match rate, and applications this week", 3000);
  await slowScroll(page, 430);
  await caption(page, "Recent activity and your pipeline by stage", 3000);
  await slowScroll(page, 460);
  await caption(page, "Jobs over time and how your match scores are spread", 3000);
  await slowScroll(page, 450);
  await caption(page, "Company research activity", 2600);
  await slowScrollToTop(page);

  // ── 3. Profile ────────────────────────────────────────────────────────────
  await page.goto("/profile");
  await page.waitForLoadState("networkidle");
  await waitForImages(page);
  await injectCursor(page);
  await page.waitForTimeout(700);

  await caption(page, "Your profile is what every match is scored against", 3200);
  await caption(page, "Upload a CV and it fills itself in", 3000);
  await slowScroll(page, 520);
  await caption(page, "Skills, experience and the roles you are after", 3000);
  await slowScroll(page, 560);
  await caption(page, "Work history — used to weigh years per skill", 3000);
  await slowScroll(page, 520);
  await slowScrollToTop(page);

  // ── 4. Job search ─────────────────────────────────────────────────────────
  await page.goto("/find-jobs");
  await page.waitForLoadState("networkidle");
  await waitForImages(page);
  await injectCursor(page);
  await page.waitForTimeout(700);

  await caption(page, "Search five job boards at once", 3000);

  const titleField = page.getByPlaceholder("Frontend Engineer");
  if (await titleField.count()) {
    await typeInto(page, titleField.first(), "Senior Full-Stack Engineer");
    const locField = page.getByPlaceholder(/Remote, New York/i);
    if (await locField.count()) await typeInto(page, locField.first(), "Copenhagen");
    await caption(page, "Or paste a job URL to import a posting directly", 3000);
    const urlTab = page.getByRole("button", { name: "Add from URL", exact: true });
    if (await urlTab.count()) {
      await moveAndClick(page, urlTab.first(), 800);
      await caption(page, "Any posting, in any language — nothing is translated", 3000);
    }
  }

  await slowScroll(page, 520);
  await caption(page, "Every job scored 0–100 against your profile", 3200);
  await slowScroll(page, 420);
  await caption(page, "Thin postings are capped and flagged, never oversold", 3200);

  // ── 5. Match breakdown ────────────────────────────────────────────────────
  await page.goto(`/find-jobs/${JOB_ID}`);
  await page.waitForLoadState("networkidle");
  await waitForImages(page);
  await injectCursor(page);
  await page.waitForTimeout(800);

  await caption(page, "Open a job for the full breakdown", 3000);
  await caption(page, "Which skills matched, which are missing, and why", 3400);
  await slowScroll(page, 480);
  await caption(page, "Experience and seniority scored separately", 3000);
  await slowScroll(page, 480);

  // ── 6. Cover letter (live generation) ─────────────────────────────────────
  const generateButtons = page.getByRole("button", { name: /^Generate$/ });
  if (await generateButtons.count()) {
    await caption(page, "Generate a cover letter written from your real history", 3200);
    await moveAndClick(page, generateButtons.first(), 600);
    // Real AI call — the wait is trimmed in post, not skipped here.
    await page.waitForTimeout(2000);
    await caption(page, "Written in the language of the posting", 3000);
    await page
      .getByRole("button", { name: /^Generate$/ })
      .first()
      .waitFor({ state: "visible", timeout: 180_000 })
      .catch(() => {});
    await page.waitForTimeout(3000);
    await slowScroll(page, 420);
    await caption(page, "No invented companies, projects or metrics", 3200);
  }

  // ── 7. Tailored resume ────────────────────────────────────────────────────
  // The button reads "Tailored Resume", not "Generate" — matching on the latter
  // silently skipped this whole section in the first take.
  await slowScroll(page, 520);
  const resumeGenerate = page.getByRole("button", { name: "Tailored Resume", exact: true });
  if (await resumeGenerate.count()) {
    await caption(page, "And a resume tailored to this specific role", 3200);
    await moveAndClick(page, resumeGenerate.first(), 600);
    await page.waitForTimeout(3000);
    await caption(page, "Reordered around what this employer actually asked for", 3400);
    // Wait for the spinner label to revert, i.e. generation finished.
    await page
      .getByRole("button", { name: "Tailored Resume", exact: true })
      .first()
      .waitFor({ state: "visible", timeout: 180_000 })
      .catch(() => {});
    await page.waitForTimeout(4000);
    await slowScroll(page, 380);
    await caption(page, "Download either as a PDF, ready to send", 3200);
  }

  await slowScrollToTop(page);
  await caption(page, "DevJobInfo — devjob.info", 3400);
  await page.waitForTimeout(800);
});
