import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createInsforgeServer } from "@/lib/insforge-server";
import { findJobs } from "@/agent/find-jobs";

export const maxDuration = 300;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } =
      await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = authData.user.id;

    const body = await req.json();
    const { jobTitle, location, minScore } = body as {
      jobTitle: unknown;
      location: unknown;
      minScore: unknown;
    };

    if (!jobTitle || typeof jobTitle !== "string" || !jobTitle.trim()) {
      return NextResponse.json(
        { error: "Job title is required." },
        { status: 400 },
      );
    }

    const parsedMinScore =
      typeof minScore === "number" && minScore >= 50 && minScore <= 100
        ? minScore
        : undefined;

    const result = await findJobs(
      userId,
      jobTitle.trim(),
      typeof location === "string" ? location.trim() : "",
      parsedMinScore,
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Something went wrong. Please try again." },
        { status: 500 },
      );
    }

    await insforge.database.from("job_searches").insert([
      { user_id: userId, job_title: jobTitle.trim(), location: typeof location === "string" ? location.trim() : "" },
    ]);

    revalidatePath("/dashboard");
    revalidatePath("/find-jobs");
    return NextResponse.json({
      data: { jobsFound: result.jobsFound, jobsSaved: result.jobsSaved, jobsSkipped: result.jobsSkipped },
    });
  } catch (err) {
    console.error("[api/agent/find]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
