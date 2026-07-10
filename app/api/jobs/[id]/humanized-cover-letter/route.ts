import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";

// POST — save humanized cover letter and add to profile examples
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params;
    const { text } = (await req.json()) as { text?: string };

    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = authData.user.id;

    // Save humanized letter to the job
    const { error: jobError } = await insforge.database
      .from("jobs")
      .update({ humanized_cover_letter: text.trim() })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (jobError) {
      return NextResponse.json({ error: "Failed to save." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[api/jobs/humanized-cover-letter POST]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
