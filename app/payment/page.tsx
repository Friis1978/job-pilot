import { redirect } from "next/navigation";
import { createInsforgeServer } from "@/lib/insforge-server";
import { Navbar } from "@/components/layout/Navbar";
import { PaymentClient } from "./PaymentClient";

export default async function PaymentPage() {
  const insforge = await createInsforgeServer();
  const {
    data: { user },
  } = await insforge.auth.getCurrentUser();

  if (!user) redirect("/");

  const userMeta = user.metadata as { full_name?: string; name?: string; avatar_url?: string } | null;

  const [profileRes, paymentsRes] = await Promise.all([
    insforge.database
      .from("profiles")
      .select("avatar_url, is_admin, credit_balance_usd")
      .eq("id", user.id)
      .single(),
    insforge.database
      .from("payments")
      .select("id, amount_usd, paid_at, stripe_session_id")
      .eq("user_id", user.id)
      .order("paid_at", { ascending: false }),
  ]);

  const profile = profileRes.data as {
    avatar_url?: string | null;
    is_admin?: boolean;
    credit_balance_usd?: number | null;
  } | null;

  const payments = (paymentsRes.data ?? []) as {
    id: string;
    amount_usd: number;
    paid_at: string;
    stripe_session_id: string;
  }[];

  const creditBalance = profile?.credit_balance_usd != null ? Number(profile.credit_balance_usd) : 0;

  // The jp_has_credit cookie cannot be stamped here — Next only permits cookie
  // writes in a Server Action or Route Handler, and doing it in this Server
  // Component threw a runtime error that blanked the whole page. PaymentClient
  // syncs it via POST /api/payment/activate instead.

  return (
    <>
      <Navbar
        user={{ name: userMeta?.full_name ?? userMeta?.name, email: user.email, avatarUrl: profile?.avatar_url ?? userMeta?.avatar_url }}
        isAdmin={profile?.is_admin ?? false}
      />
      <main className="min-h-screen bg-background">
        <div className="w-full max-w-360 mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
          <h1 className="text-xl font-semibold text-text-primary">Credits &amp; Billing</h1>
          <PaymentClient creditBalance={creditBalance} payments={payments} />
        </div>
      </main>
    </>
  );
}
