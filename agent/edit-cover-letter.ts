import OpenAI from "openai";

const BASE_EDIT_SYSTEM = `You are a writing editor applying a candidate's personal style guide to a draft cover letter.

Hard constraints (non-negotiable — override anything in the style guide that conflicts):
- Do NOT add emotional or enthusiasm language: "passion", "excited", "resonates", "truly excites", "appealing", "seamlessly", "empowering", "transformative", "thrive", "aligns perfectly", "real value"
- Do NOT add facts, claims, or connections not already present in the draft.
- Do NOT invent technology connections or achievements.
- Keep all specific technology names and project references — do not replace them with generalities.
- Return ONLY the rewritten letter — no commentary.

Your job: adjust sentence structure, phrasing, tone, greeting/closing format, and voice to match the style guide below. Keep the substance intact.`;

export async function editCoverLetter(
  draft: string,
  styleGuide: string,
  openai: OpenAI,
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 1500,
      messages: [
        { role: "system", content: `${BASE_EDIT_SYSTEM}\n\n== STYLE GUIDE ==\n${styleGuide}` },
        {
          role: "user",
          content: `Apply the style guide to this draft. Keep all specific facts and technologies. Remove any emotional language:\n\n${draft}`,
        },
      ],
    });
    return response.choices[0]?.message?.content?.trim() || draft;
  } catch (err) {
    console.error("[editCoverLetter]", err);
    return draft;
  }
}
