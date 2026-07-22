import { test } from "@playwright/test";
import {
  caption,
  establishSession,
  injectCursor,
  moveAndClick,
  smoothScroll,
  smoothScrollTo,
  smoothScrollToTop,
  waitForImages,
} from "./helpers";

/**
 * The README walkthrough, recorded as one continuous take:
 * landing → dashboard → profile → job search → match breakdown →
 * cover letter → motivation → tailored resume.
 *
 * Everything runs as demo@devjobinfo.com (Alex Jensen). The dashboard segment
 * uses /demo-dashboard, which renders the same components from fixed data, so
 * every chart is populated and no real person appears. The Network feature is
 * deliberately absent — the only account with contacts holds 1,457 real people.
 *
 * Two things learned from the first take:
 *
 *  - The landing page must be visited BEFORE the session exists. proxy.ts
 *    redirects an authenticated user from "/" to /dashboard, so establishing
 *    the session first silently recorded the demo account's own empty dashboard
 *    for the opening fifteen seconds.
 *  - Every scroll goes through the smooth* helpers, which animate inside the
 *    page with requestAnimationFrame. Stepping the page from Node produced
 *    visible lurching.
 *
 * AI generation is recorded live. The waiting is cut in post, not faked here.
 */
test.use({ video: { mode: "on", size: { width: 1280, height: 720 } } });

// A demo job with a full posting, so generation has real material to work from.
const JOB_ID = "9f6a476e-f3b1-4e6c-906c-5b3670d89564"; // Alice — Senior Full-Stack Engineer

test("devjobinfo walkthrough", async ({ context, page, baseURL }) => {
  // ── 1. Landing — before any session exists ────────────────────────────────
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await waitForImages(page);
  await injectCursor(page);
  await page.waitForTimeout(400);

  await caption(page, "DevJobInfo — find the jobs, research the companies, land the role", 1984);
  await smoothScroll(page, 620, 1440);
  await caption(page, "AI scores every role against your real skills", 1736);
  await smoothScrollToTop(page);

  // Sign in only now, so the landing page above was genuinely the landing page.
  await establishSession(context, baseURL!);

  // ── 2. Dashboard ──────────────────────────────────────────────────────────
  await page.goto("/demo-dashboard");
  await page.waitForLoadState("networkidle");
  await waitForImages(page);
  await injectCursor(page);
  await page.waitForTimeout(450);

  await caption(page, "The dashboard — your whole search at a glance", 1860);
  await smoothScroll(page, 420, 1200);
  await caption(page, "Recent activity and your pipeline by stage", 1860);
  await smoothScroll(page, 450, 1200);
  await caption(page, "Jobs over time and how your match scores are spread", 1860);
  await smoothScroll(page, 440, 1200);
  await smoothScrollToTop(page, 1080);

  // ── 3. Profile ────────────────────────────────────────────────────────────
  await page.goto("/profile");
  await page.waitForLoadState("networkidle");
  await waitForImages(page);
  await injectCursor(page);
  await page.waitForTimeout(450);

  await caption(page, "Your profile is what every match is scored against", 1984);
  await caption(page, "Upload a CV and it fills itself in", 1860);
  await smoothScroll(page, 500, 1440);
  await caption(page, "Skills, experience and the roles you are after", 1860);
  await smoothScroll(page, 540, 1440);
  await smoothScroll(page, 500, 1440);
  await smoothScrollToTop(page, 1080);

  // ── 4. Job search ─────────────────────────────────────────────────────────
  await page.goto("/find-jobs");
  await page.waitForLoadState("networkidle");
  await waitForImages(page);
  await injectCursor(page);
  await page.waitForTimeout(450);

  await caption(page, "Search five job boards at once", 1860);
  const urlTab = page.getByRole("button", { name: "Add from URL", exact: true });
  if (await urlTab.count()) {
    await moveAndClick(page, urlTab.first(), 800);
    await caption(page, "Any posting, in any language — nothing is translated", 1860);
  }

  await smoothScroll(page, 500, 1440);
  await caption(page, "Every job scored 0–100 against your profile", 1984);
  await smoothScroll(page, 400, 1200);
  await caption(page, "Thin postings are capped and flagged, never oversold", 1984);

  // ── 5. Match breakdown ────────────────────────────────────────────────────
  await page.goto(`/find-jobs/${JOB_ID}`);
  await page.waitForLoadState("networkidle");
  await waitForImages(page);
  await injectCursor(page);
  await page.waitForTimeout(500);

  await caption(page, "Which skills matched, which are missing, and why", 2100);
  await smoothScroll(page, 460, 1320);
  await smoothScroll(page, 460, 1320);

  // ── 6. Cover letter (live) ────────────────────────────────────────────────
  const coverGenerate = page.getByRole("button", { name: /^Generate$/ });
  if (await coverGenerate.count()) {
    await caption(page, "Generate a cover letter written from your real history", 1984);
    await moveAndClick(page, coverGenerate.first(), 600);
    await page.waitForTimeout(1500);
    await caption(page, "Written in the language of the posting", 1860);
    await page.getByRole("button", { name: /^Generate$/ }).first()
      .waitFor({ state: "visible", timeout: 180_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await smoothScroll(page, 400, 1200);
    await caption(page, "No invented companies, projects or metrics", 1984);
  }

  // ── 7. Motivation ─────────────────────────────────────────────────────────
  const resumeHeading = page.getByRole("heading", { name: "Tailored Resume" });
  if (await resumeHeading.count()) await smoothScrollTo(page, resumeHeading.first(), 1080);

  const motivation = page.getByRole("button", { name: "Motivation", exact: true });
  if (await motivation.count()) {
    await caption(page, "First, why this role — in your own words", 1860);
    await moveAndClick(page, motivation.first(), 600);
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Motivation", exact: true }).first()
      .waitFor({ state: "visible", timeout: 120_000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }

  // ── 8. Tailored resume (live) ─────────────────────────────────────────────
  // The button reads "Tailored Resume", not "Generate" — matching on the latter
  // silently skipped this entire section in the first take.
  const resumeGenerate = page.getByRole("button", { name: "Tailored Resume", exact: true });
  if (await resumeGenerate.count()) {
    await caption(page, "Then a resume tailored to this specific role", 1984);
    await moveAndClick(page, resumeGenerate.first(), 600);
    await page.waitForTimeout(2000);
    await caption(page, "Reordered around what this employer actually asked for", 2100);
    await page.getByRole("button", { name: "Tailored Resume", exact: true }).first()
      .waitFor({ state: "visible", timeout: 180_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await smoothScroll(page, 360, 1080);
    await caption(page, "Download either as a PDF, ready to send", 1984);
  }

  await smoothScrollToTop(page, 1200);
  await caption(page, "DevJobInfo — devjob.info", 2100);
  await page.waitForTimeout(500);
});
