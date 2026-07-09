import { NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params;
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data, error } = await insforge.database
      .from("jobs")
      .select("resume_text")
      .eq("id", jobId)
      .eq("user_id", authData.user.id)
      .single();

    if (error || !data) return NextResponse.json({ error: "Not found." }, { status: 404 });

    return NextResponse.json({ resumeText: (data as { resume_text?: string | null }).resume_text ?? null });
  } catch (err) {
    console.error("[api/jobs/tailored-resume/text GET]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
