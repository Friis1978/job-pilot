import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { TokenAccumulator } from "@/lib/track-tokens";
import { summarizeDescription } from "@/lib/summarize-description";

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
