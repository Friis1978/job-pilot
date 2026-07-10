import { type NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@insforge/sdk/ssr";

// Dev-only route for logging in as the demo/screenshot user.
// Blocked in production by the check below.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;
  if (!email || !password) {
    return NextResponse.json({ error: "DEMO_USER_EMAIL / DEMO_USER_PASSWORD not set in .env.local" }, { status: 500 });
  }

  const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;

  const res = await fetch(`${insforgeUrl}/api/auth/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: "Login failed", detail: body }, { status: 500 });
  }

  const data = await res.json();
  if (!data.accessToken) {
    return NextResponse.json({ error: "No access token returned" }, { status: 500 });
  }

  const setCookieHeader = res.headers.get("set-cookie");
  const refreshTokenMatch = setCookieHeader?.match(/insforge_refresh_token=([^;]+)/);
  const extractedRefreshToken = refreshTokenMatch?.[1];

  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(`${origin}/dashboard`);

  response.cookies.set("jp_approved", "1", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  setAuthCookies(
    response.cookies,
    { accessToken: data.accessToken, refreshToken: extractedRefreshToken },
    {
      options: {
        accessToken: { maxAge: 60 * 60 * 24 * 7 },
        refreshToken: { maxAge: 60 * 60 * 24 * 7 },
      },
    },
  );

  return response;
}
