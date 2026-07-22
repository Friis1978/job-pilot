import { createInsforgeServer } from "@/lib/insforge-server";
import { decryptApiKey, type EncryptedKey } from "@/lib/ai/byok";

export type KeyStatus = {
  hasKey: boolean;
  keyHint: string | null;
  status: "active" | "invalid" | null;
  lastVerifiedAt: string | null;
};

/**
 * Resolves the calling user's own Anthropic key.
 *
 * Cached in-process for a short window because a single user action fans out:
 * one job search scores twenty postings in parallel and summarises each one.
 * Without this, every one of those calls would make its own round trip to
 * Postgres and its own AES decrypt before it could start.
 *
 * The TTL is short and the cache is per-instance, so removing or replacing a
 * key takes effect quickly everywhere; `clearCachedKey` makes it immediate on
 * the instance that handled the change.
 */
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { key: string; expires: number }>();

export function clearCachedKey(userId: string): void {
  cache.delete(userId);
}

export async function getUserApiKey(userId: string): Promise<string | null> {
  const hit = cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.key;

  const insforge = await createInsforgeServer();
  const { data, error } = await insforge.database
    .from("user_ai_keys")
    .select("ciphertext, iv, auth_tag, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as { ciphertext: string; iv: string; auth_tag: string; status: string };
  // A key already known to be rejected is not worth decrypting and spending a
  // request on — the caller should be told to fix it instead.
  if (row.status !== "active") return null;

  let plaintext: string;
  try {
    plaintext = decryptApiKey({
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.auth_tag,
    } satisfies EncryptedKey);
  } catch {
    // Wrong or rotated BYOK_ENCRYPTION_KEY, or a tampered row. Deliberately not
    // reported with the row contents attached — there is nothing here a log can
    // safely carry.
    console.error("[byok] could not decrypt stored key for user", userId);
    return null;
  }

  cache.set(userId, { key: plaintext, expires: Date.now() + CACHE_TTL_MS });
  return plaintext;
}

/** Everything the UI is allowed to know about a stored key. Never the key. */
export async function getKeyStatus(userId: string): Promise<KeyStatus> {
  const insforge = await createInsforgeServer();
  const { data } = await insforge.database
    .from("user_ai_keys")
    .select("key_hint, status, last_verified_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return { hasKey: false, keyHint: null, status: null, lastVerifiedAt: null };

  const row = data as { key_hint: string; status: "active" | "invalid"; last_verified_at: string | null };
  return {
    hasKey: true,
    keyHint: row.key_hint,
    status: row.status,
    lastVerifiedAt: row.last_verified_at,
  };
}

/**
 * Records that Anthropic rejected the stored key, so the next request can fail
 * with "your key stopped working" rather than repeating the same opaque error.
 */
export async function markKeyInvalid(userId: string): Promise<void> {
  clearCachedKey(userId);
  const insforge = await createInsforgeServer();
  await insforge.database
    .from("user_ai_keys")
    .update({ status: "invalid", updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}
