import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { trackTokens } from "@/lib/track-tokens";
import { summarizeDescription } from "@/lib/summarize-description";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const insforge = await createInsforgeServer();
  const { data: { user } } = await insforge.auth.getCurrentUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI not configured." }, { status: 503 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // minLength 50: the user asked for this one explicitly, so summarise even a
  // short posting rather than silently returning nothing.
  const { text: summary, usage } = await summarizeDescription(aboutRole, openai, { minLength: 50 });

  if (!summary) {
    return NextResponse.json({ error: "Summarization failed. Please try again." }, { status: 500 });
  }

  trackTokens(
    user.id,
    "regenerate_description",
    "gpt-4o-mini",
    usage?.prompt_tokens ?? 0,
    usage?.completion_tokens ?? 0,
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
