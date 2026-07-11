import { z } from "zod";
import OpenAI from "openai";
import type { Connection, Profile } from "@/types";
import { trackTokens } from "@/lib/track-tokens";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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
  userId?: string,
): Promise<{ success: boolean; result?: LinkedInMessage; error?: string }> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You write personalised, concise LinkedIn outreach messages for job seekers. Keep messages under 300 characters — LinkedIn connection requests have strict limits. Tone: ${input.tone || "professional"}. Return JSON with: message (string), subject (optional string for InMail).`,
        },
        {
          role: "user",
          content: `From: ${input.profile.full_name} (${input.profile.current_title}, ${input.profile.years_experience ?? "several"} years experience)
Skills: ${(input.profile.skills ?? []).slice(0, 8).join(", ")}

To: ${input.contact.first_name} ${input.contact.last_name}, ${input.contact.position} at ${input.contact.company}

Goal: Express interest in the ${input.jobTitle} role at ${input.company} and ask for a referral or informal chat.

Write a personalised LinkedIn connection request message. Keep it under 300 characters, specific, and human. Return JSON.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = MessageSchema.parse(JSON.parse(raw));

    if (userId) trackTokens(userId, "linkedin_message", "gpt-4o", completion.usage?.prompt_tokens ?? 0, completion.usage?.completion_tokens ?? 0);

    return { success: true, result: parsed };
  } catch (error) {
    console.error("[linkedin-message]", error);
    return { success: false, error: String(error) };
  }
}
