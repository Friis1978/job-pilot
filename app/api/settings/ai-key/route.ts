import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createInsforgeServer } from "@/lib/insforge-server";
import { encryptApiKey, keyHint, looksLikeAnthropicKey } from "@/lib/ai/byok";
import { clearCachedKey, getKeyStatus } from "@/lib/ai/user-key";
import { MODEL_FAST, MODEL_SMART } from "@/lib/ai/claude";

/**
 * The user's own Anthropic key: check status, save, remove.
 *
 * The key is write-only across this boundary. GET returns whether one exists
 * and its last four characters; nothing here ever returns the key itself, so a
 * compromised session cannot be used to read it back out.
 */

async function requireUser() {
  const insforge = await createInsforgeServer();
  const { data, error } = await insforge.auth.getCurrentUser();
  if (error || !data?.user) return null;
  return { insforge, userId: data.user.id };
}

/**
 * Guarantees a JSON body on every path, including thrown errors.
 *
 * Without this, an exception (a missing BYOK_ENCRYPTION_KEY, an InsForge
 * network blip, a DB error) returns Next's default empty 500. The client then
 * calls res.json() on an empty body and the user sees "Unexpected end of JSON
 * input" — a parser error standing in for whatever actually went wrong. Wrapped,
 * the same failure arrives as a message they can read.
 */
async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    console.error("[api/settings/ai-key]", err);
    return NextResponse.json(
      { error: "Something went wrong handling your API key. Please try again." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    return NextResponse.json(await getKeyStatus(auth.userId));
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { apiKey?: string } | null;
  const apiKey = body?.apiKey?.trim();

  if (!apiKey) {
    return NextResponse.json({ error: "Enter your Anthropic API key." }, { status: 400 });
  }
  if (!looksLikeAnthropicKey(apiKey)) {
    return NextResponse.json(
      { error: "That does not look like an Anthropic API key. It should start with sk-ant-." },
      { status: 400 },
    );
  }

  // Verify before storing. models.list() costs no tokens, so an invalid key is
  // rejected at the point the user can still fix it, rather than surfacing
  // later as a failed job search.
  let available: string[];
  try {
    const probe = new Anthropic({ apiKey });
    const models = await probe.models.list({ limit: 100 });
    available = models.data.map((m) => m.id);
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 401) {
      return NextResponse.json(
        { error: "Anthropic rejected this key. Check you copied all of it, and that it has not been revoked." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Could not reach Anthropic to verify the key. Try again in a moment." },
      { status: 502 },
    );
  }

  // Having a valid key is not the same as being able to use this app: access is
  // per-model, so check the two it actually calls rather than discovering the
  // gap on the user's first job search.
  //
  // Prefix match, not equality: the API lists some models under their dated ID
  // and others under the bare alias — claude-sonnet-5 comes back as-is, while
  // claude-haiku-4-5 comes back as claude-haiku-4-5-20251001. An exact match
  // rejects every valid key, which would make it impossible to onboard at all.
  const missing = [MODEL_SMART, MODEL_FAST].filter(
    (m) => !available.some((id) => id === m || id.startsWith(`${m}-`)),
  );
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `This key works, but has no access to ${missing.join(" or ")}, which this app needs. Check your Anthropic plan or workspace permissions.`,
      },
      { status: 400 },
    );
  }

  const enc = encryptApiKey(apiKey);
  const now = new Date().toISOString();
  const { error } = await auth.insforge.database.from("user_ai_keys").upsert(
    [
      {
        user_id: auth.userId,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        auth_tag: enc.authTag,
        key_hint: keyHint(apiKey),
        status: "active",
        last_verified_at: now,
        updated_at: now,
      },
    ],
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.json({ error: "Could not save the key. Please try again." }, { status: 500 });
  }

  // A replaced key must not keep serving the old one from the resolver cache.
  clearCachedKey(auth.userId);

  return NextResponse.json(await getKeyStatus(auth.userId));
  });
}

export async function DELETE() {
  return handle(async () => {
    const auth = await requireUser();
    if (!auth) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { error } = await auth.insforge.database
      .from("user_ai_keys")
      .delete()
      .eq("user_id", auth.userId);

    if (error) {
      return NextResponse.json({ error: "Could not remove the key. Please try again." }, { status: 500 });
    }

    clearCachedKey(auth.userId);
    return NextResponse.json({ hasKey: false, keyHint: null, status: null, lastVerifiedAt: null });
  });
}
