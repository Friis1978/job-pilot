import { type NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";

export async function POST(_request: NextRequest) {
  try {
    const insforge = await createInsforgeServer();
    const {
      data: { user },
    } = await insforge.auth.getCurrentUser();
    if (!user) return NextResponse.json({ success: false }, { status: 401 });

    await insforge.database
      .from("profiles")
      .update({ onboarding_seen: true })
      .eq("id", user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/onboarding/mark-seen]", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
