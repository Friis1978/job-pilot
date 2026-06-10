import { NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";

export async function DELETE() {
  const insforge = await createInsforgeServer();
  const {
    data: { user },
  } = await insforge.auth.getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await insforge.database
    .from("jobs")
    .delete()
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to clear jobs. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
