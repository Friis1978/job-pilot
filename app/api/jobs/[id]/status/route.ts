import { NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";

const VALID_STATUSES = ["saved", "applied", "interviewing", "offer", "rejected", "rejected_after_interview", "no_fit"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const insforge = await createInsforgeServer();
  const {
    data: { user },
  } = await insforge.auth.getCurrentUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const status = typeof body?.status === "string" ? body.status : "";

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await insforge.database
    .from("jobs")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update status." }, { status: 500 });
  }

  // When marking as applied, append the job's cover letter to profile examples (max 10)
  if (status === "applied") {
    const { data: job } = await insforge.database
      .from("jobs")
      .select("cover_letter")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    const coverLetter = job?.cover_letter as string | null;
    if (coverLetter?.trim()) {
      const { data: profile } = await insforge.database
        .from("profiles")
        .select("cover_letter_examples")
        .eq("id", user.id)
        .single();

      const existing = (profile?.cover_letter_examples as string[] | null) ?? [];
      if (!existing.includes(coverLetter)) {
        const updated = [coverLetter, ...existing].slice(0, 3);
        await insforge.database
          .from("profiles")
          .update({ cover_letter_examples: updated })
          .eq("id", user.id);
      }
    }
  }

  return NextResponse.json({ success: true });
}
