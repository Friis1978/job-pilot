import { z } from "zod";
import { completeJson } from "@/lib/ai/claude";
import type { Connection, Profile } from "@/types";
import { trackTokens } from "@/lib/track-tokens";

const MESSAGE_JSON_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    subject: { type: "string" },
  },
  required: ["message", "subject"],
  additionalProperties: false,
} as const;

const MessageSchema = z.object({
  message: z.string(),
  subject: z.string().optional(),
});

export type LinkedInMessage = z.infer<typeof MessageSchema>;

type GenerateMessageInput = {
  contact: Pick<Connection, "first_name" | "last_name" | "position" | "company">;
  jobTitle: string;
  company: string;
  profile: Pick<Profile, "full_name" | "current_title" | "skills" | "years_experience">;
  tone: string;
};

export async function generateLinkedInMessage(
  input: GenerateMessageInput,
  userId: string,
): Promise<{ success: boolean; result?: LinkedInMessage; error?: string }> {
  try {
    const { data, usage, model } = await completeJson<unknown>({
      userId,
      maxTokens: 500,
      effort: "low",
      schema: MESSAGE_JSON_SCHEMA,
      system: `You write personalised, concise LinkedIn outreach messages for job seekers. Keep messages under 300 characters — LinkedIn connection requests have strict limits. Tone: ${input.tone || "professional"}. Return JSON with: message (string), subject (string for InMail).`,
      user: `From: ${input.profile.full_name} (${input.profile.current_title}, ${input.profile.years_experience ?? "several"} years experience)
Skills: ${(input.profile.skills ?? []).slice(0, 8).join(", ")}

To: ${input.contact.first_name} ${input.contact.last_name}, ${input.contact.position} at ${input.contact.company}

Goal: Express interest in the ${input.jobTitle} role at ${input.company} and ask for a referral or informal chat.

Write a personalised LinkedIn connection request message. Keep it under 300 characters, specific, and human. Return JSON.`,
    });

    const parsed = MessageSchema.parse(data ?? {});

    trackTokens(userId, "linkedin_message", model, usage.input_tokens, usage.output_tokens);

    return { success: true, result: parsed };
  } catch (error) {
    console.error("[linkedin-message]", error);
    return { success: false, error: String(error) };
  }
}
