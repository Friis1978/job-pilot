import { NextResponse } from "next/server";
import { clearAuthCookies } from "@insforge/sdk/ssr";

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearAuthCookies(response.cookies);
  // Clear approval and admin cookies set by the auth callback
  response.cookies.set("jp_approved", "", { maxAge: 0, path: "/" });
  response.cookies.set("jp_admin", "", { maxAge: 0, path: "/" });
  return response;
}
