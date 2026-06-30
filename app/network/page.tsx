import { redirect } from "next/navigation";
import { createInsforgeServer, fetchAllConnections } from "@/lib/insforge-server";
import { Navbar } from "@/components/layout/Navbar";
import { NetworkTabs } from "@/components/network/NetworkTabs";
import type { NetworkImport } from "@/types";

export default async function NetworkPage() {
  const insforge = await createInsforgeServer();
  const { data: { user } } = await insforge.auth.getCurrentUser();
  if (!user) redirect("/");

  const userMeta = user.metadata as { full_name?: string; name?: string; avatar_url?: string } | null;

  const [connections, importsResult, profileResult] = await Promise.allSettled([
    fetchAllConnections(insforge, user.id),
    insforge.database
      .from("network_imports")
      .select("*")
      .eq("user_id", user.id)
      .order("imported_at", { ascending: false }),
    insforge.database
      .from("profiles")
      .select("avatar_url, is_admin")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const allConnections = connections.status === "fulfilled" ? connections.value : [];
  const imports: NetworkImport[] =
    importsResult.status === "fulfilled" ? (importsResult.value.data ?? []) : [];
  const profileRow = profileResult.status === "fulfilled"
    ? (profileResult.value.data as { avatar_url?: string | null; is_admin?: boolean } | null)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        user={{ name: userMeta?.full_name ?? userMeta?.name, email: user.email, avatarUrl: profileRow?.avatar_url ?? userMeta?.avatar_url }}
        isAdmin={profileRow?.is_admin ?? false}
      />
      <main className="max-w-7xl mx-auto px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">Network</h1>
          <p className="text-sm text-text-secondary mt-1">
            {allConnections.length > 0
              ? `${allConnections.length} LinkedIn connections imported`
              : "Import your LinkedIn connections to see who you know at target companies."}
          </p>
        </div>

        <NetworkTabs connections={allConnections} imports={imports} />
      </main>
    </div>
  );
}
