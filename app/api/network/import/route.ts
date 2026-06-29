import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createInsforgeServer } from "@/lib/insforge-server";
import type { ParsedConnection } from "@/lib/csv-parser";

type ImportBody = {
  connections: ParsedConnection[];
  file_name: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body: ImportBody = await req.json();

    if (!Array.isArray(body.connections) || body.connections.length === 0) {
      return NextResponse.json({ success: false, error: "No connections provided" }, { status: 400 });
    }

    const insforge = await createInsforgeServer();
    const { data: { user } } = await insforge.auth.getCurrentUser();
    if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const { error: deleteError } = await insforge.database
      .from("connections")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[network/import] delete error", deleteError);
      return NextResponse.json({ success: false, error: "Failed to clear existing connections" }, { status: 500 });
    }

    const rows = body.connections.map((c) => ({
      user_id: user.id,
      first_name: c.first_name,
      last_name: c.last_name,
      linkedin_url: c.linkedin_url,
      email: c.email,
      company: c.company,
      position: c.position,
      connected_on: c.connected_on,
    }));

    const { error: insertError } = await insforge.database
      .from("connections")
      .insert(rows);

    if (insertError) {
      console.error("[network/import] insert error", insertError);
      return NextResponse.json({ success: false, error: "Failed to import connections" }, { status: 500 });
    }

    await insforge.database.from("network_imports").insert([{
      user_id: user.id,
      connection_count: body.connections.length,
      file_name: body.file_name ?? null,
    }]);

    revalidatePath("/network");
    revalidatePath("/find-jobs");

    return NextResponse.json({ success: true, count: body.connections.length });
  } catch (error) {
    console.error("[network/import]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
