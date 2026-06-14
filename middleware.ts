import { updateSession } from "@insforge/sdk/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/profile", "/find-jobs"];

export async function middleware(request: NextRequest) {
  // Use a temporary response so updateSession can write refreshed cookies onto it.
  const tempResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  // Next.js cookie types don't perfectly match InsForge's overloaded CookieStore
  // interface, but the runtime behavior is compatible — casting to any is safe here.
  const { accessToken } = await updateSession({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requestCookies: request.cookies as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseCookies: tempResponse.cookies as any,
    options: {
      accessToken: { maxAge: 60 * 60 * 24 * 7 },   // 7 days
      refreshToken: { maxAge: 60 * 60 * 24 * 30 },  // 30 days
    },
  });

  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path),
  );

  if (isProtected && !accessToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/auth/login" && accessToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Forward the valid access token to API route handlers via a custom header.
  // Route handlers cannot reliably read cookies that middleware refreshed on the
  // response (Next.js gives them the original request cookies), so we pass the
  // token explicitly and read it in createInsforgeServer.
  const requestHeaders = new Headers(request.headers);
  if (accessToken) {
    requestHeaders.set("x-insforge-access-token", accessToken);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Copy any refreshed cookies onto the final response so the browser receives them.
  tempResponse.cookies.getAll().forEach((c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response.cookies.set(c as any);
  });

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/find-jobs/:path*",
    "/auth/login",
    "/api/:path*",
  ],
};
