import { type NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";
import { sendApprovedEmail } from "@/lib/resend";

export async function POST(request: NextRequest) {
  try {
    const insforge = await createInsforgeServer();
    const { data: { user } } = await insforge.auth.getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Verify caller is admin (RLS also enforces this, but double-check here)
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

    // Fetch target user's profile (admin RLS policy allows this)
    const { data: target } = await insforge.database
      .from("profiles")
      .select("email, full_name, approval_status")
      .eq("id", userId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }
    if (target.approval_status === "approved") {
      return NextResponse.json({ success: true }); // idempotent
    }

    const { error } = await insforge.database
      .from("profiles")
      .update({ approval_status: "approved" })
      .eq("id", userId);

    if (error) throw error;

    // Send approval email — non-fatal
    await sendApprovedEmail(
      (target.email as string | null) ?? "",
      (target.full_name as string | null) ?? "there",
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/admin/approve]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
