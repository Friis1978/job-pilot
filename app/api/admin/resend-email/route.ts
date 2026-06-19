import { type NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";
import { sendPendingEmail, sendApprovedEmail } from "@/lib/resend";

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

    const { data: target } = await insforge.database
      .from("profiles")
      .select("email, full_name, approval_status")
      .eq("id", userId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const email = (target.email as string | null) ?? "";
    const name = (target.full_name as string | null) ?? "there";
    const status = target.approval_status as string;

    if (status === "pending") {
      await sendPendingEmail(email, name);
    } else if (status === "approved") {
      await sendApprovedEmail(email, name);
    } else {
      return NextResponse.json({ success: false, error: "No email to send for rejected users" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/admin/resend-email]", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
