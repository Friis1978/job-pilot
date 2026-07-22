import Anthropic from "@anthropic-ai/sdk";

/**
 * Single entry point for every AI call in the app.
 *
 * All features run on Claude. Previously they were split across two providers —
 * gpt-4o for scoring/extraction, Claude for cover letters and resumes — which
 * meant two API keys, two billing accounts, two sets of request shapes and two
 * places to change a model. One provider, one place.
 *
 * Two model tiers, so a model change is a one-line edit here rather than a
 * sweep through twenty-odd call sites:
 *   MODEL_SMART — judgement and writing (scoring, cover letters, research)
 *   MODEL_FAST  — mechanical work where the answer is already in the input
 *                 (summarising, reformatting)
 */
export const MODEL_SMART = "claude-sonnet-5";
export const MODEL_FAST = "claude-haiku-4-5";

/**
 * `effort` is not accepted by every model — Haiku 4.5 rejects it outright with
 * "This model does not support the effort parameter", which would 400 every
 * fast-tier call. Sending it only where it is supported keeps callers free to
 * pass an effort hint without having to know which tier they landed on.
 */
const MODELS_WITH_EFFORT = new Set([MODEL_SMART]);

export type ClaudeUsage = { input_tokens: number; output_tokens: number };

export type CompleteOptions = {
  system: string;
  /** Shorthand for a single user turn. Use `messages` for multi-turn. */
  user?: string;
  messages?: Anthropic.MessageParam[];
  model?: string;
  maxTokens: number;
  /**
   * Thinking depth and overall token spend. Extraction tasks (the answer is in
   * the input) do well at "low"; judgement calls want "medium" or "high".
   */
  effort?: "low" | "medium" | "high";
  /**
   * Adaptive thinking. Off by default — most calls here are extraction.
   *
   * Always sent explicitly rather than left to the model's default, which is
   * not the same across models: Sonnet 5 runs adaptive thinking when `thinking`
   * is omitted, where Opus 4.8 runs without it. Thinking tokens count against
   * `max_tokens`, so on the tighter budgets here (100 for a URL lookup, 500 for
   * a score) an unrequested thinking pass could truncate the answer.
   */
  thinking?: boolean;
  /**
   * JSON Schema the response must satisfy. When set, the API constrains the
   * output and parsing cannot fail on a malformed shape. Objects need
   * `additionalProperties: false` and a `required` array.
   */
  schema?: Record<string, unknown>;
  /**
   * Whose Anthropic account pays for this call. With a userId, the caller's own
   * stored key is used and Anthropic bills them directly; without one, the
   * platform key is used. Pass it wherever it is available.
   */
  userId?: string;
};

/**
 * Raised when a user's own key is the thing that failed, as opposed to the
 * request being wrong or Anthropic being down. Callers surface this to the user
 * as "fix your key" — it is the one AI failure they can actually act on.
 */
export class UserKeyError extends Error {
  constructor(
    message: string,
    readonly reason: "missing" | "rejected",
  ) {
    super(message);
    this.name = "UserKeyError";
  }
}

let platformClient: Anthropic | null = null;

/**
 * Throws when ANTHROPIC_API_KEY is unset rather than returning a client that
 * fails later with a 401 — the missing-config case is worth naming.
 */
export function getClaude(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI is not configured (missing ANTHROPIC_API_KEY).");
  }
  platformClient ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return platformClient;
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Shown wherever a user hits an AI feature without a usable key. */
export const MISSING_KEY_MESSAGE =
  "Add your Anthropic API key to use AI features. Every AI feature in this app runs on your own Anthropic account.";

/**
 * Picks the client for a call.
 *
 * A user-attributed call must use that user's own key — there is deliberately
 * no fall back to the platform key. Falling back would mean the owner silently
 * paying for anyone who never set a key, and the user would have no signal that
 * the thing they were asked to configure is not actually in use.
 *
 * The platform key is still reachable for calls with no user attached (there
 * are none in the product today; it exists so an internal or scripted call does
 * not have to invent a user).
 *
 * User clients are constructed per call rather than cached. The decrypted key
 * is already cached upstream, so the saving would be a few microseconds of
 * object construction, and a keyed client cache is a map of live credentials
 * held indefinitely — not worth it for that.
 */
async function clientFor(userId: string | undefined): Promise<Anthropic> {
  if (!userId) return getClaude();

  const { getUserApiKey } = await import("@/lib/ai/user-key");
  const userKey = await getUserApiKey(userId);
  if (!userKey) throw new UserKeyError(MISSING_KEY_MESSAGE, "missing");

  return new Anthropic({ apiKey: userKey });
}

/**
 * Turns an Anthropic failure into a `UserKeyError` when the user's own key is
 * what went wrong, so the caller can tell them to fix it.
 *
 * Only the two statuses that mean "this credential is the problem" are
 * translated. A 429 is deliberately left alone: on a user's own key that means
 * they are sending too fast, which resolves by waiting, and dressing it up as a
 * key problem would send them off to rotate a key that is fine.
 */
async function translateKeyError(err: unknown, userId: string | undefined): Promise<unknown> {
  if (!userId) return err;

  const status = (err as { status?: number })?.status;
  if (status !== 401 && status !== 403) return err;

  const { getUserApiKey, markKeyInvalid } = await import("@/lib/ai/user-key");
  // Only blame the user's key if it was actually the one used — a 401 on the
  // platform key is our problem, not theirs.
  if (!(await getUserApiKey(userId))) return err;

  await markKeyInvalid(userId);
  return new UserKeyError(
    status === 401
      ? "Your Anthropic API key was rejected. It may have been revoked or expired — add a new one to continue."
      : "Your Anthropic API key does not have access to the models this app uses. Check the key's permissions, or create a new one.",
    "rejected",
  );
}

/**
 * One completion, returning plain text.
 *
 * Note there is no `temperature` — Sonnet 5 rejects sampling parameters with a
 * 400. Determinism and creative variance are both steered through the prompt
 * and `effort` now.
 */
export async function complete(
  opts: CompleteOptions,
): Promise<{ text: string; usage: ClaudeUsage; model: string }> {
  const {
    system,
    user,
    messages,
    model = MODEL_SMART,
    maxTokens,
    effort = "medium",
    thinking = false,
    schema,
    userId,
  } = opts;

  const turns: Anthropic.MessageParam[] =
    messages ?? [{ role: "user", content: user ?? "" }];

  const outputConfig = {
    ...(MODELS_WITH_EFFORT.has(model) ? { effort } : {}),
    ...(schema ? { format: { type: "json_schema" as const, schema } } : {}),
  };

  const params: Anthropic.MessageCreateParams = {
    model,
    system,
    max_tokens: maxTokens,
    messages: turns,
    ...(Object.keys(outputConfig).length > 0 ? { output_config: outputConfig } : {}),
    thinking: thinking ? { type: "adaptive" } : { type: "disabled" },
  };

  const anthropic = await clientFor(userId);

  let response;
  try {
    // Above ~8k output tokens a non-streaming request risks an SDK HTTP timeout.
    response =
      maxTokens > 8000
        ? await anthropic.messages.stream(params).finalMessage()
        : await anthropic.messages.create(params);
  } catch (err) {
    throw await translateKeyError(err, userId);
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  return {
    text,
    usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
    model,
  };
}

/**
 * Pulls a JSON object out of a model response.
 *
 * Belt and braces even when a schema is supplied: without one the model may
 * wrap the object in a markdown fence or add a sentence before it, and a
 * failed parse should not take down the caller.
 */
export function parseJson<T>(raw: string): T | null {
  if (!raw) return null;
  const unfenced = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(unfenced) as T;
  } catch {
    // Fall back to the outermost braces, for the case where the model added
    // prose around an otherwise valid object.
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(unfenced.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}

/**
 * One completion, parsed as JSON. `data` is null when the model returned
 * something unparseable — callers decide whether that is fatal.
 *
 * Usage is returned even on a parse failure so the tokens still get billed to
 * the user who spent them.
 */
export async function completeJson<T>(
  opts: CompleteOptions,
): Promise<{ data: T | null; text: string; usage: ClaudeUsage; model: string }> {
  const result = await complete(opts);
  return { ...result, data: parseJson<T>(result.text) };
}
