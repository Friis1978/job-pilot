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
              content: `Return the official website URL for the given company. Only return a URL you are confident about — do not guess. Return JSON: { "url": "<full url or null>" }`,
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

    // Pre-process the stored job description to extract contact persons and company
    // culture/identity sections ("Hvem er vi?", "Om os", "About us", etc.) before
    // any browser research. The DB text is the authoritative source for this info.
    if (job.about_role) {
      try {
        const jdExtractResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          temperature: 0,
          max_tokens: 400,
          messages: [
            {
              role: "system",
              content: `Extract from this job description. The text may be in any language (Danish, Swedish, English, etc.).
Return ONLY valid JSON:
{
  "contactName": "<full name of the hiring contact / contact person mentioned for enquiries — or null>",
  "contactTitle": "<their job title — or null>",
  "contactEmail": "<their email address — or null>",
  "contactPhone": "<their phone number — or null>",
  "culturePoints": ["<sentences from sections like 'Hvem er vi?', 'Om os', 'About us', 'Vi er', 'Our culture' that describe the company identity, team size, values, or working environment>"]
}
Only extract contacts explicitly named in the text. For culturePoints include the actual content, not headings.`,
            },
            { role: "user", content: job.about_role.slice(0, 4000) },
          ],
        });

        const jdRaw = jdExtractResponse.choices[0]?.message?.content;
        if (jdRaw) {
          const jdParsed = JSON.parse(jdRaw) as {
            contactName?: string | null;
            contactTitle?: string | null;
            contactEmail?: string | null;
            contactPhone?: string | null;
            culturePoints?: string[];
          };

          if (jdParsed.contactName || jdParsed.contactEmail || jdParsed.contactPhone) {
            companyResearchRaw.contactFromJobPosting = {
              name: jdParsed.contactName ?? null,
              title: jdParsed.contactTitle ?? null,
              email: jdParsed.contactEmail ?? null,
              phone: jdParsed.contactPhone ?? null,
            };
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

      // Job posting contact extraction — runs first, uses real browser to handle JS-rendered ATS pages
      if (job.source_url) {
        try {
          await page.goto(job.source_url, { waitUntil: "networkidle" });

          // Extract mailto: links directly from the DOM — catches emails that job boards
          // visually obfuscate but leave in the HTML (e.g. Careerjet, some ATS platforms)
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

          const postingData = await stagehand.extract(
            "This is a job posting. Extract the contact person (recruiter or hiring manager) including their name, title, email and phone. Also extract the company's full postal address if shown.",
            jobPostingContactSchema,
          );
          if (postingData.contactName || postingData.contactEmail || postingData.contactPhone) {
            // Merge with pre-extracted contact (from about_role) — browser data fills gaps
            // but the job description text contact takes priority as the authoritative source.
            const existing = companyResearchRaw.contactFromJobPosting;
            companyResearchRaw.contactFromJobPosting = {
              name: existing?.name ?? postingData.contactName ?? null,
              title: existing?.title ?? postingData.contactTitle ?? null,
              email: existing?.email ?? postingData.contactEmail ?? null,
              phone: existing?.phone ?? postingData.contactPhone ?? null,
            };
          }
          if (postingData.recruiterName || postingData.recruiterEmail || postingData.recruiterPhone) {
            companyResearchRaw.recruiterContact = {
              name: postingData.recruiterName ?? null,
              title: postingData.recruiterTitle ?? null,
              email: postingData.recruiterEmail ?? null,
              phone: postingData.recruiterPhone ?? null,
              company: postingData.recruiterCompany ?? null,
            };
          }
          if (postingData.companyAddress) {
            companyResearchRaw.address = postingData.companyAddress;
          }

          // If Stagehand didn't find a named contact, read the full rendered page text
          // and run GPT-4o on it. Jooble tracking URLs redirect to the actual job posting
          // which may have the full description (contacts, "Hvem er vi?") that isn't
          // stored in about_role (Jooble only provides a short snippet).
          const missingNamedContact = !companyResearchRaw.contactFromJobPosting?.name;
          if (missingNamedContact) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const pageText = (await page.evaluate(() => (document as any).body.innerText)) as string;
              const currentAboutRole = job.about_role ?? "";

              if (pageText && pageText.length > currentAboutRole.length + 100) {
                const pageExtractResponse = await openai.chat.completions.create({
                  model: "gpt-4o",
                  response_format: { type: "json_object" },
                  temperature: 0,
                  max_tokens: 500,
                  messages: [
                    {
                      role: "system",
                      content: `Extract from this job posting page. The text may be in any language (Danish, Swedish, English, etc.).
Return ONLY valid JSON:
{
  "contactName": "<full name of a person explicitly listed as a contact for enquiries — or null>",
  "contactTitle": "<their job title — or null>",
  "contactEmail": "<their email address — or null>",
  "contactPhone": "<their phone number — or null>",
  "culturePoints": ["<sentences from 'Hvem er vi?', 'Om os', 'About us', or similar company identity sections>"],
  "fullDescription": "<the main job description text — omit nav, footer, cookie banners>"
}
Only include contacts explicitly named in the text. Do not infer.`,
                    },
                    { role: "user", content: pageText.slice(0, 5000) },
                  ],
                });

                const pageRaw = pageExtractResponse.choices[0]?.message?.content;
                if (pageRaw) {
                  const pageParsed = JSON.parse(pageRaw) as {
                    contactName?: string | null;
                    contactTitle?: string | null;
                    contactEmail?: string | null;
                    contactPhone?: string | null;
                    culturePoints?: string[];
                    fullDescription?: string;
                  };

                  if (pageParsed.contactName || pageParsed.contactEmail || pageParsed.contactPhone) {
                    const existing = companyResearchRaw.contactFromJobPosting;
                    companyResearchRaw.contactFromJobPosting = {
                      name: existing?.name ?? pageParsed.contactName ?? null,
                      title: existing?.title ?? pageParsed.contactTitle ?? null,
                      email: existing?.email ?? pageParsed.contactEmail ?? null,
                      phone: existing?.phone ?? pageParsed.contactPhone ?? null,
                    };
                  }

                  const culturePoints = pageParsed.culturePoints ?? [];
                  if (culturePoints.length > 0) {
                    companyResearchRaw.subPages.push({
                      keyPoints: [],
                      technologies: [],
                      valuesOrCulture: culturePoints,
                      notable: [],
                      address: null,
                    });
                  }

                  // If the page text is much richer than the stored snippet, update about_role
                  const fullDesc = pageParsed.fullDescription;
                  if (fullDesc && fullDesc.length > currentAboutRole.length + 200) {
                    await insforge.database
                      .from("jobs")
                      .update({ about_role: fullDesc.slice(0, 8000) })
                      .eq("id", jobId)
                      .eq("user_id", userId);
                  }
                }
              }
            } catch (pageTextErr) {
              console.error("[agent/research-company] page text extraction failed", pageTextErr);
            }
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

    const userPrompt = `COMPANY RESEARCH (from their website):
${JSON.stringify({ ...companyResearchRaw, subPages: undefined })}

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
