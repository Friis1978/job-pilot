import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { AdminUsersTable } from "@/components/admin/AdminUsersTable";
import { createInsforgeServer } from "@/lib/insforge-server";

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
};

export default async function AdminPage() {
  const insforge = await createInsforgeServer();
  const { data: authData } = await insforge.auth.getCurrentUser();

  if (!authData?.user) redirect("/");

  // Verify admin status server-side (proxy also enforces this via jp_admin cookie)
  const { data: callerProfile } = await insforge.database
    .from("profiles")
    .select("is_admin, full_name, avatar_url, email")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!callerProfile?.is_admin) redirect("/dashboard");

  const { data: users } = await insforge.database
    .from("profiles")
    .select("id, email, full_name, approval_status, created_at")
    .order("created_at", { ascending: false });

  const pending = (users ?? []).filter((u) => u.approval_status === "pending").length;

  const userMeta = (authData.user?.metadata ?? null) as {
    full_name?: string;
    name?: string;
    avatar_url?: string;
  } | null;

  return (
    <>
      <Navbar
        user={{
          name: callerProfile.full_name ?? userMeta?.full_name ?? userMeta?.name,
          email: authData.user.email,
          avatarUrl: callerProfile.avatar_url ?? userMeta?.avatar_url ?? null,
        }}
        isAdmin={true}
      />
      <main className="min-h-screen bg-background py-8">
        <div className="w-full max-w-360 mx-auto px-4 sm:px-6 flex flex-col gap-6 pb-12">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">Admin</h1>
              <p className="text-sm text-text-secondary mt-0.5">
                {pending > 0
                  ? `${pending} user${pending === 1 ? "" : "s"} pending approval`
                  : "No pending approvals"}
              </p>
            </div>
          </div>

          <AdminUsersTable users={(users ?? []) as AdminUser[]} />
        </div>
      </main>
    </>
  );
}
