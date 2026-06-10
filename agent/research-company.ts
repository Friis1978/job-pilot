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
  // Job boards
  "adzuna.com",
  "linkedin.com",
  "indeed.com",
  "careerjet.dk",
  "careerjet.se",
  "careerjet.com",
  "jooble.org",
  "jobindex.dk",
  "stepstone.dk",
  "stepstone.de",
  "monster.com",
  "glassdoor.com",
  "simplyhired.com",
  "ziprecruiter.com",
  // ATS platforms
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
  "bamboohr.com",
  "workable.com",
  "pinpointhq.com",
  "teamtailor.com",
  "personio.com",
  "personio.de",
  "successfactors.com",
  "successfactors.eu",
  "sap.com",
  // HR/payroll platforms used as ATS
  "paychex.com",
  "paychexflex.com",
  "kronos.com",
  "ultipro.com",
  "adp.com",
  "hrmanager.dk",
  "hr-manager.net",
  "emply.com",
  "reachmee.com",
  "webcruiter.no",
];

async function resolveCompanyUrl(
  sourceUrl: string,
  companyName: string,
): Promise<{ url: string; needsGptLookup: boolean }> {
  const fallback = (): { url: string; needsGptLookup: boolean } => ({
    url: `https://www.${companyName.toLowerCase().replace(/\s+/g, "")}.com`,
    needsGptLookup: true,
  });

  try {
    const res = await fetch(sourceUrl, { redirect: "follow" });
    const realUrl = new URL(res.url);
    if (ATS_AND_JOB_BOARD_DOMAINS.some((d) => realUrl.hostname.endsWith(d))) {
      return fallback();
    }
    const parts = realUrl.hostname.split(".");
    const resolvedDomain = parts.slice(-2).join(".");

    // Sanity check: if the resolved domain shares no words with the company name,
    // it's likely an ATS/redirect we don't recognise — ask GPT-4o for the real URL.
    const companyWords = companyName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const domainStr = resolvedDomain.toLowerCase();
    const matchesCompany = companyWords.some((w) => domainStr.includes(w));
    if (!matchesCompany && companyWords.length > 0) {
      return fallback();
    }

    return { url: `https://${resolvedDomain}`, needsGptLookup: false };
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

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    // Resolve company homepage URL
    const { url: resolvedUrl, needsGptLookup } = job.source_url
      ? await resolveCompanyUrl(job.source_url, job.company)
      : { url: `https://www.${job.company.toLowerCase().replace(/\s+/g, "")}.com`, needsGptLookup: true };

    let homepageUrl = resolvedUrl;

    // When the redirect didn't land on the company's own site, ask GPT-4o for
    // the official URL — it knows most companies including non-English ones.
    if (needsGptLookup) {
      try {
        const urlResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          temperature: 0,
          max_tokens: 100,
          messages: [
            {
              role: "system",
              content: `Return the official website URL for the given company. Only return a URL you are confident about — do not guess. Return JSON: { "url": "<full url or null>" }`,
            },
            {
              role: "user",
              content: `Company: ${job.company}`,
            },
          ],
        });
        const parsed = JSON.parse(urlResponse.choices[0]?.message?.content ?? "{}") as { url?: string | null };
        if (parsed.url) {
          homepageUrl = parsed.url;
        }
      } catch (urlErr) {
        console.error("[agent/research-company] GPT-4o URL lookup failed", urlErr);
        // Keep resolvedUrl as fallback
      }
    }

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

    // If browser research found nothing, ask GPT-4o to use its own knowledge about the company
    const browserResearchEmpty =
      !companyResearchRaw.oneLiner && !companyResearchRaw.productSummary;

    if (browserResearchEmpty) {
      console.log(
        "[agent/research-company] browser research empty — falling back to GPT-4o training knowledge",
      );
      try {
        const knowledgeResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 500,
          messages: [
            {
              role: "system",
              content: `You are a company research assistant. Using only your training knowledge, provide factual information about the given company. Be conservative — only state facts you are confident about. If you have no reliable knowledge about this company, return empty strings and arrays rather than inventing details.

Return ONLY valid JSON:
{
  "oneLiner": "<what the company does in one sentence, or empty string if unknown>",
  "productSummary": "<what they build/sell and who it's for, or empty string if unknown>",
  "signals": ["<notable fact: funding, customers, size, mission, known products>"]
}`,
            },
            {
              role: "user",
              content: `Company: ${job.company}\nJob title: ${job.title}\nJob description excerpt: ${(job.about_role ?? "").slice(0, 600)}`,
            },
          ],
        });

        const raw = knowledgeResponse.choices[0]?.message?.content;
        if (raw) {
          const knowledge = JSON.parse(raw) as {
            oneLiner?: string;
            productSummary?: string;
            signals?: string[];
          };
          companyResearchRaw.oneLiner = knowledge.oneLiner ?? "";
          companyResearchRaw.productSummary = knowledge.productSummary ?? "";
          companyResearchRaw.signals = knowledge.signals ?? [];
          // Clear the ATS URL from sources so it doesn't appear in the dossier
          companyResearchRaw.sourceUrls = [];
        }
      } catch (knowledgeErr) {
        console.error(
          "[agent/research-company] GPT-4o knowledge fallback failed",
          knowledgeErr,
        );
        // Continue — synthesis will still run with whatever partial data exists
      }
    }

    // If still empty after GPT-4o fallback, nothing is known about this company
    if (!companyResearchRaw.oneLiner && !companyResearchRaw.productSummary) {
      await posthog.shutdown();
      return {
        success: false,
        error: `No information found for "${job.company}". The company may be too small or niche to appear in public records. Check the company name is correct and try again.`,
      };
    }

    // GPT-4o synthesis — always runs, even if browser research was empty

    const systemPrompt = `You are a sharp career strategist preparing a candidate to apply for a specific role. You are given (a) research about the company${browserResearchEmpty ? " (from AI training knowledge — treat as approximate)" : " (scraped from their website)"}, (b) the job posting, and (c) the candidate's profile. Produce a concise, concrete briefing that gives this specific candidate an edge for this specific role.

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
