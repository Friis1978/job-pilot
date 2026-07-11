import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { TokenAccumulator } from "@/lib/track-tokens";
import type OpenAILib from "openai";

async function summarizeDescription(description: string, openai: OpenAI): Promise<{ text: string | null; usage: OpenAILib.CompletionUsage | null }> {
  if (!description || description.length < 150) return { text: null, usage: null };
  try {
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
    return { text: response.choices[0]?.message?.content?.trim() ?? null, usage: response.usage ?? null };
  } catch {
    return { text: null, usage: null };
  }
}

export async function POST(): Promise<NextResponse> {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = authData.user.id;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI not configured" }, { status: 503 });
    }

    const { data: jobs, error } = await insforge.database
      .from("jobs")
      .select("id, about_role")
      .eq("user_id", userId)
      .not("about_role", "is", null);

    if (error || !jobs) {
      return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const accumulator = new TokenAccumulator();

    // Process in batches of 5 to avoid rate limits
    const BATCH_SIZE = 5;
    let updated = 0;

    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
      const batch = jobs.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((job) => summarizeDescription(job.about_role as string, openai)),
      );

      await Promise.all(
        batch.map((job, idx) => {
          const { text, usage } = results[idx];
          accumulator.add(usage ?? undefined);
          if (!text) return Promise.resolve();
          return insforge.database
            .from("jobs")
            .update({ description_summary: text })
            .eq("id", job.id)
            .eq("user_id", userId);
        }),
      );

      updated += batch.filter((_, idx) => results[idx].text !== null).length;
    }

    accumulator.flush(userId, "regenerate_summaries", "gpt-4o-mini");

    return NextResponse.json({ success: true, updated, total: jobs.length });
  } catch (err) {
    console.error("[api/jobs/regenerate-summaries]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
