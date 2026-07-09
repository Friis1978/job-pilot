import { NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";

export async function GET() {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data, error } = await insforge.database
      .from("linkedin_recommendations")
      .select("*")
      .eq("user_id", authData.user.id)
      .order("recommendation_date", { ascending: false });

    if (error) return NextResponse.json({ error: "Failed to fetch recommendations." }, { status: 500 });
    return NextResponse.json({ recommendations: data ?? [] });
  } catch (err) {
    console.error("[api/recommendations GET]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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

    if (!body.recommender_name?.trim()) return NextResponse.json({ error: "Recommender name is required." }, { status: 400 });
    if (!body.recommendation_text?.trim()) return NextResponse.json({ error: "Recommendation text is required." }, { status: 400 });
    if (!body.recommendation_date) return NextResponse.json({ error: "Date is required." }, { status: 400 });

    const { data, error } = await insforge.database
      .from("linkedin_recommendations")
      .insert([{
        user_id: authData.user.id,
        recommender_name: body.recommender_name.trim(),
        recommender_title: body.recommender_title?.trim() ?? "",
        recommender_linkedin_url: body.recommender_linkedin_url?.trim() || null,
        avatar_url: body.avatar_url?.trim() || null,
        work_experience_company: body.work_experience_company?.trim() || null,
        recommendation_text: body.recommendation_text.trim(),
        recommendation_date: body.recommendation_date,
      }])
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: "Failed to save recommendation." }, { status: 500 });
    return NextResponse.json({ recommendation: data });
  } catch (err) {
    console.error("[api/recommendations POST]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
