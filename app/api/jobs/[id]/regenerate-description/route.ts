import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";

async function summarizeDescription(description: string, openai: OpenAI): Promise<string | null> {
  if (!description || description.length < 50) return null;
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    max_tokens: 700,
    messages: [
      {
        role: "system",
        content: `Summarize this job description as exactly 8–10 bullet points. Each bullet must be a full, informative sentence — not a fragment. Cover all of these areas (one or two bullets each):
1. What the company does and its context
2. What the role is and who it reports to
3. Key day-to-day responsibilities (2–3 bullets)
4. Must-have qualifications or experience
5. Required technical skills or tools
6. Nice-to-have or preferred skills
7. What the company offers (culture, benefits, team)

Return only the bullet points, each on its own line starting with "•". No intro, no headers, no trailing text.`,
      },
      { role: "user", content: description.slice(0, 5000) },
    ],
  });
  return response.choices[0]?.message?.content?.trim() ?? null;
}

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
  const summary = await summarizeDescription(aboutRole, openai);

  if (!summary) {
    return NextResponse.json({ error: "Summarization failed. Please try again." }, { status: 500 });
  }

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
