/**
 * Strips Anthropic API keys out of anything on its way to a third party.
 *
 * Users supply their own keys, so a key appearing in an error report is not a
 * config leak — it is one user's billing credential sitting in a service that
 * neither they nor we intended to send it to. Anthropic SDK errors do not
 * normally carry the key, but they do carry request context, and several call
 * sites attach their own `extra` payloads to Sentry. Redacting centrally is the
 * only version of this that stays true as call sites are added.
 *
 * Matches the key shape rather than a known value: the key we must not leak
 * belongs to a user and is not in this process's environment.
 */

// sk-ant- followed by the key body. Non-greedy on length so it stops at
// whitespace, quotes, or punctuation rather than swallowing the rest of a line.
const ANTHROPIC_KEY = /sk-ant-[A-Za-z0-9_-]{8,}/g;

export function redactKeys(value: string): string {
  return value.replace(ANTHROPIC_KEY, "sk-ant-[REDACTED]");
}

/**
 * Walks an arbitrary structure and redacts every string in it.
 *
 * Depth-limited and cycle-safe: this runs inside an error handler, where an
 * infinite loop would turn a recoverable failure into a hung request.
 */
export function redactDeep<T>(input: T, depth = 0, seen = new WeakSet<object>()): T {
  if (depth > 8) return input;
  if (typeof input === "string") return redactKeys(input) as T;
  if (input === null || typeof input !== "object") return input;

  if (seen.has(input as object)) return input;
  seen.add(input as object);

  if (Array.isArray(input)) {
    return input.map((item) => redactDeep(item, depth + 1, seen)) as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
    out[key] = redactDeep(val, depth + 1, seen);
  }
  return out as T;
}
