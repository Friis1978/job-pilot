import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright is used here to record the README walkthrough video, not to test.
 * Specs live in e2e/videos and each one opts into recording with
 * `test.use({ video: { mode: "on", size: { width: 1280, height: 720 } } })`.
 *
 * Recordings run against the demo account (demo@devjobinfo.com) so no real
 * profile, email, phone or LinkedIn contact ever reaches the video.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  // A retry mid-recording produces a second, partial video file — never retry.
  retries: 0,
  reporter: [["list"]],
  // AI generation (cover letter, tailored resume) can take well over a minute.
  timeout: 5 * 60 * 1000,
  use: {
    baseURL: process.env.DEMO_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1280, height: 720 },
    trace: "off",
    screenshot: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
