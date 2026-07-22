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
      /* The dev-server badge sits in the corner of every frame. The selectors
         below missed it in the last recording — Next renders it inside a shadow
         host whose tag name has changed between versions — so the fixed-position
         bottom-left catch-all is the one that actually works. Verify a frame
         after recording rather than trusting this list. */
      nextjs-portal, [data-nextjs-toast], #__next-build-watcher,
      [data-nextjs-dev-tools-button], [data-nextjs-dev-indicator],
      [data-next-badge], [data-next-badge-root], [data-nextjs-dev-tools-root],
      body > nextjs-portal, body > [id^="__next-dev"] { display: none !important; }
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
  // Not scrollIntoViewIfNeeded — that jumps instantly and is visible on video.
  await smoothScrollTo(page, locator);
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
  await smoothScrollTo(page, locator);
  const box = await locator.boundingBox();
  if (box) await glideTo(page, box.x + box.width / 2, box.y + box.height / 2);
  await locator.click();
  await locator.fill("");
  await locator.pressSequentially(text, { delay });
  await page.waitForTimeout(400);
};

/**
 * Smooth page scroll.
 *
 * Driving this from Node with repeated `mouse.wheel` calls steps the page in
 * visible jumps — each round trip is tens of milliseconds, so at 30fps the
 * viewer sees the page lurch. Running the animation inside the page with
 * requestAnimationFrame moves it once per rendered frame instead, which is what
 * the recording actually captures.
 *
 * @param distance pixels to travel (negative scrolls up)
 * @param durationMs how long the travel should take
 */
export const smoothScroll = async (page: Page, distance = 900, durationMs = 2200) => {
  await page.evaluate(
    ([dist, dur]) =>
      new Promise<void>((resolve) => {
        const start = window.scrollY;
        const t0 = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - t0) / dur);
          // ease-in-out: starts and stops gently instead of snapping
          const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          window.scrollTo(0, start + dist * e);
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    [distance, durationMs] as const,
  );
  await page.waitForTimeout(450);
};

/** Smoothly returns to the top of the page. */
export const smoothScrollToTop = async (page: Page, durationMs = 1400) => {
  const y = await page.evaluate(() => window.scrollY);
  if (y > 0) await smoothScroll(page, -y, durationMs);
};

/** Smoothly brings an element into the middle of the viewport. */
export const smoothScrollTo = async (page: Page, locator: Locator, durationMs = 1400) => {
  const box = await locator.boundingBox();
  if (!box) return;
  const delta = await page.evaluate(
    ([top, height]) => top - (window.innerHeight / 2 - height / 2),
    [box.y, box.height] as const,
  );
  if (Math.abs(delta) > 8) await smoothScroll(page, delta, durationMs);
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
 * `jp_approved` is the app's own gate flag, normally set after approval.
 * The proxy redirects to /pending
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
    { name: "jp_has_account", value: "1", ...base },
  ]);
};
