import { NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";
import { generateLinkedInMessage } from "@/agent/linkedin-message";
import type { Connection } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { contact, jobTitle, company } = await req.json() as {
      contact: Pick<Connection, "first_name" | "last_name" | "position" | "company">;
      jobTitle: string;
      company: string;
    };

    if (!contact || !jobTitle || !company) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const insforge = await createInsforgeServer();
    const { data: { user } } = await insforge.auth.getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { data: profileData } = await insforge.database
      .from("profiles")
      .select("full_name, current_title, skills, years_experience, cover_letter_tone")
      .eq("id", user.id)
      .single();

    const result = await generateLinkedInMessage({
      contact,
      jobTitle,
      company,
      profile: profileData ?? { full_name: null, current_title: null, skills: null, years_experience: null },
      tone: profileData?.cover_letter_tone ?? "professional",
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[agent/linkedin-message]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
