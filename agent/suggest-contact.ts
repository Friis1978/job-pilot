import { z } from "zod";
import OpenAI from "openai";
import type { Connection, Profile } from "@/types";
import { isRecruiter, isManager } from "@/lib/network-utils";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const SuggestionSchema = z.object({
  connectionId: z.string(),
  reasoning: z.string(),
  suggestedMessage: z.string().optional(),
});

export type ContactSuggestion = z.infer<typeof SuggestionSchema>;

type SuggestContactInput = {
  jobTitle: string;
  company: string;
  connections: Connection[];
  profile: Pick<Profile, "full_name" | "current_title" | "skills">;
};

export async function suggestBestContact(
  input: SuggestContactInput,
): Promise<{ success: boolean; suggestion?: ContactSuggestion; error?: string }> {
  try {
    const connectionList = input.connections.map((c, i) => ({
      index: i,
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      position: c.position,
      isRecruiter: isRecruiter(c),
      isManager: isManager(c),
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You help job seekers identify the best LinkedIn contact to reach out to at a target company. Return a JSON object with: connectionId (string), reasoning (1-2 sentences explaining the choice), suggestedMessage (optional brief note on approach).",
        },
        {
          role: "user",
          content: `Job seeker: ${input.profile.full_name}, ${input.profile.current_title}
Skills: ${(input.profile.skills ?? []).slice(0, 10).join(", ")}

Target role: ${input.jobTitle} at ${input.company}

Connections at this company:
${JSON.stringify(connectionList, null, 2)}

Which connection should they reach out to first, and why? Return JSON with connectionId, reasoning, and optionally suggestedMessage.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = SuggestionSchema.parse(JSON.parse(raw));

    return { success: true, suggestion: parsed };
  } catch (error) {
    console.error("[suggest-contact]", error);
    return { success: false, error: String(error) };
  }
}
