import { type NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@insforge/sdk/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("insforge_code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  const codeVerifier = request.cookies.get("insforge_pkce_verifier")?.value;
  if (!codeVerifier) {
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
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
    }

    const response = NextResponse.redirect(`${origin}/dashboard`);

    response.cookies.delete("insforge_pkce_verifier");

    setAuthCookies(response.cookies, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });

    return response;
  } catch {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }
}
