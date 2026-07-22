import { NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";
import { isClaudeConfigured } from "@/lib/ai/claude";
import { trackTokens } from "@/lib/track-tokens";
import { summarizeDescription } from "@/lib/summarize-description";
import { keyGuard } from "@/lib/ai/key-guard";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const insforge = await createInsforgeServer();
  const { data: { user } } = await insforge.auth.getCurrentUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


  const keyBlocked = await keyGuard(user.id);

  if (keyBlocked) return keyBlocked;

  const { data: jobData, error: jobError } = await insforge.database
    .from("jobs")
    .select("id, about_role")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (jobError || !jobData) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const aboutRole = jobData.about_role as string | null;
  if (!aboutRole) {
    return NextResponse.json({ error: "No job description available to summarize." }, { status: 400 });
  }

  if (!isClaudeConfigured()) {
    return NextResponse.json({ error: "AI is not configured." }, { status: 503 });
  }

  // minLength 50: the user asked for this one explicitly, so summarise even a
  // short posting rather than silently returning nothing.
  const { text: summary, usage, model } = await summarizeDescription(aboutRole, user.id, { minLength: 50 });

  if (!summary) {
    return NextResponse.json({ error: "Summarization failed. Please try again." }, { status: 500 });
  }

  trackTokens(
    user.id,
    "regenerate_description",
    model,
    usage?.input_tokens ?? 0,
    usage?.output_tokens ?? 0,
  );

  const { error: updateError } = await insforge.database
    .from("jobs")
    .update({ description_summary: summary })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to save summary." }, { status: 500 });
  }

  return NextResponse.json({ success: true, description_summary: summary });
}
