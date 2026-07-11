import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@insforge/sdk";

const stripe = new Stripe(process.env.STRIPE_SK!);

// Webhook handler has no user session — use anon key with SECURITY DEFINER RPC
const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    if (!userId) return NextResponse.json({ error: "No user_id in metadata" }, { status: 400 });

    const amountUsd = (session.amount_total ?? 0) / 100;

    const { error } = await insforge.database.rpc("fulfill_stripe_payment", {
      p_user_id: userId,
      p_amount: amountUsd,
      p_session_id: session.id,
    });

    if (error) {
      console.error("fulfill_stripe_payment error:", error);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
