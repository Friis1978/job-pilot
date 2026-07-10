import OpenAI from "openai";

const HUMANIZE_PROMPT = `You are a writing editor. Your only job is to make the text below sound more human — less like AI output.

Rules:
- Do NOT change any facts, names, URLs, dates, or structure
- Do NOT add or remove content — only rewrite at the sentence level
- Do NOT change the greeting or closing lines
- Break up long parallel lists ("X, Y, and Z" patterns) into separate sentences where natural
- Vary sentence length: mix short punchy statements with longer ones
- Remove AI-rhythm patterns: "not just X but Y", three-part parallel structures, "I bring a unique combination of"
- Replace corporate filler: "leverage", "synergize", "dynamic", "passionate", "excited", "thrilled"
- Add natural hesitation or opinion where it fits: "Hvad jeg finder interessant er..." / "What I find interesting is..."
- Keep the voice direct and confident — not hedged or overly polished
- If the letter is in Danish, keep it in Danish. If English, keep it in English.
- Return ONLY the rewritten letter — no commentary, no explanation`;

export async function humanizeText(text: string, openai: OpenAI): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 1500,
      messages: [
        { role: "system", content: HUMANIZE_PROMPT },
        { role: "user", content: text },
      ],
    });
    return response.choices[0]?.message?.content?.trim() || text;
  } catch {
    return text;
  }
}
