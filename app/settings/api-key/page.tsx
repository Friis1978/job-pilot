import { redirect } from "next/navigation";
import { createInsforgeServer } from "@/lib/insforge-server";
import { Navbar } from "@/components/layout/Navbar";
import { getKeyStatus } from "@/lib/ai/user-key";
import { ApiKeyClient } from "./ApiKeyClient";

/**
 * Replaces the old Credits page. Same shape — a single account setting reached
 * from the user menu — but the thing being managed is the user's own Anthropic
 * key rather than a prepaid balance.
 *
 * Only the key's status and last four characters cross into the client; the key
 * itself is never sent to the browser after it has been stored.
 */
export default async function ApiKeyPage() {
  const insforge = await createInsforgeServer();
  const {
    data: { user },
  } = await insforge.auth.getCurrentUser();

  if (!user) redirect("/");

  const userMeta = user.metadata as { full_name?: string; name?: string; avatar_url?: string } | null;

  const [profileRes, keyStatus] = await Promise.all([
    insforge.database.from("profiles").select("avatar_url, is_admin").eq("id", user.id).single(),
    getKeyStatus(user.id),
  ]);

  const profile = profileRes.data as { avatar_url?: string | null; is_admin?: boolean } | null;

  return (
    <>
      <Navbar
        user={{
          name: userMeta?.full_name ?? userMeta?.name,
          email: user.email,
          avatarUrl: profile?.avatar_url ?? userMeta?.avatar_url,
        }}
        isAdmin={profile?.is_admin ?? false}
      />
      <main className="min-h-screen bg-background">
        <div className="w-full max-w-360 mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">API key</h1>
            <p className="text-sm text-text-muted mt-1">
              This app runs on Claude. Add your own Anthropic key and every AI feature runs on
              your account, billed to you at Anthropic&apos;s rates.
            </p>
          </div>
          <ApiKeyClient initial={keyStatus} />
        </div>
      </main>
    </>
  );
}
