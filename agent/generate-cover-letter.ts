import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";

type Result = { success: boolean; error?: string };

export async function generateCoverLetter(
  userId: string,
  jobId: string,
): Promise<Result> {
  const insforge = await createInsforgeServer();
  const posthog = getPostHogClient();

  const [jobRes, profileRes] = await Promise.all([
    insforge.database
      .from("jobs")
      .select(
        "title, company, about_role, match_reason, matched_skills, missing_skills, company_research",
      )
      .eq("id", jobId)
      .eq("user_id", userId)
      .single(),
    insforge.database
      .from("profiles")
      .select(
        "full_name, current_title, years_experience, skills, work_experience, cover_letter_tone",
      )
      .eq("id", userId)
      .single(),
  ]);

  if (jobRes.error || !jobRes.data) {
    await posthog.shutdown();
    return { success: false, error: "Job not found." };
  }

  if (profileRes.error || !profileRes.data) {
    await posthog.shutdown();
    return { success: false, error: "Profile not found. Please complete your profile first." };
  }

  const job = jobRes.data;
  const profile = profileRes.data;

  const tone = (profile.cover_letter_tone as string | null) ?? "Professional";
  const recentWork = ((profile.work_experience as { title: string; company: string; responsibilities?: string }[] | null) ?? [])
    .slice(0, 2)
    .map((w) => `${w.title} at ${w.company}${w.responsibilities ? ": " + w.responsibilities : ""}`)
    .join("\n");

  const companyContext = job.company_research
    ? `COMPANY RESEARCH:\n${JSON.stringify(job.company_research, null, 2)}`
    : "";

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: `You are an expert cover letter writer. Write a compelling, personalised cover letter in a ${tone} tone.

Rules:
- Address it to the hiring team at the company (no "Dear Sir/Madam")
- Open with a strong hook specific to this role and company — not a generic opener
- Connect the candidate's actual experience and skills directly to what the role requires
- Acknowledge gap skills honestly but frame them as a growth opportunity
- Reference specific things about the company if research is provided
- Close with a clear call to action
- Keep it to 3–4 paragraphs — no longer
- Do NOT include a subject line, date, address block, or signature — just the letter body
- Write in first person as the candidate`,
        },
        {
          role: "user",
          content: `JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.about_role ?? "Not provided"}
Matched skills: ${(job.matched_skills as string[] | null)?.join(", ") ?? "None"}
Gap skills: ${(job.missing_skills as string[] | null)?.join(", ") ?? "None"}
${companyContext}

CANDIDATE:
Name: ${profile.full_name ?? "Not provided"}
Current title: ${profile.current_title ?? "Not provided"}
Experience: ${profile.years_experience ?? 0} years
Skills: ${(profile.skills as string[] | null)?.join(", ") ?? "Not provided"}
Recent work:
${recentWork || "Not provided"}`,
        },
      ],
    });

    const coverLetter = response.choices[0]?.message?.content?.trim();
    if (!coverLetter) {
      await posthog.shutdown();
      return { success: false, error: "Generation failed. Please try again." };
    }

    const { error: updateError } = await insforge.database
      .from("jobs")
      .update({ cover_letter: coverLetter })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (updateError) {
      await posthog.shutdown();
      return { success: false, error: "Failed to save cover letter." };
    }

    posthog.capture({
      distinctId: userId,
      event: "cover_letter_generated",
      properties: { userId, jobId, company: job.company },
    });
    await posthog.shutdown();

    return { success: true };
  } catch (err) {
    console.error("[agent/generate-cover-letter]", err);
    await posthog.shutdown();
    return { success: false, error: "Generation failed. Please try again." };
  }
}
