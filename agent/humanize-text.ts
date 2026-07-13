import OpenAI from "openai";
import { trackTokens } from "@/lib/track-tokens";

const SAPLING_URL = "https://api.sapling.ai/api/v1/aidetect";

interface SaplingResponse {
  score: number;
  sentence_scores: { sentence: string; score: number }[];
}

async function getSaplingResult(text: string): Promise<SaplingResponse | null> {
  const apiKey = process.env.SAPLING_API_KEY;
  if (!apiKey) { console.warn("[sapling] SAPLING_API_KEY not set"); return null; }
  try {
    const res = await fetch(SAPLING_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey, text, sent_scores: true }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[sapling] HTTP ${res.status}:`, body.slice(0, 200));
      return null;
    }
    return await res.json() as SaplingResponse;
  } catch (err) {
    console.warn("[sapling] fetch error:", err);
    return null;
  }
}

// Aggressive full rewrite — used when overall AI score is very high (>0.85)
const AGGRESSIVE_REWRITE_SYSTEM = `You are a professional editor. Rewrite this cover letter so it reads as written by a human, not AI.

Rules:
- Keep all facts, names, technologies, dates, and claims exactly intact
- Do NOT add or remove paragraphs or change the greeting/closing lines
- Break every three-part list ("X, Y, and Z") into two separate statements
- Vary sentence openings — no two consecutive sentences should start the same way
- Mix short sentences (under 12 words) with longer ones — avoid uniform length throughout
- Cut any sentence that could appear in any cover letter unchanged ("With a solid foundation...", "My experience spans...", "I am excited to...")
- Replace with specific, concrete phrasing drawn only from the actual content
- Forbidden openers: "Additionally", "Furthermore", "Moreover", "In conclusion"
- Do NOT open any sentence with "I"
- No hedging: "I believe", "I feel", "I think" → remove the hedge entirely
- If the letter is in Danish, keep it in Danish. If English, keep in English.
- Return ONLY the rewritten letter`;

// Targeted rewrite — used when flagged sentences exist (overall 0.5–0.85, or low overall but individual sentences flagged)
const TARGETED_REWRITE_SYSTEM = `You are an editor rewriting specific sentences in a cover letter to sound more human.

Rules:
- Keep all facts, names, dates, URLs, and claims exactly intact
- Break three-part lists ("X, Y, and Z") into separate sentences
- Replace filler: "passionate about", "thrilled to", "excited to", "leverage", "aligns", "dynamic", "impactful"
- Vary sentence length — mix short direct statements with longer ones
- No hedging: "I believe I would" → "I would"
- Do NOT open any sentence with "I"
- If the original is in Danish, rewrite in Danish. If English, keep in English.
- Return ONLY a JSON object: {"rewrites": ["rewrite 1", "rewrite 2", ...]} — same count and order as input`;

export interface HumanizeResult {
  text: string;
  saplingScore: number | null;
  action: "skipped" | "aggressive" | "targeted" | "unavailable";
  flaggedSentences: number;
  sentenceScores: { sentence: string; score: number }[];
}

export async function humanizeText(text: string, openai: OpenAI, userId?: string): Promise<HumanizeResult> {
  const sapling = await getSaplingResult(text);
  const overallScore = sapling?.score ?? null;

  // Already reads as human overall — but still check for individually flagged sentences
  if (overallScore !== null && overallScore < 0.5) {
    const flaggedEarly = (sapling?.sentence_scores ?? []).filter((s) => s.score >= 0.5);
    if (flaggedEarly.length === 0) {
      return { text, saplingScore: overallScore, action: "skipped", flaggedSentences: 0, sentenceScores: sapling?.sentence_scores ?? [] };
    }
    // Fall through to targeted rewrite below for the flagged sentences
  }

  // Very high AI signal → aggressive full rewrite with GPT-4o
  if (overallScore === null || overallScore > 0.85) {
    try {
      const model = "gpt-4o";
      const response = await openai.chat.completions.create({
        model,
        temperature: 0.75,
        max_tokens: 1500,
        messages: [
          { role: "system", content: AGGRESSIVE_REWRITE_SYSTEM },
          { role: "user", content: text },
        ],
      });
      if (userId) trackTokens(userId, "humanize_cover_letter", model, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0);
      return {
        text: response.choices[0]?.message?.content?.trim() || text,
        saplingScore: overallScore,
        action: overallScore === null ? "unavailable" : "aggressive",
        flaggedSentences: sapling?.sentence_scores.filter((s) => s.score >= 0.5).length ?? 0,
        sentenceScores: sapling?.sentence_scores ?? [],
      };
    } catch {
      return { text, saplingScore: overallScore, action: overallScore === null ? "unavailable" : "aggressive", flaggedSentences: 0, sentenceScores: sapling?.sentence_scores ?? [] };
    }
  }

  // Moderate AI signal (0.5–0.85) → targeted rewrite of flagged sentences only
  const flagged = (sapling?.sentence_scores ?? []).filter((s) => s.score >= 0.5);
  if (flagged.length === 0) {
    return { text, saplingScore: overallScore, action: "skipped", flaggedSentences: 0, sentenceScores: sapling?.sentence_scores ?? [] };
  }

  try {
    const sentences = flagged.map((s) => s.sentence);
    const model = "gpt-4o-mini";
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.75,
      max_tokens: Math.min(sentences.join(" ").length * 3, 1200),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: TARGETED_REWRITE_SYSTEM },
        {
          role: "user",
          content: `Cover letter (context only — do NOT rewrite it):\n${text}\n\nRewrite only these ${sentences.length} sentence${sentences.length > 1 ? "s" : ""} to sound less AI-generated. Return as JSON: {"rewrites": ["...", ...]}\n\n${sentences.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
        },
      ],
    });
    if (userId) trackTokens(userId, "humanize_cover_letter", model, response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0);

    const raw = response.choices[0]?.message?.content?.trim();
    if (raw) {
      const parsed = JSON.parse(raw) as { rewrites?: string[] };
      const rewrites = parsed.rewrites;
      if (Array.isArray(rewrites) && rewrites.length === sentences.length) {
        let result = text;
        for (let i = 0; i < sentences.length; i++) {
          if (rewrites[i] && rewrites[i] !== sentences[i]) {
            result = result.replace(sentences[i], rewrites[i]);
          }
        }
        return { text: result, saplingScore: overallScore, action: "targeted", flaggedSentences: flagged.length, sentenceScores: sapling?.sentence_scores ?? [] };
      }
    }
  } catch {
    // fall through
  }

  return { text, saplingScore: overallScore, action: "targeted", flaggedSentences: flagged.length, sentenceScores: sapling?.sentence_scores ?? [] };
}
