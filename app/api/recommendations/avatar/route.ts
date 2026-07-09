import { NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";

export async function POST(req: NextRequest) {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const allowed = ["jpg", "jpeg", "png", "webp", "gif"];
    if (!allowed.includes(ext)) return NextResponse.json({ error: "Invalid file type." }, { status: 400 });

    const recId = formData.get("recId") as string | null;
    const path = `${authData.user.id}/rec-${recId ?? Date.now()}.${ext}`;

    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer], { type: file.type });

    await insforge.storage.from("avatars").remove(path);
    const { data: uploaded, error: uploadError } = await insforge.storage
      .from("avatars")
      .upload(path, blob);

    if (uploadError || !uploaded) {
      return NextResponse.json({ error: "Upload failed." }, { status: 500 });
    }

    return NextResponse.json({ url: uploaded.url });
  } catch (err) {
    console.error("[api/recommendations/avatar POST]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
