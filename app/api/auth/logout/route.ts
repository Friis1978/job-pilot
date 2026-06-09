import { NextResponse } from "next/server";
import { clearAuthCookies } from "@insforge/sdk/ssr";

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearAuthCookies(response.cookies);
  return response;
}
