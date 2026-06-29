import { NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";
import { suggestBestContact } from "@/agent/suggest-contact";
import type { Connection } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { jobTitle, company, connections } = await req.json() as {
      jobTitle: string;
      company: string;
      connections: Connection[];
    };

    if (!jobTitle || !company || !Array.isArray(connections) || connections.length === 0) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const insforge = await createInsforgeServer();
    const { data: { user } } = await insforge.auth.getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { data: profileData } = await insforge.database
      .from("profiles")
      .select("full_name, current_title, skills")
      .eq("id", user.id)
      .single();

    const result = await suggestBestContact({
      jobTitle,
      company,
      connections,
      profile: profileData ?? { full_name: null, current_title: null, skills: null },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[agent/suggest-contact]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
