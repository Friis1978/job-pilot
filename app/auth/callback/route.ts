import { type NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@insforge/sdk/ssr";
import { createServerClient } from "@insforge/sdk/ssr";
import { getPostHogClient } from "@/lib/posthog-server";
import { sendPendingEmail, sendAdminNotificationEmail } from "@/lib/resend";

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

    // Check approval status and detect first login using the fresh access token.
    // createInsforgeServer() can't be used here since auth cookies aren't set yet,
    // so we create a one-off client with the token directly.
    let approvalStatus: "pending" | "approved" | "rejected" = "pending";
    let isAdmin = false;
    let creditBalance = 0;

    if (userId) {
      const tempClient = createServerClient({
        baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
        anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
        accessToken: data.accessToken,
      });

      const { data: profile } = await tempClient.database
        .from("profiles")
        .select("email, full_name, approval_status, is_admin, welcomed_at, credit_balance_usd")
        .eq("id", userId)
        .maybeSingle();

      if (profile) {
        approvalStatus = profile.approval_status as "pending" | "approved" | "rejected";
        isAdmin = profile.is_admin as boolean;
        creditBalance = Number(profile.credit_balance_usd ?? 0);

        // First login: set welcomed_at and send emails if still pending
        if (profile.welcomed_at === null) {
          await tempClient.database
            .from("profiles")
            .update({ welcomed_at: new Date().toISOString() })
            .eq("id", userId);

          if (approvalStatus === "pending") {
            await Promise.allSettled([
              sendPendingEmail(
                (profile.email as string | null) ?? "",
                (profile.full_name as string | null) ?? "there",
              ),
              sendAdminNotificationEmail(
                (profile.email as string | null) ?? "",
                (profile.full_name as string | null) ?? (profile.email as string | null) ?? "",
              ),
            ]);
          }
        }
      }
    }

    let destination: string;
    if (approvalStatus !== "approved") {
      destination = "/pending";
    } else if (creditBalance <= 0) {
      destination = "/payment";
    } else {
      destination = "/dashboard";
    }
    const response = NextResponse.redirect(`${origin}${destination}`);

    response.cookies.delete("insforge_pkce_verifier");

    response.cookies.set("jp_has_account", "1", {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
      sameSite: "lax",
    });

    // Set approval cookie — checked by proxy on every protected-route request
    if (approvalStatus === "approved") {
      response.cookies.set("jp_approved", "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days — matches token lifetime
        path: "/",
      });
    }

    // Set credit cookie — proxy gates all protected routes on this
    if (approvalStatus === "approved" && creditBalance > 0) {
      response.cookies.set("jp_has_credit", "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }

    // Set admin cookie — checked by proxy on /admin routes
    if (isAdmin) {
      response.cookies.set("jp_admin", "1", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }

    // InsForge returns the refresh token via Set-Cookie header, not in the JSON body.
    const setCookieHeader = res.headers.get("set-cookie");
    const refreshTokenMatch = setCookieHeader?.match(/insforge_refresh_token=([^;]+)/);
    const extractedRefreshToken = refreshTokenMatch?.[1];

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
  } catch {
    getPostHogClient().capture({
      distinctId: crypto.randomUUID(),
      event: "auth_failed",
      properties: { reason: "exception" },
    });
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }
}
