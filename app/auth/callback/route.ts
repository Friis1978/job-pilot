import { type NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@insforge/sdk/ssr";
import { getPostHogClient } from "@/lib/posthog-server";

function getSubFromJwt(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("insforge_code");
  const error = searchParams.get("error");

  if (error || !code) {
    getPostHogClient().capture({
      distinctId: crypto.randomUUID(),
      event: "auth_failed",
      properties: { reason: "missing_code", error: error ?? undefined },
    });
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  const codeVerifier = request.cookies.get("insforge_pkce_verifier")?.value;
  if (!codeVerifier) {
    getPostHogClient().capture({
      distinctId: crypto.randomUUID(),
      event: "auth_failed",
      properties: { reason: "missing_pkce_verifier" },
    });
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/auth/oauth/exchange`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY}`,
        },
        body: JSON.stringify({ code, code_verifier: codeVerifier }),
      }
    );

    const data = await res.json();

    if (!res.ok || !data.accessToken) {
      getPostHogClient().capture({
        distinctId: crypto.randomUUID(),
        event: "auth_failed",
        properties: { reason: "exchange_failed" },
      });
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
    }

    const userId = getSubFromJwt(data.accessToken);
    if (userId) {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: userId,
        event: "user_signed_in",
        properties: { method: "oauth" },
      });
      posthog.identify({ distinctId: userId });
    }

    const response = NextResponse.redirect(`${origin}/dashboard`);

    response.cookies.delete("insforge_pkce_verifier");

    response.cookies.set("jp_has_account", "1", {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
      sameSite: "lax",
    });

    setAuthCookies(
      response.cookies,
      { accessToken: data.accessToken, refreshToken: data.refreshToken },
      {
        options: {
          accessToken: { maxAge: 60 * 60 * 24 * 7 },   // 7 days
          refreshToken: { maxAge: 60 * 60 * 24 * 30 },  // 30 days
        },
      },
    );

    return response;
  } catch {
    getPostHogClient().capture({
      distinctId: crypto.randomUUID(),
      event: "auth_failed",
      properties: { reason: "exception" },
    });
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }
}
