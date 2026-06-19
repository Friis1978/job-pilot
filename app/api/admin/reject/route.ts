import { type NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";

export async function POST(request: NextRequest) {
  try {
    const insforge = await createInsforgeServer();
    const { data: { user } } = await insforge.auth.getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: caller } = await insforge.database
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (!caller?.is_admin) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body as { userId?: string };
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ success: false, error: "Invalid userId" }, { status: 400 });
    }

    const { error } = await insforge.database
      .from("profiles")
      .update({ approval_status: "rejected" })
      .eq("id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/admin/reject]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
