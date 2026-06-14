import { createServerClient } from "@insforge/sdk/ssr";
import { cookies, headers } from "next/headers";

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
