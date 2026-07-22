import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encryption for user-supplied Anthropic API keys.
 *
 * These are billing credentials for someone else's account, so the threat model
 * is not "could another user read this" — RLS covers that — but "what does an
 * attacker get from a database dump". With the plaintext never written to
 * Postgres, the answer is nothing: BYOK_ENCRYPTION_KEY lives only in the server
 * environment, so the dump and the key have to leak together to matter.
 *
 * AES-256-GCM rather than CBC: it authenticates as well as encrypts, so a
 * tampered row fails loudly at decrypt instead of yielding plausible garbage
 * that then gets sent to Anthropic as a key.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits — the size GCM is specified for

export type EncryptedKey = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

/**
 * Read once per process, and fail loudly. A missing or wrong-length secret must
 * not degrade into "store it unencrypted" or a runtime error at the moment a
 * user submits their key.
 */
function encryptionKey(): Buffer {
  const raw = process.env.BYOK_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "BYOK_ENCRYPTION_KEY is not set — cannot store or read user API keys.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `BYOK_ENCRYPTION_KEY must be 32 bytes base64-encoded (got ${key.length}). Generate one with: openssl rand -base64 32`,
    );
  }
  return key;
}

export function encryptApiKey(plaintext: string): EncryptedKey {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptApiKey(enc: EncryptedKey): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(enc.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(enc.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(enc.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * The only part of the key that may ever leave the server. Four characters is
 * enough for a user to tell two of their own keys apart and nowhere near enough
 * to reconstruct one.
 */
export function keyHint(plaintext: string): string {
  return plaintext.slice(-4);
}

/**
 * Cheap shape check before spending a network round trip on validation.
 * Deliberately loose — Anthropic has changed key prefixes before, and rejecting
 * a working key because the format moved is worse than one wasted API call.
 */
export function looksLikeAnthropicKey(value: string): boolean {
  return /^sk-ant-\S{20,}$/.test(value.trim());
}
