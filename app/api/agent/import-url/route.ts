import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createInsforgeServer } from "@/lib/insforge-server";
import { importJobFromUrl } from "@/agent/import-job-from-url";

export async function POST(req: NextRequest) {
  try {
    const insforge = await createInsforgeServer();
    const {
      data: { user },
    } = await insforge.auth.getCurrentUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";

    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "A valid URL is required." }, { status: 400 });
    }

    const result = await importJobFromUrl(user.id, url);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    revalidatePath("/find-jobs");
    revalidatePath("/dashboard");

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/agent/import-url]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
