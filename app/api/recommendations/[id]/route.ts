import { NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = (await req.json()) as {
      recommender_name?: string;
      recommender_title?: string;
      recommender_linkedin_url?: string;
      avatar_url?: string;
      work_experience_company?: string;
      recommendation_text?: string;
      recommendation_date?: string;
    };

    const update: Record<string, string | null> = {};
    if (typeof body.recommender_name === "string") update.recommender_name = body.recommender_name.trim();
    if (typeof body.recommender_title === "string") update.recommender_title = body.recommender_title.trim();
    if (typeof body.recommender_linkedin_url === "string") update.recommender_linkedin_url = body.recommender_linkedin_url.trim() || null;
    if (typeof body.avatar_url === "string") update.avatar_url = body.avatar_url.trim() || null;
    if (typeof body.work_experience_company === "string") update.work_experience_company = body.work_experience_company.trim() || null;
    if (typeof body.recommendation_text === "string") update.recommendation_text = body.recommendation_text.trim();
    if (typeof body.recommendation_date === "string") update.recommendation_date = body.recommendation_date;

    const { data, error } = await insforge.database
      .from("linkedin_recommendations")
      .update(update)
      .eq("id", id)
      .eq("user_id", authData.user.id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: "Failed to update recommendation." }, { status: 500 });
    return NextResponse.json({ recommendation: data });
  } catch (err) {
    console.error("[api/recommendations/[id] PATCH]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { error } = await insforge.database
      .from("linkedin_recommendations")
      .delete()
      .eq("id", id)
      .eq("user_id", authData.user.id);

    if (error) return NextResponse.json({ error: "Failed to delete recommendation." }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/recommendations/[id] DELETE]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
