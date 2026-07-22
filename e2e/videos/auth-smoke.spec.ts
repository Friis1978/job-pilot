import { expect, test } from "@playwright/test";
import { establishSession } from "./helpers";

/**
 * Not part of the video — a fast check that the injected demo session gets past
 * the proxy's approval and credit gates before spending minutes on a recording.
 */
test.use({ video: "off" });

test("demo session reaches the gated pages", async ({ context, page, baseURL }) => {
  await establishSession(context, baseURL!);

  for (const path of ["/dashboard", "/profile", "/find-jobs"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    // A gate failure shows up as a redirect to /, /pending or /payment.
    expect(new URL(page.url()).pathname, `${path} was redirected`).toBe(path);
  }

  // Confirm the session is the demo identity and not a real one. The navbar
  // only renders initials, so check the profile form's own field values.
  await page.goto("/profile");
  await page.waitForLoadState("networkidle");
  const values = await page.locator("input").evaluateAll((els) =>
    (els as HTMLInputElement[]).map((e) => e.value).filter(Boolean),
  );
  expect(values.join(" | ")).toContain("Alex Jensen");
  expect(values.join(" | ")).not.toContain("friis1978@gmail.com");
});
