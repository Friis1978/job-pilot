import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createInsforgeServer } from "@/lib/insforge-server";

const stripe = new Stripe(process.env.STRIPE_SK!);

export async function POST(req: NextRequest) {
  const insforge = await createInsforgeServer();
  const { data: { user } } = await insforge.auth.getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const origin = req.headers.get("origin") ?? req.headers.get("referer")?.replace(/\/$/, "") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const appUrl = origin.startsWith("http") ? new URL(origin).origin : origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: "price_1Ts4i0BVKEBQR2zbY03ZTyUc", quantity: 1 }],
    success_url: `${appUrl}/payment/success`,
    cancel_url: `${appUrl}/payment`,
    metadata: { user_id: user.id },
    customer_email: user.email,
  });

  return NextResponse.json({ url: session.url });
}
