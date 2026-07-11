import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SK!);

async function callRpc(name: string, params: Record<string, unknown>) {
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;
  const res = await fetch(`${process.env.NEXT_PUBLIC_INSFORGE_URL}/api/database/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
}

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

    await callRpc("fulfill_stripe_payment", {
      p_user_id: userId,
      p_amount: amountUsd,
      p_session_id: session.id,
    });
  }

  return NextResponse.json({ received: true });
}
