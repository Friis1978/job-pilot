import { complete, MODEL_FAST, type ClaudeUsage } from "@/lib/ai/claude";
import { detectLanguageName } from "@/lib/detect-language";
import { isUserKeyError } from "@/lib/ai/key-guard";

export type SummaryResult = {
  text: string | null;
  usage: ClaudeUsage | null;
  model: string;
};

const EMPTY: SummaryResult = { text: null, usage: null, model: MODEL_FAST };

/**
 * Generates a concise 8–10 bullet-point summary of a job description, written
 * in the same language as the posting.
 *
 * Runs on the fast tier: the summary is a condensation of text already in
 * front of the model, not a judgement call.
 *
 * Single source of truth: this previously existed as three near-identical
 * copies (agent/find-jobs.ts and two API routes) whose prompts were all
 * English-only, so a Danish posting was silently summarised into English.
 *
 * Returns `{ text: null }` for descriptions shorter than `minLength` or on
 * error — a missing summary is never worth failing the caller for.
 */
export async function summarizeDescription(
  description: string,
  userId: string,
  options: { minLength?: number } = {},
): Promise<SummaryResult> {
  const { minLength = 150 } = options;
  if (!description || description.length < minLength) return EMPTY;

  // Detect from the same slice that gets summarised, so the language decision
  // is made on the text the model actually reads.
  const input = description.slice(0, 5000);
  const language = detectLanguageName(input);

  try {
    const { text, usage, model } = await complete({
      userId,
      model: MODEL_FAST,
      maxTokens: 700,
      effort: "low",
      user: input,
      system: `Summarize this job description as exactly 8–10 bullet points. Each bullet must be a full, informative sentence — not a fragment. Cover all of these areas (one or two bullets each):
1. What the company does and its context
2. What the role is and who it reports to
3. Key day-to-day responsibilities (2–3 bullets)
4. Must-have qualifications or experience
5. Required technical skills or tools
6. Nice-to-have or preferred skills
7. What the company offers (culture, benefits, team)

Language: the posting is written in ${language}. Write every bullet in ${language} — do NOT translate the summary into English or any other language. Keep technical terms, tool names, product names and job titles exactly as they appear in the posting.

Return only the bullet points, each on its own line starting with "•". No intro, no headers, no trailing text.`,
    });

    return { text: text || null, usage, model };
  } catch (err) {
    // A missing summary is never worth failing the caller for — except when the
    // cause is the user's key, which every later call will hit too.
    if (isUserKeyError(err)) throw err;
    return EMPTY;
  }
}
