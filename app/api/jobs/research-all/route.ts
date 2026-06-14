import { NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";
import { researchCompany } from "@/agent/research-company";

export const maxDuration = 300; // 5 minutes

export async function POST() {
  const insforge = await createInsforgeServer();
  const {
    data: { user },
  } = await insforge.auth.getCurrentUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only jobs that haven't been researched yet
  const { data: jobs, error: jobsError } = await insforge.database
    .from("jobs")
    .select("id, company")
    .eq("user_id", user.id)
    .is("researched_at", null);

  if (jobsError) {
    return NextResponse.json({ error: "Failed to load jobs." }, { status: 500 });
  }

  if (!jobs?.length) {
    return NextResponse.json({ researched: 0, skipped: 0, failed: 0, total: 0 });
  }

  let researched = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const result = await researchCompany(user.id, job.id);
      if (result.success) {
        researched++;
      } else {
        failed++;
        console.warn(`[research-all] failed for ${job.company}: ${result.error}`);
      }
    } catch (err) {
      failed++;
      console.error(`[research-all] threw for ${job.company}:`, err);
    }
  }

  return NextResponse.json({ researched, failed, total: jobs.length });
}
