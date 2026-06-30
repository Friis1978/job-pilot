import { createServerClient } from "@insforge/sdk/ssr";
import { cookies, headers } from "next/headers";
import type { Connection } from "@/types";

/** Fetch all connections for a user, paging in 1000-row batches to work around PostgREST's max-rows cap. */
export async function fetchAllConnections(
  insforge: Awaited<ReturnType<typeof createInsforgeServer>>,
  userId: string,
  columns = "*",
): Promise<Connection[]> {
  const PAGE = 1000;
  const all: Connection[] = [];
  let page = 0;
  while (true) {
    const from = page * PAGE;
    const to = from + PAGE - 1;
    const { data, error } = await insforge.database
      .from("connections")
      .select(columns)
      .eq("user_id", userId)
      .order("company", { ascending: true })
      .range(from, to);
    if (error || !data || data.length === 0) break;
    all.push(...(data as unknown as Connection[]));
    if (data.length < PAGE) break;
    page++;
  }
  return all;
}

export async function createInsforgeServer() {
  // Middleware forwards the validated (and potentially refreshed) access token
  // via a custom header so API route handlers always have the current token,
  // even when Next.js's cookie store still holds the pre-refresh value.
  const headerStore = await headers();
  const accessToken = headerStore.get("x-insforge-access-token");

  if (accessToken) {
    return createServerClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
      accessToken,
    });
  }

  // Fallback: no middleware token (e.g. called outside a middleware-covered route)
  const cookieStore = await cookies();
  return createServerClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
    cookies: {
      get(name: string) {
        return cookieStore.get(name);
      },
    },
  });
}
