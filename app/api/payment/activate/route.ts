import { NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";

// Called by the payment success page to set jp_has_credit cookie after Stripe confirms payment.
export async function POST() {
  const insforge = await createInsforgeServer();
  const { data: { user } } = await insforge.auth.getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await insforge.database
    .from("profiles")
    .select("credit_balance_usd")
    .eq("id", user.id)
    .maybeSingle();

  const balance = Number(profile?.credit_balance_usd ?? 0);
  if (balance <= 0) {
    return NextResponse.json({ error: "No credit yet — webhook may still be processing" }, { status: 402 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("jp_has_credit", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return response;
}
