import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";
import { researchCompany } from "@/agent/research-company";

export async function POST(req: NextRequest) {
  try {
    const insforge = await createInsforgeServer();
    const {
      data: { user },
    } = await insforge.auth.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const jobId =
      typeof body?.jobId === "string" ? body.jobId.trim() : "";
    if (!jobId) {
      return NextResponse.json(
        { error: "jobId required" },
        { status: 400 },
      );
    }

    const result = await researchCompany(user.id, jobId);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Research failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, warning: result.warning ?? null });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[api/agent/research]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
