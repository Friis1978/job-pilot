import type { BrowserContext, Locator, Page } from "@playwright/test";

/**
 * Presentation helpers for the README walkthrough recording.
 *
 * Playwright drives the browser instantly, which on video reads as glitching
 * rather than usage — elements change with no visible cause. These helpers add
 * a visible cursor, easing, and deliberate pauses so a viewer can follow what
 * is being clicked and why.
 */

/** Draws a fake cursor. Playwright's real pointer is not captured in video. */
export const injectCursor = async (page: Page) => {
  await page.addStyleTag({
    content: `
      /* The dev-server badge sits in the corner of every frame — hide it. */
      nextjs-portal, [data-nextjs-toast], #__next-build-watcher,
      [data-nextjs-dev-tools-button], [data-nextjs-dev-indicator] { display: none !important; }
      #pw-cursor {
        position: fixed; top: 50%; left: 50%; width: 22px; height: 22px;
        margin: -11px 0 0 -11px; border-radius: 50%;
        background: rgba(37, 99, 235, .35);
        border: 2px solid rgba(37, 99, 235, .9);
        box-shadow: 0 0 0 4px rgba(37, 99, 235, .12);
        pointer-events: none; z-index: 2147483647;
        transition: transform .08s linear;
      }
      #pw-cursor.pw-click { transform: scale(.6); background: rgba(37, 99, 235, .6); }
      #pw-caption {
        position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%);
        max-width: 78%; padding: 14px 26px; border-radius: 14px;
        background: rgba(16, 24, 40, .93); color: #fff;
        font: 600 19px/1.45 Inter, system-ui, -apple-system, sans-serif;
        text-align: center; pointer-events: none; z-index: 2147483647;
        opacity: 0; transition: opacity .35s ease;
        box-shadow: 0 12px 40px rgba(0,0,0,.35);
      }
      #pw-caption.pw-show { opacity: 1; }
    `,
  });
  await page.evaluate(() => {
    if (!document.getElementById("pw-cursor")) {
      const c = document.createElement("div");
      c.id = "pw-cursor";
      // Start centred rather than at 0,0, where it reads as a stray artefact.
      c.style.left = `${window.innerWidth / 2}px`;
      c.style.top = `${window.innerHeight / 2}px`;
      document.body.appendChild(c);
    }
    if (!document.getElementById("pw-caption")) {
      const cap = document.createElement("div");
      cap.id = "pw-caption";
      document.body.appendChild(cap);
    }
    // Re-inject after client-side navigation, which wipes the nodes.
    (window as unknown as { __pwCursorAt?: (x: number, y: number) => void }).__pwCursorAt = (x, y) => {
      const el = document.getElementById("pw-cursor");
      if (el) {
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      }
    };
  });
};

/** Shows a caption for `ms`, then fades it out. */
export const caption = async (page: Page, text: string, ms = 2600) => {
  await page.evaluate((t) => {
    const el = document.getElementById("pw-caption");
    if (el) {
      el.textContent = t;
      el.classList.add("pw-show");
    }
  }, text);
  await page.waitForTimeout(ms);
  await page.evaluate(() => document.getElementById("pw-caption")?.classList.remove("pw-show"));
  await page.waitForTimeout(350);
};

/** Moves the fake cursor along an eased path so motion is visible on video. */
const glideTo = async (page: Page, x: number, y: number, steps = 22) => {
  const from = await page.evaluate(() => {
    const el = document.getElementById("pw-cursor");
    return el ? { x: parseFloat(el.style.left || "640"), y: parseFloat(el.style.top || "360") } : { x: 640, y: 360 };
  });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // ease-in-out so the cursor accelerates away and settles on the target
    const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const cx = from.x + (x - from.x) * e;
    const cy = from.y + (y - from.y) * e;
    await page.evaluate(([px, py]) => {
      const el = document.getElementById("pw-cursor");
      if (el) {
        el.style.left = `${px}px`;
        el.style.top = `${py}px`;
      }
    }, [cx, cy]);
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(12);
  }
};

/** Scrolls the target into view, glides the cursor to it, then clicks. */
export const moveAndClick = async (page: Page, locator: Locator, settleMs = 500) => {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const box = await locator.boundingBox();
  if (!box) throw new Error("moveAndClick: target has no bounding box (not visible?)");
  await glideTo(page, box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate(() => document.getElementById("pw-cursor")?.classList.add("pw-click"));
  await page.waitForTimeout(120);
  await locator.click();
  await page.evaluate(() => document.getElementById("pw-cursor")?.classList.remove("pw-click"));
  await page.waitForTimeout(settleMs);
};

/** Types into a field at human speed, with the cursor parked on it. */
export const typeInto = async (page: Page, locator: Locator, text: string, delay = 55) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box) await glideTo(page, box.x + box.width / 2, box.y + box.height / 2);
  await locator.click();
  await locator.fill("");
  await locator.pressSequentially(text, { delay });
  await page.waitForTimeout(400);
};

/** Smooth page scroll — instant jumps read as a cut on video. */
export const slowScroll = async (page: Page, distance = 900, steps = 30) => {
  const per = distance / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, per);
    await page.waitForTimeout(28);
  }
  await page.waitForTimeout(500);
};

export const slowScrollToTop = async (page: Page, steps = 24) => {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, -140);
    await page.waitForTimeout(24);
  }
  await page.waitForTimeout(400);
};

/** Waits for every <img> to finish decoding so nothing pops in mid-shot. */
export const waitForImages = async (page: Page) => {
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map((img) => new Promise((res) => { img.onload = res; img.onerror = res; })),
    );
  });
  await page.waitForTimeout(300);
};

/**
 * Establishes a demo session by calling the InsForge auth API and planting the
 * resulting cookies, rather than driving the login screen.
 *
 * Two reasons: the login page is OAuth-only, so there is no email/password form
 * to drive; and a recording that opens on a Google consent screen is worse than
 * one that opens on the product.
 *
 * `jp_approved` / `jp_has_credit` are the app's own gate flags, normally set
 * after approval and payment. The proxy redirects to /pending or /payment
 * without them, so they are planted too.
 *
 * Credentials come from the environment — never from a committed file.
 */
export const establishSession = async (context: BrowserContext, baseURL: string) => {
  const email = process.env.DEMO_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  if (!email || !password) throw new Error("Set DEMO_EMAIL and DEMO_PASSWORD before recording.");
  if (!insforgeUrl || !anonKey) throw new Error("Set NEXT_PUBLIC_INSFORGE_URL and NEXT_PUBLIC_INSFORGE_ANON_KEY.");

  const res = await fetch(`${insforgeUrl}/api/auth/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Demo sign-in failed: HTTP ${res.status} ${await res.text()}`);

  const { accessToken, csrfToken } = (await res.json()) as { accessToken: string; csrfToken?: string };
  const refreshToken = (res.headers.get("set-cookie") ?? "").match(/insforge_refresh_token=([^;]+)/)?.[1];

  const { hostname } = new URL(baseURL);
  const base = { domain: hostname, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const };

  await context.addCookies([
    { name: "insforge_access_token", value: accessToken, ...base },
    ...(refreshToken ? [{ name: "insforge_refresh_token", value: refreshToken, ...base }] : []),
    ...(csrfToken ? [{ name: "insforge_csrf_token", value: csrfToken, ...base }] : []),
    // App gate flags — see proxy.ts
    { name: "jp_approved", value: "1", ...base },
    { name: "jp_has_credit", value: "1", ...base },
    { name: "jp_has_account", value: "1", ...base },
  ]);
};
