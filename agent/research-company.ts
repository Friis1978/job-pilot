import { z } from "zod";
import OpenAI from "openai";
import { Stagehand } from "@browserbasehq/stagehand";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { browserbase } from "@/lib/browserbase";
import { stripHtml } from "@/lib/utils";
import type { Profile } from "@/types";

type ResearchCompanyResult = {
  success: boolean;
  error?: string;
  warning?: string;
};

type ContactInfo = {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  company?: string | null;
};

type CompanyResearchRaw = {
  oneLiner: string;
  productSummary: string;
  signals: string[];
  address: string | null;
  subPages: Array<{
    keyPoints: string[];
    technologies: string[];
    valuesOrCulture: string[];
    notable: string[];
    address: string | null;
  }>;
  contactFromJobPosting: ContactInfo | null;
  recruiterContact: ContactInfo | null;
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
          "contact",
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

const jobPostingContactSchema = z.object({
  contactName: z.string().nullable().describe("Internal hiring manager or HR contact full name (works at the hiring company)"),
  contactTitle: z.string().nullable().describe("Their job title e.g. 'IT-udviklingschef', 'HR Manager'"),
  contactEmail: z.string().nullable().describe("Internal contact email address"),
  contactPhone: z.string().nullable().describe("Internal contact phone number"),
  companyAddress: z.string().nullable().describe("Full postal address of the hiring company if shown on this page"),
  recruiterName: z.string().nullable().describe("External recruiter full name (works at a recruiting/staffing agency, NOT the hiring company)"),
  recruiterTitle: z.string().nullable().describe("Recruiter's job title"),
  recruiterEmail: z.string().nullable().describe("Recruiter's email address"),
  recruiterPhone: z.string().nullable().describe("Recruiter's phone number"),
  recruiterCompany: z.string().nullable().describe("Name of the recruiting/staffing agency"),
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
  address: z
    .string()
    .nullable()
    .describe("Full physical/postal address of the company if found on this page, otherwise null"),
  contactName: z
    .string()
    .nullable()
    .describe("Full name of a contact person (HR manager, hiring contact, or general enquiry contact) found on this page, otherwise null"),
  contactTitle: z
    .string()
    .nullable()
    .describe("Job title of the contact person, otherwise null"),
  contactEmail: z
    .string()
    .nullable()
    .describe("Email address of the contact person or general enquiry email, otherwise null"),
  contactPhone: z
    .string()
    .nullable()
    .describe("Phone number of the contact person or general enquiry phone, otherwise null"),
});

const PREFERRED_PAGE_KINDS = [
  "contact",
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

// Derive likely country TLDs from a job location string
function countryTldsFromLocation(location: string | null): string[] {
  if (!location) return [];
  const loc = location.toLowerCase();
  if (/denmark|danmark|copenhagen|københavn|\bdk\b/.test(loc)) return ["dk"];
  if (/sweden|sverige|stockholm|\bse\b/.test(loc)) return ["se"];
  if (/norway|norge|oslo|\bno\b/.test(loc)) return ["no"];
  if (/finland|suomi|helsinki|\bfi\b/.test(loc)) return ["fi"];
  if (/germany|deutschland|berlin|münchen|\bde\b/.test(loc)) return ["de"];
  if (/netherlands|nederland|amsterdam|\bnl\b/.test(loc)) return ["nl"];
  if (/\buk\b|united kingdom|london/.test(loc)) return ["co.uk", "uk"];
  return [];
}

// Strip common legal suffixes so "STELLA CARE ApS" → "stella care", then slug it
const LEGAL_SUFFIXES = /\b(aps|a\/s|as|ab|oy|gmbh|ag|bv|nv|sa|srl|spa|ltd|limited|inc|corp|llc|co|group|holding|holdings|international|solutions|services|consulting)\b/gi;

function companySlug(name: string): string {
  return name
    .replace(LEGAL_SUFFIXES, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "");
}

function companySlugHyphen(name: string): string {
  return name
    .replace(LEGAL_SUFFIXES, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Try a list of candidate URLs and return the first that responds successfully
async function probeUrls(candidates: string[]): Promise<string | null> {
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok || res.status < 400) return url;
    } catch {
      // try next
    }
  }
  return null;
}

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
      location: string | null;
      about_role: string | null;
      matched_skills: string[] | null;
      missing_skills: string[] | null;
      source_url: string | null;
      company_research: Record<string, unknown> | null;
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
      let gptFoundUrl = false;
      try {
        const urlResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          temperature: 0,
          max_tokens: 100,
          messages: [
            {
              role: "system",
              content: `Return the official website URL for the given company.
IMPORTANT: If the job is in Denmark, Sweden, Norway, Finland, Germany, Netherlands, or another non-US country, return the LOCAL or REGIONAL entity's website (e.g. a .dk, .se, .no, .fi, .de, .nl, or .eu domain), NOT the US/global parent company's website. For example, if the company is a Danish subsidiary or European entity, return the Danish/European URL — not the American headquarters.
Only return a URL you are confident about — do not guess. Return JSON: { "url": "<full url or null>" }`,
            },
            {
              role: "user",
              content: `Company: ${job.company}\nJob title: ${job.title}\nJob location: ${job.location ?? "unknown"}\nJob description excerpt: ${(job.about_role ?? "").slice(0, 600)}`,
            },
          ],
        });
        const parsed = JSON.parse(urlResponse.choices[0]?.message?.content ?? "{}") as { url?: string | null };
        if (parsed.url) {
          homepageUrl = parsed.url;
          gptFoundUrl = true;
        }
      } catch (urlErr) {
        console.error("[agent/research-company] GPT-4o URL lookup failed", urlErr);
      }

      // Even if GPT-4o found a URL, if the job is in a country with a known TLD (e.g. .dk)
      // but the returned URL doesn't use it, probe for a local version first — the GPT may
      // have returned the US/global parent instead of the local entity.
      if (gptFoundUrl) {
        const countryTlds = countryTldsFromLocation(job.location);
        if (countryTlds.length > 0) {
          try {
            const homepageDomain = new URL(homepageUrl).hostname.toLowerCase();
            const hasLocalTld = countryTlds.some((tld) => homepageDomain.endsWith(`.${tld}`));
            if (!hasLocalTld) {
              const slug = companySlug(job.company);
              const slugH = companySlugHyphen(job.company);
              const localCandidates = countryTlds.flatMap((tld) => [
                `https://${slug}.${tld}`,
                `https://www.${slug}.${tld}`,
                ...(slugH !== slug ? [`https://${slugH}.${tld}`, `https://www.${slugH}.${tld}`] : []),
              ]);
              const probed = await probeUrls(localCandidates);
              if (probed) {
                console.log(`[agent/research-company] local TLD override: ${homepageUrl} → ${probed}`);
                homepageUrl = probed;
              }
            }
          } catch {
            // URL parse failed — keep existing homepageUrl
          }
        }
      }

      // GPT-4o doesn't know this company — probe common URL patterns before falling
      // back to the generic .com guess. Especially important for smaller companies
      // in non-English markets that use country TLDs (.dk, .se, .no, etc.).
      if (!gptFoundUrl) {
        const slug = companySlug(job.company);
        const slugH = companySlugHyphen(job.company);
        const countryTlds = countryTldsFromLocation(job.location);
        const candidates: string[] = [
          // Country TLD variants first (more likely for non-English companies)
          ...countryTlds.flatMap((tld) => [
            `https://${slug}.${tld}`,
            `https://www.${slug}.${tld}`,
            ...(slugH !== slug ? [`https://${slugH}.${tld}`, `https://www.${slugH}.${tld}`] : []),
          ]),
          // .com fallback
          `https://www.${slug}.com`,
          `https://${slug}.com`,
          ...(slugH !== slug ? [`https://www.${slugH}.com`, `https://${slugH}.com`] : []),
        ];
        const probed = await probeUrls(candidates);
        if (probed) {
          homepageUrl = probed;
          console.log(`[agent/research-company] URL probing found: ${probed}`);
        }
      }
    }

    // Browser research — declared outside try so finally can close
    let stagehand: Stagehand | null = null;
    const companyResearchRaw: CompanyResearchRaw = {
      oneLiner: "",
      productSummary: "",
      signals: [],
      address: null,
      subPages: [],
      contactFromJobPosting: null,
      recruiterContact: null,
      sourceUrls: [homepageUrl],
    };

    // Pre-process the stored job description to extract contact persons, address,
    // and company culture sections before any browser research. When about_role
    // contains the full job text (enriched via Browserbase), this is the most
    // reliable source — no browser needed for contacts/address on aggregator jobs.
    let contactFoundFromJobDescription = false;
    if (job.about_role) {
      try {
        const jdExtractResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          temperature: 0,
          max_tokens: 1000,
          messages: [
            {
              role: "system",
              content: `Extract from this job description. The text may be in any language (Danish, Swedish, English, etc.). Read the ENTIRE text including the end where contact/application instructions often appear.
Return ONLY valid JSON:
{
  "contactName": "<full name of an internal hiring contact at the employer company — or null>",
  "contactTitle": "<their job title — or null>",
  "contactEmail": "<their email address — or null>",
  "contactPhone": "<their phone number — or null>",
  "recruiterName": "<full name of an external recruiter at a staffing/recruitment agency (e.g. Right People Group, Michael Page) — or null>",
  "recruiterTitle": "<recruiter job title — or null>",
  "recruiterEmail": "<recruiter email address — or null>",
  "recruiterPhone": "<recruiter phone number — or null>",
  "recruiterCompany": "<name of the recruitment/staffing agency — or null>",
  "companyAddress": "<full postal address of the hiring company if explicitly stated (e.g. street, city) — or null>",
  "culturePoints": ["<sentences from sections like 'Hvem er vi?', 'Om os', 'About us', 'Vi er', 'Our culture' that describe the company identity, team size, values, or working environment>"]
}
Only extract contacts explicitly named in the text. Distinguish carefully: internal contacts work for the hiring company; recruiters work for an agency hired to fill the role.`,
            },
            { role: "user", content: job.about_role.slice(0, 8000) },
          ],
        });

        const jdRaw = jdExtractResponse.choices[0]?.message?.content;
        if (jdRaw) {
          const jdParsed = JSON.parse(jdRaw) as {
            contactName?: string | null;
            contactTitle?: string | null;
            contactEmail?: string | null;
            contactPhone?: string | null;
            recruiterName?: string | null;
            recruiterTitle?: string | null;
            recruiterEmail?: string | null;
            recruiterPhone?: string | null;
            recruiterCompany?: string | null;
            companyAddress?: string | null;
            culturePoints?: string[];
          };

          if (jdParsed.contactName || jdParsed.contactEmail || jdParsed.contactPhone) {
            companyResearchRaw.contactFromJobPosting = {
              name: jdParsed.contactName ?? null,
              title: jdParsed.contactTitle ?? null,
              email: jdParsed.contactEmail ?? null,
              phone: jdParsed.contactPhone ?? null,
            };
            contactFoundFromJobDescription = true;
          }

          if (jdParsed.recruiterName || jdParsed.recruiterEmail || jdParsed.recruiterPhone) {
            companyResearchRaw.recruiterContact = {
              name: jdParsed.recruiterName ?? null,
              title: jdParsed.recruiterTitle ?? null,
              email: jdParsed.recruiterEmail ?? null,
              phone: jdParsed.recruiterPhone ?? null,
              company: jdParsed.recruiterCompany ?? null,
            };
            contactFoundFromJobDescription = true;
          }

          if (jdParsed.companyAddress) {
            companyResearchRaw.address = jdParsed.companyAddress;
          }

          const culturePoints = jdParsed.culturePoints ?? [];
          if (culturePoints.length > 0) {
            companyResearchRaw.subPages.push({
              keyPoints: [],
              technologies: [],
              valuesOrCulture: culturePoints,
              notable: [],
              address: null,
            });
          }
        }
      } catch (jdExtractErr) {
        console.error("[agent/research-company] job description extraction failed", jdExtractErr);
      }
    }

    // HTTP-based source URL extraction — runs before the browser for reliability.
    // SSR pages (Emply, Angular, Next.js) have all content in the raw HTML; a plain
    // HTTP fetch bypasses browser rendering issues and always gets the full page text.
    if (job.source_url) {
      try {
        const res = await fetch(job.source_url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          const html = await res.text();
          const cleanedHtml = html
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<script[\s\S]*?<\/script>/gi, "");
          const rawText = stripHtml(cleanedHtml).replace(/\s+/g, " ").trim();
          if (rawText.length > 500) {
            console.log(`[research-company] HTTP fetch source_url: ${rawText.length} chars, tail: ${rawText.slice(-500)}`);
            const httpExtractResponse = await openai.chat.completions.create({
              model: "gpt-4o",
              response_format: { type: "json_object" },
              temperature: 0,
              max_tokens: 900,
              messages: [
                {
                  role: "system",
                  content: `Extract from this job posting page. The text may be in any language (Danish, Swedish, English, etc.). Read the entire text — contact info often appears at the end.
Return ONLY valid JSON:
{
  "contactName": "<full name of an internal hiring contact at the employer company — or null>",
  "contactTitle": "<their job title — or null>",
  "contactEmail": "<their email address — or null>",
  "contactPhone": "<their phone number — or null>",
  "recruiterName": "<full name of an external recruiter at a staffing/recruitment agency — or null>",
  "recruiterTitle": "<recruiter job title — or null>",
  "recruiterEmail": "<recruiter email address — or null>",
  "recruiterPhone": "<recruiter phone number — or null>",
  "recruiterCompany": "<name of the recruitment/staffing agency — or null>",
  "culturePoints": ["<up to 3 sentences from company identity sections>"]
}
Only include contacts explicitly named in the text. Distinguish internal contacts (work at hiring company) from external recruiters (work at a recruiting agency).`,
                },
                { role: "user", content: rawText.slice(0, 10000) },
              ],
            });
            const httpRaw = httpExtractResponse.choices[0]?.message?.content;
            console.log(`[research-company] HTTP extract GPT-4o: ${httpRaw?.slice(0, 300)}`);
            if (httpRaw) {
              const httpParsed = JSON.parse(httpRaw) as {
                contactName?: string | null; contactTitle?: string | null;
                contactEmail?: string | null; contactPhone?: string | null;
                recruiterName?: string | null; recruiterTitle?: string | null;
                recruiterEmail?: string | null; recruiterPhone?: string | null;
                recruiterCompany?: string | null; culturePoints?: string[];
              };
              if (httpParsed.contactName || httpParsed.contactEmail || httpParsed.contactPhone) {
                const existing = companyResearchRaw.contactFromJobPosting;
                companyResearchRaw.contactFromJobPosting = {
                  name: existing?.name ?? httpParsed.contactName ?? null,
                  title: existing?.title ?? httpParsed.contactTitle ?? null,
                  email: existing?.email ?? httpParsed.contactEmail ?? null,
                  phone: existing?.phone ?? httpParsed.contactPhone ?? null,
                };
              }
              if (httpParsed.recruiterName || httpParsed.recruiterEmail || httpParsed.recruiterPhone) {
                const existing = companyResearchRaw.recruiterContact;
                companyResearchRaw.recruiterContact = {
                  name: existing?.name ?? httpParsed.recruiterName ?? null,
                  title: existing?.title ?? httpParsed.recruiterTitle ?? null,
                  email: existing?.email ?? httpParsed.recruiterEmail ?? null,
                  phone: existing?.phone ?? httpParsed.recruiterPhone ?? null,
                  company: existing?.company ?? httpParsed.recruiterCompany ?? null,
                };
              }
              const culturePoints = httpParsed.culturePoints ?? [];
              if (culturePoints.length > 0) {
                companyResearchRaw.subPages.push({
                  keyPoints: [], technologies: [], valuesOrCulture: culturePoints, notable: [], address: null,
                });
              }
            }
          }
        }
      } catch (httpErr) {
        console.error("[agent/research-company] HTTP source_url extraction failed", httpErr);
      }
      console.log(`[research-company] after HTTP extract: contact=${JSON.stringify(companyResearchRaw.contactFromJobPosting)}, recruiter=${JSON.stringify(companyResearchRaw.recruiterContact)}`);
    }

    try {
      const session = await browserbase.sessions.create({
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        timeout: 120,
        region: "eu-central-1",
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

      // Helper: extract text from a page and process it with GPT-4o, updating companyResearchRaw
      const extractPageForJobPosting = async (pageText: string): Promise<boolean> => {
        if (!pageText || pageText.length < 300) return false;
        try {
          const res = await openai.chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: 1000,
            messages: [
              {
                role: "system",
                content: `Extract from this job posting page. May be in any language (Danish, English, etc.).
Return ONLY valid JSON:
{
  "contactName": "<hiring manager or HR contact full name — or null>",
  "contactTitle": "<their job title — or null>",
  "contactEmail": "<email address — or null>",
  "contactPhone": "<phone number — or null>",
  "recruiterName": "<external recruiter name — or null>",
  "recruiterTitle": "<recruiter title — or null>",
  "recruiterEmail": "<recruiter email — or null>",
  "recruiterPhone": "<recruiter phone — or null>",
  "recruiterCompany": "<recruiting agency name — or null>",
  "culturePoints": ["<sentences from About us / Om os / company description sections>"],
  "fullJobText": "<the complete job description: all responsibilities, requirements, about the company — NOT a summary>"
}
Only extract contacts explicitly named in the text.`,
              },
              { role: "user", content: pageText.slice(0, 12000) },
            ],
          });
          const raw = res.choices[0]?.message?.content;
          if (!raw) return false;
          const parsed = JSON.parse(raw) as {
            contactName?: string | null; contactTitle?: string | null;
            contactEmail?: string | null; contactPhone?: string | null;
            recruiterName?: string | null; recruiterTitle?: string | null;
            recruiterEmail?: string | null; recruiterPhone?: string | null;
            recruiterCompany?: string | null;
            culturePoints?: string[]; fullJobText?: string | null;
          };
          if (parsed.contactName || parsed.contactEmail || parsed.contactPhone) {
            const ex = companyResearchRaw.contactFromJobPosting;
            companyResearchRaw.contactFromJobPosting = {
              name: ex?.name ?? parsed.contactName ?? null,
              title: ex?.title ?? parsed.contactTitle ?? null,
              email: ex?.email ?? parsed.contactEmail ?? null,
              phone: ex?.phone ?? parsed.contactPhone ?? null,
            };
          }
          if (parsed.recruiterName || parsed.recruiterEmail) {
            const ex = companyResearchRaw.recruiterContact;
            companyResearchRaw.recruiterContact = {
              name: ex?.name ?? parsed.recruiterName ?? null,
              title: ex?.title ?? parsed.recruiterTitle ?? null,
              email: ex?.email ?? parsed.recruiterEmail ?? null,
              phone: ex?.phone ?? parsed.recruiterPhone ?? null,
              company: ex?.company ?? parsed.recruiterCompany ?? null,
            };
          }
          if (parsed.culturePoints?.length) {
            companyResearchRaw.subPages.push({
              keyPoints: [], technologies: [],
              valuesOrCulture: parsed.culturePoints,
              notable: [], address: null,
            });
          }
          if (parsed.fullJobText && parsed.fullJobText.length > (job.about_role?.length ?? 0) + 200) {
            console.log(`[research-company] found fuller JD: ${parsed.fullJobText.length} chars (was ${job.about_role?.length ?? 0})`);
            job.about_role = parsed.fullJobText;
            await insforge.database.from("jobs").update({ about_role: parsed.fullJobText }).eq("id", jobId).eq("user_id", userId);
          }
          const foundContact = !!(parsed.contactName || parsed.contactEmail);
          console.log(`[research-company] job page extract: contact=${parsed.contactName ?? "none"}, email=${parsed.contactEmail ?? "none"}, jdLen=${parsed.fullJobText?.length ?? 0}`);
          return foundContact;
        } catch {
          return false;
        }
      };

      // ── DuckDuckGo: find original job posting ──────────────────────────────
      // Searches for the job posting on indexed pages (Jobbank.dk, company careers
      // page, etc.) to find the full description and contact person. This bypasses
      // Cloudflare-protected source URLs entirely.
      let contactFoundViaSearch = false;

      const PREFER_JOB_BOARDS = ["jobbank.dk", "jobindex.dk", "karriere.dk", "thehub.io", "linkedin.com"];
      const SKIP_JOB_SEARCH = ["careerjet", "jooble", "jobviewtrack", "stepstone", "adzuna", "facebook.com", "twitter.com", "youtube.com"];

      const extractDdgLinks = async (): Promise<string[]> => {
        const links = await page.evaluate(() =>
          Array.from(document.querySelectorAll(".result__a"))
            .slice(0, 8)
            .map((a) => {
              const href = (a as HTMLAnchorElement).href ?? "";
              const m = href.match(/[?&]uddg=([^&]+)/);
              return m ? decodeURIComponent(m[1]) : href;
            })
            .filter((u) => u.startsWith("http"))
        ) as string[];
        return [
          ...links.filter((u) => PREFER_JOB_BOARDS.some((d) => u.includes(d))),
          ...links.filter((u) => !PREFER_JOB_BOARDS.some((d) => u.includes(d)) && !SKIP_JOB_SEARCH.some((d) => u.includes(d))),
        ];
      };

      try {
        // Extract brand alias from "YouSee søger …" pattern — brand in title often differs
        // from the stored company name (e.g. "YouSee" vs "Nuuday")
        const brandMatch = job.title.match(/^([\w\s]{2,30}?)\s+søger\b/i);
        const titleBrand = brandMatch ? brandMatch[1].trim() : null;

        // Extract meaningful technical keywords from the core job title
        // (strip the "BrandName søger" prefix and common function words)
        const TITLE_STOP_WORDS = new Set(["søger", "senior", "junior", "lead", "and", "for", "med", "til", "ved", "hos"]);
        const coreTitleTerms = job.title
          .replace(/^[\w\s]+?\s+søger\s*/i, "")
          .replace(/["""()/\\]/g, " ")
          .split(/[\s/]+/)
          .filter((w) => w.length > 3 && !TITLE_STOP_WORDS.has(w.toLowerCase()))
          .slice(0, 4);

        // Include brand alias so we match both "Nuuday" and "YouSee" on job boards
        const companyTerms = [job.company];
        if (titleBrand && titleBrand.toLowerCase() !== job.company.toLowerCase()) {
          companyTerms.push(titleBrand);
        }

        const jobSearchQuery = `${companyTerms.join(" ")} ${coreTitleTerms.join(" ")} kontakt jobbank jobindex karriere`;
        console.log(`[research-company] job posting DDG query: ${jobSearchQuery}`);
        await page.goto(
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(jobSearchQuery)}&kl=dk-da`,
          { waitUntil: "load", timeoutMs: 15000 },
        );
        let sortedLinks = await extractDdgLinks();

        // Fallback: if first search returned nothing, try simpler company + job query
        if (sortedLinks.length === 0) {
          const fallbackQuery = `"${job.company}" job kontakt stillingsbeskrivelse`;
          console.log(`[research-company] job posting DDG fallback: ${fallbackQuery}`);
          await page.goto(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(fallbackQuery)}&kl=dk-da`,
            { waitUntil: "load", timeoutMs: 15000 },
          );
          sortedLinks = await extractDdgLinks();
        }

        console.log(`[research-company] job posting DDG found ${sortedLinks.length} candidates`);
        for (const url of sortedLinks.slice(0, 3)) {
          try {
            await page.goto(url, { waitUntil: "networkidle", timeoutMs: 20000 });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const text = (await page.evaluate(() => (document as any).body.innerText)) as string;
            console.log(`[research-company] visiting DDG result: ${url} (${text?.length ?? 0} chars)`);
            const found = await extractPageForJobPosting(text);
            if (found) { contactFoundViaSearch = true; break; }
          } catch { /* try next */ }
        }
      } catch (jobSearchErr) {
        console.error("[research-company] job posting DDG search failed", jobSearchErr);
      }

      // Job posting contact extraction — runs first, uses real browser to handle JS-rendered ATS pages.
      // Skip for aggregator source URLs (Careerjet, jobviewtrack) when contacts and address were
      // already extracted from about_role — the full job text is more reliable than re-scraping
      // the job board page, and avoids an unnecessary Browserbase page load.
      const isAggregatorSourceUrl = ["careerjet", "jobviewtrack", "jooble", "adzuna", "glassdoor"].some(
        (d) => (job.source_url ?? "").includes(d),
      );
      const skipSourceUrlBrowser = contactFoundFromJobDescription && isAggregatorSourceUrl && !!companyResearchRaw.address;
      if (job.source_url && !skipSourceUrlBrowser) {
        try {
          try {
            await page.goto(job.source_url, { waitUntil: "networkidle", timeoutMs: 25000 });
          } catch {
            // Timeout waiting for networkidle — proceed with whatever is rendered
          }

          // If we landed on a job board AGGREGATOR (Careerjet, Jooble, etc.), the full
          // job description and named contacts are on the employer's original posting —
          // try to click through to it before extracting.
          // IMPORTANT: Do NOT click through from ATS platforms (Emply, Greenhouse,
          // Teamtailor, etc.) — those ARE the employer's own job posting page.
          const JOB_BOARD_CLICKTHROUGH_DOMAINS = [
            "careerjet", "jooble", "jobindex", "stepstone", "monster",
            "glassdoor", "simplyhired", "ziprecruiter", "adzuna", "indeed",
            "jobviewtrack",
          ];

          // ── Pre-click-through extraction ─────────────────────────────────────
          // Job boards (Careerjet, Jobbank, etc.) show the FULL job description
          // on their own page. Extract it NOW before navigating away.
          try {
            const preClickUrl = page.url();
            const onJobBoardPreClick = JOB_BOARD_CLICKTHROUGH_DOMAINS.some((d) => preClickUrl.includes(d));
            if (onJobBoardPreClick && !contactFoundViaSearch) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const boardText = (await page.evaluate(() => (document as any).body.innerText)) as string;
              console.log(`[research-company] job board pre-click: ${boardText?.length ?? 0} chars from ${preClickUrl}`);
              await extractPageForJobPosting(boardText);
            }
          } catch (preClickErr) {
            console.error("[research-company] pre-click extraction failed", preClickErr);
          }

          try {
            const landedUrl = page.url();
            const onJobBoard = JOB_BOARD_CLICKTHROUGH_DOMAINS.some((d) => landedUrl.includes(d));
            if (onJobBoard) {
              await stagehand.act(
                "Click the button or link that takes you to the full job posting or lets you apply at the employer's own website. Ignore internal Careerjet/Jooble links.",
              );
              // Race against a 10s timeout — networkidle can hang on pages with background polling
              await Promise.race([
                page.waitForLoadState("networkidle"),
                new Promise<void>((r) => setTimeout(r, 10000)),
              ]);
            }
          } catch {
            // Click failed or not on a job board — continue with current page
          }

          // On job board aggregators only: extract mailto: links from the DOM to find
          // the employer's direct email (job boards sometimes hide it in HTML while
          // obfuscating it visually). On ATS pages (Emply, Greenhouse, etc.) this must
          // NOT run — ATS pages may contain recruiter agency emails (e.g. Right People
          // Group) which would wrongly override the employer's homepage URL and classify
          // the recruiter as the internal "hiring contact".
          const currentLandedUrl = page.url();
          const stillOnJobBoard = JOB_BOARD_CLICKTHROUGH_DOMAINS.some((d) => currentLandedUrl.includes(d));
          if (stillOnJobBoard) {
            const GENERIC_EMAIL_DOMAINS = new Set([
              "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com",
            ]);
            let applyEmail: string | null = null;
            try {
              const mailtoLinks = await page.evaluate(() =>
                Array.from(document.querySelectorAll('a[href^="mailto:"]'))
                  .map((a) => a.getAttribute("href")?.replace(/^mailto:/i, "").split("?")[0].trim() ?? "")
                  .filter((e) => e.includes("@"))
              ) as string[];
              applyEmail = mailtoLinks.find(
                (e) => !GENERIC_EMAIL_DOMAINS.has(e.split("@")[1]?.toLowerCase() ?? ""),
              ) ?? null;
            } catch {
              // page.evaluate unavailable — continue without
            }

            // If the email domain differs from our GPT-4o homepage guess, it's more reliable
            // (e.g. source_url → careerjet → GPT-4o guessed wrong brand domain)
            if (applyEmail) {
              const emailDomain = applyEmail.split("@")[1]?.toLowerCase();
              if (emailDomain && !homepageUrl.toLowerCase().includes(emailDomain)) {
                homepageUrl = `https://www.${emailDomain}`;
                companyResearchRaw.sourceUrls = [homepageUrl];
              }
              companyResearchRaw.contactFromJobPosting = {
                name: null, title: null, email: applyEmail, phone: null,
              };
            }
          }

          // Primary contact extraction — read full rendered page text
          console.log(`[research-company] navigated to source_url, current URL: ${page.url()}`);
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pageText = (await page.evaluate(() => (document as any).body.innerText)) as string;
            console.log(`[research-company] body.innerText length: ${pageText?.length ?? 0}`);
            await extractPageForJobPosting(pageText);
          } catch (pageTextErr) {
            console.error("[agent/research-company] page text extraction failed", pageTextErr);
          }
          console.log(`[research-company] after page-text extract: contact=${JSON.stringify(companyResearchRaw.contactFromJobPosting)}, recruiter=${JSON.stringify(companyResearchRaw.recruiterContact)}`);

          // Secondary contact extraction: Stagehand screenshot-based extract fills any gaps
          // left by the page text step (e.g. address, or contacts page text missed).
          // Wrapped in its own try/catch so a Stagehand failure never skips other work.
          try {
            const postingData = await stagehand.extract(
              "This is a job posting. Extract the contact person (recruiter or hiring manager) including their name, title, email and phone. Also extract the company's full postal address if shown.",
              jobPostingContactSchema,
            );
            if (postingData.contactName || postingData.contactEmail || postingData.contactPhone) {
              const existing = companyResearchRaw.contactFromJobPosting;
              companyResearchRaw.contactFromJobPosting = {
                name: existing?.name ?? postingData.contactName ?? null,
                title: existing?.title ?? postingData.contactTitle ?? null,
                email: existing?.email ?? postingData.contactEmail ?? null,
                phone: existing?.phone ?? postingData.contactPhone ?? null,
              };
            }
            if (postingData.recruiterName || postingData.recruiterEmail || postingData.recruiterPhone) {
              const existing = companyResearchRaw.recruiterContact;
              companyResearchRaw.recruiterContact = {
                name: existing?.name ?? postingData.recruiterName ?? null,
                title: existing?.title ?? postingData.recruiterTitle ?? null,
                email: existing?.email ?? postingData.recruiterEmail ?? null,
                phone: existing?.phone ?? postingData.recruiterPhone ?? null,
                company: existing?.company ?? postingData.recruiterCompany ?? null,
              };
            }
            if (postingData.companyAddress) {
              companyResearchRaw.address = postingData.companyAddress;
            }
          } catch (stagehandErr) {
            console.error("[agent/research-company] stagehand extract failed", stagehandErr);
          }
        } catch (postingErr) {
          console.error("[agent/research-company] job posting contact extraction failed", postingErr);
        }
      }

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

        // Bail if parked domain or wrong site — fall through to DuckDuckGo search
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
              // Contact pages need a different prompt — the generic "ignore footers/marketing" instruction
              // causes the AI to skip addresses and phone numbers which look like footer/marketing content.
              const extractInstruction = link.kind === "contact"
                ? "This is a company contact page. Extract the full postal address (street, city, zip, country), any email addresses, phone numbers, and names/titles of contact persons. These details are the primary content of this page — do not skip them."
                : "Extract substance that helps a candidate understand this company before applying: what they do, their values and how they work, the specific technologies and tools they use, notable projects or customers, and how the team operates. Ignore nav, footers, cookie banners, and generic marketing copy.";
              const subData = await stagehand.extract(extractInstruction, subPageSchema);
              const subAddress = subData.address ?? null;
              if (subAddress && !companyResearchRaw.address) {
                companyResearchRaw.address = subAddress;
              }
              if (
                !companyResearchRaw.contactFromJobPosting &&
                (subData.contactName || subData.contactEmail || subData.contactPhone)
              ) {
                companyResearchRaw.contactFromJobPosting = {
                  name: subData.contactName ?? null,
                  title: subData.contactTitle ?? null,
                  email: subData.contactEmail ?? null,
                  phone: subData.contactPhone ?? null,
                };
              }
              companyResearchRaw.subPages.push({
                keyPoints: subData.keyPoints ?? [],
                technologies: subData.technologies ?? [],
                valuesOrCulture: subData.valuesOrCulture ?? [],
                notable: subData.notable ?? [],
                address: subAddress,
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

        // ── DuckDuckGo search for supplementary company signals ────────────────
        // Finds news articles, engineering blogs, LinkedIn pages, and original job
        // postings that are indexed but not reachable from the company homepage.
        // Runs after homepage so we don't duplicate pages already visited.
        // Always runs — even good homepages miss funding rounds, key people, culture
        // articles, and the full job posting contact info.
        try {
          const ddgQuery = `${job.company} ${job.location ?? "Denmark"} engineering culture tech stack about`;
          const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(ddgQuery)}&kl=dk-da`;
          await page.goto(ddgUrl, { waitUntil: "load", timeoutMs: 15000 });

          // Extract result hrefs — DDG HTML wraps them in redirect links, resolve via evaluate
          const ddgLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll(".result__a"))
              .slice(0, 6)
              .map((a) => {
                const href = (a as HTMLAnchorElement).href ?? "";
                // DDG redirect: //duckduckgo.com/l/?uddg=<encoded-url>
                const match = href.match(/[?&]uddg=([^&]+)/);
                return match ? decodeURIComponent(match[1]) : href;
              })
              .filter((u) => u.startsWith("http"));
          }) as string[];

          console.log(`[research-company] DDG found ${ddgLinks.length} result URLs`);

          // Visit each result that isn't the homepage we just scraped or a social media site
          const SKIP_DDG = ["facebook.com", "twitter.com", "x.com", "youtube.com", "instagram.com", "tiktok.com"];
          const homepageHostname = (() => { try { return new URL(homepageUrl).hostname; } catch { return ""; } })();
          let ddgVisited = 0;

          for (const resultUrl of ddgLinks) {
            if (ddgVisited >= 3) break;
            try {
              const resultHostname = new URL(resultUrl).hostname;
              if (SKIP_DDG.some((d) => resultHostname.includes(d))) continue;
              if (resultHostname === homepageHostname) continue; // already scraped

              await page.goto(resultUrl, { waitUntil: "networkidle", timeoutMs: 15000 });
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const resultText = (await page.evaluate(() => (document as any).body.innerText)) as string;
              if (!resultText || resultText.length < 300) continue;

              const ddgExtract = await openai.chat.completions.create({
                model: "gpt-4o",
                response_format: { type: "json_object" },
                temperature: 0,
                max_tokens: 700,
                messages: [
                  {
                    role: "system",
                    content: `Extract from this web page about a company. Translate everything to English.
Return ONLY valid JSON:
{
  "keyPoints": ["<concrete facts about what the company does, their product, customers>"],
  "technologies": ["<specific tech: languages, frameworks, tools, platforms>"],
  "valuesOrCulture": ["<values, working style, team culture, engineering practices>"],
  "notable": ["<funding, headcount, revenue, customers, partnerships, awards, news>"],
  "contactName": "<hiring manager or HR contact name — or null>",
  "contactEmail": "<contact email — or null>",
  "contactPhone": "<contact phone — or null>",
  "address": "<full postal address — or null>"
}
Skip nav, footers, cookie banners, and marketing boilerplate.`,
                  },
                  { role: "user", content: resultText.slice(0, 6000) },
                ],
              });

              const ddgRaw = ddgExtract.choices[0]?.message?.content;
              if (ddgRaw) {
                const ddg = JSON.parse(ddgRaw) as {
                  keyPoints?: string[]; technologies?: string[];
                  valuesOrCulture?: string[]; notable?: string[];
                  contactName?: string | null; contactEmail?: string | null;
                  contactPhone?: string | null; address?: string | null;
                };
                if (
                  (ddg.keyPoints?.length ?? 0) > 0 ||
                  (ddg.technologies?.length ?? 0) > 0 ||
                  (ddg.valuesOrCulture?.length ?? 0) > 0 ||
                  (ddg.notable?.length ?? 0) > 0
                ) {
                  companyResearchRaw.subPages.push({
                    keyPoints: ddg.keyPoints ?? [],
                    technologies: ddg.technologies ?? [],
                    valuesOrCulture: ddg.valuesOrCulture ?? [],
                    notable: ddg.notable ?? [],
                    address: ddg.address ?? null,
                  });
                  companyResearchRaw.sourceUrls.push(resultUrl);
                  if (ddg.address && !companyResearchRaw.address) companyResearchRaw.address = ddg.address;
                  if (!companyResearchRaw.contactFromJobPosting && (ddg.contactName || ddg.contactEmail)) {
                    companyResearchRaw.contactFromJobPosting = {
                      name: ddg.contactName ?? null, title: null,
                      email: ddg.contactEmail ?? null, phone: ddg.contactPhone ?? null,
                    };
                  }
                  console.log(`[research-company] DDG result ${resultUrl}: ${ddg.keyPoints?.length ?? 0} keyPoints, ${ddg.technologies?.length ?? 0} tech, ${ddg.notable?.length ?? 0} notable`);
                  ddgVisited++;
                }
              }
            } catch (ddgResultErr) {
              console.error("[research-company] DDG result visit failed", resultUrl, ddgResultErr);
            }
          }
        } catch (ddgErr) {
          console.error("[research-company] DuckDuckGo search failed", ddgErr);
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

    // Fallback: if no address or contact info found, try common contact/about page paths directly
    if (!companyResearchRaw.address || !companyResearchRaw.contactFromJobPosting) {
      const contactPaths = [
        "/kontakt", "/contact", "/contact-us", "/contactus",
        "/om-os", "/about", "/about-us", "/about-us/contact",
        "/find-os", "/find-us",
        "/kontakt-os", "/kontaktoplysninger",
        "/vi-er-her", "/company/contact",
      ];
      for (const path of contactPaths) {
        if (companyResearchRaw.address && companyResearchRaw.contactFromJobPosting) break;
        try {
          const contactUrl = new URL(path, homepageUrl).href;
          const res = await fetch(contactUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
          });
          if (!res.ok) continue;
          const html = await res.text();
          const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000);

          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: 250,
            messages: [
              {
                role: "system",
                content: `Extract from this company page. The page may be in any language.
Return ONLY valid JSON:
{
  "address": "<full postal address including street, city, zip, country — or null if not found>",
  "contactName": "<full name of a contact person (HR, hiring manager, or general contact) — or null>",
  "contactTitle": "<their job title — or null>",
  "contactEmail": "<their email address or a general contact email — or null>",
  "contactPhone": "<their phone number or a general contact phone — or null>"
}`,
              },
              { role: "user", content: text },
            ],
          });

          const raw = response.choices[0]?.message?.content;
          if (raw) {
            const parsed = JSON.parse(raw) as {
              address?: string | null;
              contactName?: string | null;
              contactTitle?: string | null;
              contactEmail?: string | null;
              contactPhone?: string | null;
            };
            if (parsed.address && !companyResearchRaw.address) {
              companyResearchRaw.address = parsed.address;
            }
            if (
              !companyResearchRaw.contactFromJobPosting &&
              (parsed.contactName || parsed.contactEmail || parsed.contactPhone)
            ) {
              companyResearchRaw.contactFromJobPosting = {
                name: parsed.contactName ?? null,
                title: parsed.contactTitle ?? null,
                email: parsed.contactEmail ?? null,
                phone: parsed.contactPhone ?? null,
              };
            }
          }
        } catch {
          // try next path
        }
      }
    }

    // If browser research found nothing, try all available sources in one combined GPT-4o call:
    // 1. Plain HTTP fetch of the company website
    // 2. The job posting itself (which usually contains an "About the company" section)
    // 3. GPT-4o's own training knowledge as implicit fallback
    const browserResearchEmpty =
      !companyResearchRaw.oneLiner && !companyResearchRaw.productSummary;

    const stillEmpty = browserResearchEmpty; // alias used later for synthesis label

    if (browserResearchEmpty) {
      console.log("[agent/research-company] browser research empty — running combined fallback");

      // Attempt plain HTTP fetch of the homepage
      let websiteText = "";
      if (homepageUrl) {
        try {
          const homepageRes = await fetch(homepageUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5,da;q=0.3",
            },
            signal: AbortSignal.timeout(10_000),
          });
          if (homepageRes.ok) {
            const html = await homepageRes.text();
            websiteText = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
              .replace(/<!--[\s\S]*?-->/g, " ")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 4000);
            console.log(`[agent/research-company] HTTP fetch got ${websiteText.length} chars from ${homepageUrl}`);
          }
        } catch (httpErr) {
          console.error("[agent/research-company] plain HTTP fetch failed", httpErr);
        }
      }

      // Build combined context: website text + job description
      const jobText = (job.about_role ?? "").slice(0, 3000);
      const parts: string[] = [];
      if (websiteText.length > 50) parts.push(`COMPANY WEBSITE (${homepageUrl}):\n${websiteText}`);
      if (jobText) parts.push(`JOB POSTING (often contains an "About the company" section):\n${jobText}`);
      const combinedContext = parts.join("\n\n---\n\n");

      try {
        const fallbackResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 500,
          messages: [
            {
              role: "system",
              content: `You are extracting company information. You have access to the company website text and/or the job posting. Job postings almost always include a company description section (often labelled "About us", "Om virksomheden", "About the company" or similar).

Extract from the provided text first. If the provided text is insufficient or just a Cloudflare/bot-check page, use your own training knowledge about the company.

Return ONLY valid JSON:
{
  "oneLiner": "<what the company does in one sentence>",
  "productSummary": "<what they build/sell and who it's for>",
  "signals": ["<notable facts: size, customers, mission, funding, products, technologies>"],
  "address": "<postal address if found, otherwise null>",
  "contactInfo": { "name": null, "title": null, "email": null, "phone": null }
}
Never return empty strings — if you have partial knowledge, share it. Only return null for fields you have no information about at all.`,
            },
            {
              role: "user",
              content: `Company: ${job.company}\nJob title: ${job.title}\nLocation: ${job.location ?? "unknown"}\n\n${combinedContext}`,
            },
          ],
        });

        const raw = fallbackResponse.choices[0]?.message?.content;
        if (raw) {
          const result = JSON.parse(raw) as {
            oneLiner?: string;
            productSummary?: string;
            signals?: string[];
            address?: string | null;
            contactInfo?: ContactInfo | null;
          };
          if (result.oneLiner) companyResearchRaw.oneLiner = result.oneLiner;
          if (result.productSummary) companyResearchRaw.productSummary = result.productSummary;
          if (result.signals?.length) companyResearchRaw.signals = result.signals;
          if (!companyResearchRaw.address && result.address) companyResearchRaw.address = result.address;
          if (!companyResearchRaw.contactFromJobPosting && result.contactInfo?.email) {
            companyResearchRaw.contactFromJobPosting = result.contactInfo;
          }
          // Only include source URL if we actually fetched the website successfully
          if (websiteText.length > 50 && homepageUrl) companyResearchRaw.sourceUrls.push(homepageUrl);
          else companyResearchRaw.sourceUrls = [];
          console.log(`[agent/research-company] combined fallback: oneLiner="${result.oneLiner}", productSummary="${result.productSummary?.slice(0, 60)}"`);
        }
      } catch (fallbackErr) {
        console.error("[agent/research-company] combined fallback failed", fallbackErr);
      }
    }

    // If still empty after all fallbacks, nothing is known about this company
    if (!companyResearchRaw.oneLiner && !companyResearchRaw.productSummary) {
      await posthog.shutdown();
      return {
        success: false,
        error: `No information found for "${job.company}". The company may be too small or niche to appear in public records. Check the company name is correct and try again.`,
      };
    }

    // GPT-4o synthesis — always runs, even if browser research was empty

    const researchSourceLabel = stillEmpty
      ? " (from AI training knowledge — treat as approximate)"
      : browserResearchEmpty
        ? " (fetched directly from company website)"
        : " (scraped from their website)";

    const systemPrompt = `You are a sharp career strategist preparing a candidate to apply for a specific role. You are given (a) research about the company${researchSourceLabel}, (b) the job posting, and (c) the candidate's profile. Produce a concise, concrete briefing that gives this specific candidate an edge for this specific role.

Rules:
- Write ALL output in English. If any input text is in Danish, Swedish, Norwegian, or another language, translate it — do not quote it in the original language.
- Ground every company claim in the provided research or job posting. Never invent funding, customers, headcount, or facts. If research was thin, infer carefully from the job posting and say what's inferred.
- Be specific to THIS candidate. Connect their actual skills and past work to this company's stack, product, and values. No generic advice that would apply to anyone.
- Turn the candidate's missing skills into a strategy: how to frame the gap honestly and what adjacent experience to lean on.
- Talking points and questions must reference real things from the research, the kind of detail that signals the candidate did their homework.
- Keep every item tight: one or two sentences. No fluff.

Return ONLY valid JSON matching this shape:
{
  "companyOverview": string,
  "companyAddress": "<full postal address or null>",
  "locationShort": "<Town/City and Country only e.g. 'Copenhagen, Denmark' or 'London, UK' — extracted from companyAddress, or null if no address>",
  "contactInfo": { "name": "<name or null>", "title": "<job title or null>", "email": "<email or null>", "phone": "<phone or null>" } | null,
  "recruiterContact": { "name": "<recruiter name or null>", "title": "<recruiter title or null>", "email": "<recruiter email or null>", "phone": "<recruiter phone or null>", "company": "<recruiting agency name or null>" } | null,
  "techStack": string[],
  "culture": string[],
  "whyThisRole": string,
  "yourEdge": string[],
  "gapsToAddress": string[],
  "smartQuestions": string[],
  "interviewPrep": string[],
  "sources": string[]
}`;

    // Flatten subPages into a deduplicated summary for synthesis — these contain
    // culture/tech points extracted from the job description AND from browser sub-pages.
    // Previously excluded (subPages: undefined), which caused all JD-extracted context to be lost.
    const subPagesSummary = companyResearchRaw.subPages
      .filter((p) => p.keyPoints.length > 0 || p.technologies.length > 0 || p.valuesOrCulture.length > 0 || p.notable.length > 0)
      .map((p) => ({
        ...(p.keyPoints.length > 0 && { keyPoints: p.keyPoints }),
        ...(p.technologies.length > 0 && { technologies: p.technologies }),
        ...(p.valuesOrCulture.length > 0 && { valuesOrCulture: p.valuesOrCulture }),
        ...(p.notable.length > 0 && { notable: p.notable }),
      }));

    const userPrompt = `COMPANY RESEARCH (from their website):
${JSON.stringify({ ...companyResearchRaw, subPages: undefined })}
${subPagesSummary.length > 0 ? `\nADDITIONAL CONTEXT (from job description and sub-pages — always use this to enrich culture, tech stack, and company signals):\n${JSON.stringify(subPagesSummary)}` : ""}

COMPANY ADDRESS (extracted from website): ${companyResearchRaw.address ?? "Not found"}
CONTACT INFO FROM JOB POSTING: ${companyResearchRaw.contactFromJobPosting ? JSON.stringify(companyResearchRaw.contactFromJobPosting) : "Not found"}
RECRUITER CONTACT: ${companyResearchRaw.recruiterContact ? JSON.stringify(companyResearchRaw.recruiterContact) : "Not found"}

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
        max_tokens: 1500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      dossier = JSON.parse(response.choices[0].message.content!);
      // Override sources with actual scraped URLs — GPT-4o tends to hallucinate these
      dossier.sources = [...new Set(companyResearchRaw.sourceUrls.filter(Boolean))];

      // Preserve existing contact info and address if this run found nothing new.
      // Research runs on Cloudflare-protected jobs often can't access the source page,
      // so previously saved (or manually entered) contacts must not be wiped.
      const existing = job.company_research;
      if (existing) {
        const existingContact = existing.contactInfo as { name?: string | null; email?: string | null } | null;
        const newContact = dossier.contactInfo as { name?: string | null; email?: string | null } | null;
        if (!newContact?.name && !newContact?.email && (existingContact?.name || existingContact?.email)) {
          dossier.contactInfo = existingContact;
        }
        const existingRecruiter = existing.recruiterContact as { name?: string | null } | null;
        const newRecruiter = dossier.recruiterContact as { name?: string | null } | null;
        if (!newRecruiter?.name && existingRecruiter?.name) {
          dossier.recruiterContact = existingRecruiter;
        }
        if (!dossier.companyAddress && existing.companyAddress) {
          dossier.companyAddress = existing.companyAddress;
        }
      }
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

    // Save via direct HttpClient.post() — database.rpc() has a serialization layer that
    // silently swallows parameters; calling the underlying HTTP client bypasses it entirely.
    console.log("[agent/research-company] saving dossier to DB…");
    const httpClient = insforge.getHttpClient();
    try {
      await httpClient.post("/api/database/rpc/update_job_research", {
        p_job_id: jobId,
        p_user_id: userId,
        p_research: JSON.stringify(dossier),
      });
      console.log("[agent/research-company] dossier saved successfully");
    } catch (saveErr) {
      console.error("[agent/research-company] failed to save dossier", saveErr);
      await posthog.shutdown();
      return {
        success: false,
        error: "Research completed but could not be saved.",
      };
    }

    // Update job location with the town/country extracted from the company address
    const locationShort = dossier.locationShort as string | null | undefined;
    if (locationShort) {
      await insforge.database
        .from("jobs")
        .update({ location: locationShort })
        .eq("id", jobId)
        .eq("user_id", userId);
    }

    posthog.capture({
      distinctId: userId,
      event: "company_researched",
      properties: { userId, jobId, company: job.company },
    });
    await posthog.shutdown();

    // Warn if contact info or address could not be found
    const contact = dossier.contactInfo as { email?: string | null; phone?: string | null } | null;
    const hasContact = !!(contact?.email || contact?.phone);
    const hasAddress = !!(dossier.companyAddress as string | null);
    const missing: string[] = [];
    if (!hasContact) missing.push("contact info");
    if (!hasAddress) missing.push("address");
    const warning = missing.length > 0
      ? `Research complete, but ${missing.join(" and ")} could not be found.`
      : undefined;

    return { success: true, warning };
  } catch (err) {
    console.error("[agent/research-company]", err);
    await posthog.shutdown();
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
