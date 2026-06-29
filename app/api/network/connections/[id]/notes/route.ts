import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createInsforgeServer } from "@/lib/insforge-server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { notes } = await req.json() as { notes: string };

    const insforge = await createInsforgeServer();
    const { data: { user } } = await insforge.auth.getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { error } = await insforge.database
      .from("connections")
      .update({ notes: notes || null })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("[network/connections/notes]", error);
      return NextResponse.json({ success: false, error: "Failed to update notes" }, { status: 500 });
    }

    revalidatePath("/network");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[network/connections/notes]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
