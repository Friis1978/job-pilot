import type OpenAI from "openai";
import type OpenAILib from "openai";
import { detectLanguageName } from "@/lib/detect-language";

export type SummaryResult = {
  text: string | null;
  usage: OpenAILib.CompletionUsage | null;
};

const EMPTY: SummaryResult = { text: null, usage: null };

/**
 * Generates a concise 8–10 bullet-point summary of a job description using
 * gpt-4o-mini, written in the same language as the posting.
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
  openai: OpenAI,
  options: { minLength?: number } = {},
): Promise<SummaryResult> {
  const { minLength = 150 } = options;
  if (!description || description.length < minLength) return EMPTY;

  // Detect from the same slice that gets summarised, so the language decision
  // is made on the text the model actually reads.
  const input = description.slice(0, 5000);
  const language = detectLanguageName(input);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: `Summarize this job description as exactly 8–10 bullet points. Each bullet must be a full, informative sentence — not a fragment. Cover all of these areas (one or two bullets each):
1. What the company does and its context
2. What the role is and who it reports to
3. Key day-to-day responsibilities (2–3 bullets)
4. Must-have qualifications or experience
5. Required technical skills or tools
6. Nice-to-have or preferred skills
7. What the company offers (culture, benefits, team)

Language: the posting is written in ${language}. Write every bullet in ${language} — do NOT translate the summary into English or any other language. Keep technical terms, tool names, product names and job titles exactly as they appear in the posting.

Return only the bullet points, each on its own line starting with "•". No intro, no headers, no trailing text.`,
        },
        { role: "user", content: input },
      ],
    });

    return {
      text: response.choices[0]?.message?.content?.trim() ?? null,
      usage: response.usage ?? null,
    };
  } catch {
    return EMPTY;
  }
}
