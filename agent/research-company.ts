import { z } from "zod";
import OpenAI from "openai";
import { Stagehand } from "@browserbasehq/stagehand";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { browserbase } from "@/lib/browserbase";
import type { Profile } from "@/types";

type ResearchCompanyResult = {
  success: boolean;
  error?: string;
};

type CompanyResearchRaw = {
  oneLiner: string;
  productSummary: string;
  signals: string[];
  subPages: Array<{
    keyPoints: string[];
    technologies: string[];
    valuesOrCulture: string[];
    notable: string[];
  }>;
  sourceUrls: string[];
};

const homepageSchema = z.object({
  oneLiner: z.string().describe("What the company does in one sentence"),
  productSummary: z
    .string()
    .describe("What they build/sell and who it's for"),
  signals: z
    .array(z.string())
    .describe(
      "Funding, notable customers, scale, mission, recent news",
    ),
  pageLinks: z
    .array(
      z.object({
        url: z.string(),
        kind: z.enum([
          "about",
          "careers",
          "blog",
          "engineering",
          "product",
          "team",
          "other",
        ]),
      }),
    )
    .describe("Internal links worth visiting"),
});

const subPageSchema = z.object({
  keyPoints: z.array(z.string()),
  technologies: z
    .array(z.string())
    .describe(
      "Specific languages, frameworks, tools, platforms",
    ),
  valuesOrCulture: z
    .array(z.string())
    .describe("Stated values, working style, team norms"),
  notable: z
    .array(z.string())
    .describe("Customers, funding, scale, projects, awards"),
});

const PREFERRED_PAGE_KINDS = [
  "about",
  "blog",
  "engineering",
  "product",
  "team",
  "other",
];

const ATS_AND_JOB_BOARD_DOMAINS = [
  "adzuna.com",
  "greenhouse.io",
  "lever.co",
  "workday.com",
  "myworkdayjobs.com",
  "ashbyhq.com",
  "taleo.net",
  "icims.com",
  "smartrecruiters.com",
  "jobvite.com",
  "breezy.hr",
  "recruitee.com",
  "linkedin.com",
  "careerjet.dk",
  "careerjet.se",
  "jooble.org",
  "indeed.com",
];

async function resolveCompanyUrl(
  sourceUrl: string,
  companyName: string,
): Promise<string> {
  const fallback = () => {
    const clean = companyName
      .replace(/\s*(Inc\.?|LLC|Ltd\.?|Corp\.?|Co\.?).*$/i, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    return `https://www.${clean}.com`;
  };

  try {
    const res = await fetch(sourceUrl, { redirect: "follow" });
    const realUrl = new URL(res.url);
    if (ATS_AND_JOB_BOARD_DOMAINS.some((d) => realUrl.hostname.endsWith(d))) {
      return fallback();
    }
    const parts = realUrl.hostname.split(".");
    return `https://${parts.slice(-2).join(".")}`;
  } catch {
    return fallback();
  }
}

export async function researchCompany(
  userId: string,
  jobId: string,
): Promise<ResearchCompanyResult> {
  const posthog = getPostHogClient();

  try {
    const insforge = await createInsforgeServer();

    // Load job
    const { data: jobData, error: jobError } = await insforge.database
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();

    if (jobError || !jobData) {
      await posthog.shutdown();
      return { success: false, error: "Job not found." };
    }

    const job = jobData as {
      id: string;
      company: string;
      title: string;
      about_role: string | null;
      matched_skills: string[] | null;
      missing_skills: string[] | null;
      source_url: string | null;
    };

    // Load profile
    const { data: profileData, error: profileError } =
      await insforge.database
        .from("profiles")
        .select(
          "current_title, years_experience, experience_level, skills, work_experience",
        )
        .eq("id", userId)
        .single();

    if (profileError || !profileData) {
      await posthog.shutdown();
      return {
        success: false,
        error: "Profile not found. Please complete your profile.",
      };
    }

    const profile = profileData as Pick<
      Profile,
      | "current_title"
      | "years_experience"
      | "experience_level"
      | "skills"
      | "work_experience"
    >;

    // Resolve company homepage URL
    const homepageUrl = job.source_url
      ? await resolveCompanyUrl(job.source_url, job.company)
      : `https://www.${job.company.toLowerCase().replace(/\s+/g, "")}.com`;

    // Browser research — declared outside try so finally can close
    let stagehand: Stagehand | null = null;
    const companyResearchRaw: CompanyResearchRaw = {
      oneLiner: "",
      productSummary: "",
      signals: [],
      subPages: [],
      sourceUrls: [homepageUrl],
    };

    try {
      const session = await browserbase.sessions.create({
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        timeout: 120,
      });

      stagehand = new Stagehand({
        env: "BROWSERBASE",
        apiKey: process.env.BROWSERBASE_API_KEY!,
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        browserbaseSessionID: session.id,
        // library-docs.md: model is always gpt-4o for stagehand
        model: { modelName: "gpt-4o", apiKey: process.env.OPENAI_API_KEY! },
        disablePino: true,
      });

      await stagehand.init();
      const page = stagehand.context.activePage()!;

      // Homepage extraction
      try {
        await page.goto(homepageUrl, { waitUntil: "networkidle" });

        const homepageData = await stagehand.extract(
          "This is a company's homepage. Capture what the company actually does, who it's for, and any concrete signals (funding, customers, scale, mission, recent launches). Then find the internal links most worth visiting to research them as an employer.",
          homepageSchema,
        );

        companyResearchRaw.oneLiner = homepageData.oneLiner ?? "";
        companyResearchRaw.productSummary =
          homepageData.productSummary ?? "";
        companyResearchRaw.signals = homepageData.signals ?? [];

        // Bail if parked domain or wrong site
        if (!homepageData.oneLiner && !homepageData.productSummary) {
          console.log(
            "[agent/research-company] no homepage content — skipping sub-pages",
          );
        } else {
          // Sub-page extraction — max 3, prefer about/blog/engineering/product over careers
          const subPageLinks = (homepageData.pageLinks ?? [])
            .filter((l) => l.kind !== "careers")
            .sort((a, b) => {
              const ai = PREFERRED_PAGE_KINDS.indexOf(a.kind);
              const bi = PREFERRED_PAGE_KINDS.indexOf(b.kind);
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            })
            .slice(0, 3);

          for (const link of subPageLinks) {
            try {
              await page.goto(link.url, { waitUntil: "networkidle" });
              const subData = await stagehand.extract(
                "Extract substance that helps a candidate understand this company before applying: what they do, their values and how they work, the specific technologies and tools they use, notable projects or customers, and how the team operates. Ignore nav, footers, cookie banners, and generic marketing copy.",
                subPageSchema,
              );
              companyResearchRaw.subPages.push({
                keyPoints: subData.keyPoints ?? [],
                technologies: subData.technologies ?? [],
                valuesOrCulture: subData.valuesOrCulture ?? [],
                notable: subData.notable ?? [],
              });
              companyResearchRaw.sourceUrls.push(link.url);
            } catch (subErr) {
              console.error(
                "[agent/research-company] sub-page failed",
                link.url,
                subErr,
              );
            }
          }
        }
      } catch (homepageErr) {
        console.error(
          "[agent/research-company] homepage extraction failed",
          homepageErr,
        );
      }
    } catch (browserErr) {
      console.error(
        "[agent/research-company] browser session error",
        browserErr,
      );
      // Never rethrow — fall through to GPT-4o synthesis with whatever was collected
    } finally {
      // ALWAYS close — never leave sessions open even if research fails
      if (stagehand) {
        await stagehand.close();
      }
    }

    // GPT-4o synthesis — always runs, even if browser research was empty
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const systemPrompt = `You are a sharp career strategist preparing a candidate to apply for a specific role. You are given (a) research collected from the company's own website, (b) the job posting, and (c) the candidate's profile. Produce a concise, concrete briefing that gives this specific candidate an edge for this specific role.

Rules:
- Ground every company claim in the provided research or job posting. Never invent funding, customers, headcount, or facts. If research was thin, infer carefully from the job posting and say what's inferred.
- Be specific to THIS candidate. Connect their actual skills and past work to this company's stack, product, and values. No generic advice that would apply to anyone.
- Turn the candidate's missing skills into a strategy: how to frame the gap honestly and what adjacent experience to lean on.
- Talking points and questions must reference real things from the research, the kind of detail that signals the candidate did their homework.
- Keep every item tight: one or two sentences. No fluff.

Return ONLY valid JSON matching this shape:
{
  "companyOverview": string,
  "techStack": string[],
  "culture": string[],
  "whyThisRole": string,
  "yourEdge": string[],
  "gapsToAddress": string[],
  "smartQuestions": string[],
  "interviewPrep": string[],
  "sources": string[]
}`;

    const userPrompt = `COMPANY RESEARCH (from their website):
${JSON.stringify(companyResearchRaw)}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Description: ${job.about_role ?? "Not available"}
Matched skills (already computed): ${(job.matched_skills ?? []).join(", ")}
Missing skills (already computed): ${(job.missing_skills ?? []).join(", ")}

CANDIDATE PROFILE:
Current title: ${profile.current_title ?? "Not specified"}
Experience: ${profile.years_experience ?? 0} years, level ${profile.experience_level ?? "not specified"}
Skills: ${(profile.skills ?? []).join(", ")}
Work history: ${JSON.stringify((profile.work_experience ?? []).slice(0, 3))}`;

    let dossier: Record<string, unknown>;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 800,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      dossier = JSON.parse(response.choices[0].message.content!);
      // Override sources with actual scraped URLs — GPT-4o tends to hallucinate these
      dossier.sources = companyResearchRaw.sourceUrls.filter(Boolean);
    } catch (synthesisErr) {
      console.error(
        "[agent/research-company] synthesis failed",
        synthesisErr,
      );
      await posthog.shutdown();
      return {
        success: false,
        error: "Research synthesis failed. Please try again.",
      };
    }

    // Save dossier to DB — always scope to user_id
    const { error: updateError } = await insforge.database
      .from("jobs")
      .update({ company_research: dossier })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (updateError) {
      console.error(
        "[agent/research-company] failed to save dossier",
        updateError,
      );
      await posthog.shutdown();
      return {
        success: false,
        error: "Research completed but could not be saved.",
      };
    }

    posthog.capture({
      distinctId: userId,
      event: "company_researched",
      properties: { userId, jobId, company: job.company },
    });
    await posthog.shutdown();

    return { success: true };
  } catch (err) {
    console.error("[agent/research-company]", err);
    await posthog.shutdown();
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
