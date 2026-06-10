import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createInsforgeServer } from "@/lib/insforge-server";
import { generateCoverLetter } from "@/agent/generate-cover-letter";

export async function POST(req: NextRequest) {
  try {
    const insforge = await createInsforgeServer();
    const {
      data: { user },
    } = await insforge.auth.getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

    const result = await generateCoverLetter(user.id, jobId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    revalidatePath(`/find-jobs/${jobId}`);
    revalidatePath("/dashboard");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/agent/cover-letter]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
