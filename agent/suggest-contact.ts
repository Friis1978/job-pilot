import { z } from "zod";
import { completeJson } from "@/lib/ai/claude";
import type { Connection, Profile } from "@/types";
import { isRecruiter, isManager } from "@/lib/network-utils";
import { trackTokens } from "@/lib/track-tokens";

// The shape the model is constrained to. suggestedMessage is required here even
// though it is optional downstream — an always-present key is simpler to
// constrain than an optional one, and zod still accepts it.
const SUGGESTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    connectionId: { type: "string" },
    reasoning: { type: "string" },
    suggestedMessage: { type: "string" },
  },
  required: ["connectionId", "reasoning", "suggestedMessage"],
  additionalProperties: false,
} as const;

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
  userId: string,
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

    const { data, usage, model } = await completeJson<unknown>({
      userId,
      maxTokens: 500,
      effort: "low",
      schema: SUGGESTION_JSON_SCHEMA,
      system:
        "You help job seekers identify the best LinkedIn contact to reach out to at a target company. Return a JSON object with: connectionId (string), reasoning (1-2 sentences explaining the choice), suggestedMessage (brief note on approach).",
      user: `Job seeker: ${input.profile.full_name}, ${input.profile.current_title}
Skills: ${(input.profile.skills ?? []).slice(0, 10).join(", ")}

Target role: ${input.jobTitle} at ${input.company}

Connections at this company:
${JSON.stringify(connectionList, null, 2)}

Which connection should they reach out to first, and why? Return JSON with connectionId, reasoning, and suggestedMessage.`,
    });

    const parsed = SuggestionSchema.parse(data ?? {});

    trackTokens(userId, "suggest_contact", model, usage.input_tokens, usage.output_tokens);

    return { success: true, suggestion: parsed };
  } catch (error) {
    console.error("[suggest-contact]", error);
    return { success: false, error: String(error) };
  }
}
