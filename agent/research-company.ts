import { completeJson } from "@/lib/ai/claude";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { stripHtml } from "@/lib/utils";
import type { Profile } from "@/types";
import { TokenAccumulator } from "@/lib/track-tokens";

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

// Try a list of candidate URLs and return the first that responds successfully.
// When companySlugCheck is provided, the page content must contain it — prevents
// accepting parked domains that return 200 with generic parking page content.
async function probeUrls(candidates: string[], companySlugCheck?: string): Promise<string | null> {
  for (const url of candidates) {
    try {
      if (companySlugCheck) {
        // Full GET so we can inspect content — parked domains return 200 but have no real content
        const res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(6000),
        });
        if (!res.ok || res.status >= 400) continue;
        const html = await res.text();
        const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();
        // Must have real content AND mention the company (guards against parking pages)
        // 2000 chars minimum — parked domain "for sale" pages are short (< 500 chars) but
        // still mention the company name in the domain string, defeating a short threshold.
        if (text.length < 2000 || !text.includes(companySlugCheck)) continue;
        // Return the final URL after any redirects (res.url), NOT the input URL.
        // If pandektes.dk → 301 → pandektes.com, we want pandektes.com so that
        // all subsequent path construction uses the correct base domain.
        return res.url || url;
      } else {
        const res = await fetch(url, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok || res.status < 400) return url;
      }
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
    // it's likely an ATS/redirect we don't recognise — ask the model for the real URL.
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

    const tokenAcc = new TokenAccumulator();

    // Resolve company homepage URL
    const { url: resolvedUrl, needsGptLookup } = job.source_url
      ? await resolveCompanyUrl(job.source_url, job.company)
      : { url: `https://www.${job.company.toLowerCase().replace(/\s+/g, "")}.com`, needsGptLookup: true };

    let homepageUrl = resolvedUrl;

    // When the redirect didn't land on the company's own site, ask the model for
    // the official URL — it knows most companies including non-English ones.
    if (needsGptLookup) {
      let gptFoundUrl = false;
      try {
        const urlResponse = await completeJson<unknown>({
          userId,
          maxTokens: 100,
          effort: "low",
          system: `Return the official website URL for the given company.
IMPORTANT: If the job is in Denmark, Sweden, Norway, Finland, Germany, Netherlands, or another non-US country, return the LOCAL or REGIONAL entity's website (e.g. a .dk, .se, .no, .fi, .de, .nl, or .eu domain), NOT the US/global parent company's website. For example, if the company is a Danish subsidiary or European entity, return the Danish/European URL — not the American headquarters.
Only return a URL you are confident about — do not guess. Return JSON: { "url": "<full url or null>" }`,
          user: `Company: ${job.company}\nJob title: ${job.title}\nJob location: ${job.location ?? "unknown"}\nJob description excerpt: ${(job.about_role ?? "").slice(0, 600)}`,
        });
        tokenAcc.add(urlResponse.usage, urlResponse.model);
        const parsed = (urlResponse.data ?? {}) as { url?: string | null };
        if (parsed.url) {
          homepageUrl = parsed.url;
          gptFoundUrl = true;
        }
      } catch (urlErr) {
        console.error("[agent/research-company] URL lookup failed", urlErr);
      }

      // NOTE: We intentionally do NOT override homepageUrl with a local TLD guess here.
      // The model's URL is the most reliable signal — overriding it with a probed .dk/.se URL
      // risks accepting parked domains (which return 200 and mention the company name in their text).
      // Instead, country TLD variants are added to `homepagesToTry` below so the browser
      // tries both the GPT URL and any local TLD versions.

      // The model doesn't know this company — probe common URL patterns before falling
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
          // .com fallback — also try .io and .ai for tech/startup companies
          `https://www.${slug}.com`,
          `https://${slug}.com`,
          ...(slugH !== slug ? [`https://www.${slugH}.com`, `https://${slugH}.com`] : []),
          `https://${slug}.io`,
          `https://www.${slug}.io`,
          `https://${slug}.ai`,
          `https://www.${slug}.ai`,
        ];
        const probed = await probeUrls(candidates, slug.slice(0, 5));
        if (probed) {
          homepageUrl = probed;
          console.log(`[agent/research-company] URL probing found: ${probed}`);
        }
      }
    }

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
    if (job.about_role) {
      try {
        const jdExtractResponse = await completeJson<unknown>({
          userId,
          maxTokens: 1000,
          effort: "low",
          system: `Extract from this job description. The text may be in any language (Danish, Swedish, English, etc.). Read the ENTIRE text including the end where contact/application instructions often appear.
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
          user: job.about_role.slice(0, 8000),
        });

        tokenAcc.add(jdExtractResponse.usage, jdExtractResponse.model);
        const jdRaw = jdExtractResponse.data;
        if (jdRaw) {
          const jdParsed = jdRaw as {
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
          }

          if (jdParsed.recruiterName || jdParsed.recruiterEmail || jdParsed.recruiterPhone) {
            companyResearchRaw.recruiterContact = {
              name: jdParsed.recruiterName ?? null,
              title: jdParsed.recruiterTitle ?? null,
              email: jdParsed.recruiterEmail ?? null,
              phone: jdParsed.recruiterPhone ?? null,
              company: jdParsed.recruiterCompany ?? null,
            };
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
            const httpExtractResponse = await completeJson<unknown>({
              userId,
              maxTokens: 900,
              effort: "low",
              system: `Extract from this job posting page. The text may be in any language (Danish, Swedish, English, etc.). Read the entire text — contact info often appears at the end.
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
              user: rawText.slice(0, 10000),
            });
            tokenAcc.add(httpExtractResponse.usage, httpExtractResponse.model);
            const httpRaw = httpExtractResponse.data;
            console.log(`[research-company] HTTP extract: ${httpExtractResponse.text.slice(0, 300)}`);
            if (httpRaw) {
              const httpParsed = httpRaw as {
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

    // ── HTTP-based research (no browser required) ─────────────────────────
    try {
      // Strip HTML to plain text
      const stripHtmlToText = (html: string): string =>
        html
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<!--[\s\S]*?-->/g, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      // Extract and classify internal links from raw HTML
      const extractInternalLinks = (html: string, baseUrl: string): Array<{ url: string; kind: string }> => {
        try {
          const base = new URL(baseUrl);
          const links: Array<{ url: string; kind: string }> = [];
          const seen = new Set<string>();
          const regex = /href=["']([^"'#\s]+)["']/gi;
          let m;
          while ((m = regex.exec(html)) !== null) {
            try {
              const url = new URL(m[1], baseUrl);
              if (url.hostname !== base.hostname) continue;
              const path = url.pathname.toLowerCase();
              if (seen.has(path) || path === "/" || path === "") continue;
              seen.add(path);
              let kind = "other";
              if (/\b(about|om-os|uber-uns|a-propos|sobre)\b/i.test(path)) kind = "about";
              else if (/\b(contact|kontakt)\b/i.test(path)) kind = "contact";
              else if (/\b(career|jobs|work|join|vacancy|hiring)\b/i.test(path)) kind = "careers";
              else if (/\b(blog|news|article|press|story)\b/i.test(path)) kind = "blog";
              else if (/\b(team|people|staff)\b/i.test(path)) kind = "team";
              else if (/\b(engineering|tech|developer|platform)\b/i.test(path)) kind = "engineering";
              else if (/\b(product|solution|feature|service)\b/i.test(path)) kind = "product";
              if (kind !== "other") links.push({ url: url.href, kind });
            } catch { /* skip malformed */ }
          }
          return links.slice(0, 10);
        } catch { return []; }
      };

      // Fetch a URL and return stripped plain text
      const fetchText = async (url: string, timeoutMs = 10000): Promise<{ text: string; finalUrl: string }> => {
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5,da;q=0.3",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!res.ok) return { text: "", finalUrl: url };
          const html = await res.text();
          return { text: stripHtmlToText(html), finalUrl: res.url || url };
        } catch { return { text: "", finalUrl: url }; }
      };

      // Fetch raw HTML for link extraction
      const fetchHtml = async (url: string, timeoutMs = 10000): Promise<{ html: string; finalUrl: string }> => {
        try {
          const res = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5,da;q=0.3",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (!res.ok) return { html: "", finalUrl: url };
          const html = await res.text();
          return { html, finalUrl: res.url || url };
        } catch { return { html: "", finalUrl: url }; }
      };

      // Parse DuckDuckGo HTML result links (uddg= param or direct hrefs)
      const parseDdgLinks = (html: string): string[] => {
        const links: string[] = [];
        const uddgRegex = /uddg=([^&"'\s]+)/gi;
        let m;
        while ((m = uddgRegex.exec(html)) !== null) {
          try {
            const url = decodeURIComponent(m[1]);
            if (url.startsWith("http")) links.push(url);
          } catch { /* skip */ }
        }
        return [...new Set(links)];
      };

      // Extract job posting contact info and update companyResearchRaw
      const extractPageForJobPosting = async (pageText: string): Promise<boolean> => {
        if (!pageText || pageText.length < 300) return false;
        try {
          const res = await completeJson<unknown>({
            userId,
            maxTokens: 1000,
            effort: "low",
            system: `Extract from this job posting page. May be in any language (Danish, English, etc.).
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
  "culturePoints": ["<sentences from About us / Om os / company description sections>"]
}
Only extract contacts explicitly named in the text.`,
            user: pageText.slice(0, 12000),
          });
          tokenAcc.add(res.usage, res.model);
          const raw = res.data;
          if (!raw) return false;
          const parsed = raw as {
            contactName?: string | null; contactTitle?: string | null;
            contactEmail?: string | null; contactPhone?: string | null;
            recruiterName?: string | null; recruiterTitle?: string | null;
            recruiterEmail?: string | null; recruiterPhone?: string | null;
            recruiterCompany?: string | null; culturePoints?: string[];
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
          if ((parsed.culturePoints?.length ?? 0) > 0) {
            companyResearchRaw.subPages.push({
              keyPoints: [], technologies: [],
              valuesOrCulture: parsed.culturePoints ?? [],
              notable: [], address: null,
            });
          }
          return !!(parsed.contactName || parsed.contactEmail || parsed.contactPhone || parsed.recruiterName || parsed.recruiterEmail);
        } catch { return false; }
      };

      // ── DDG: search for job posting to find contact info ─────────────────
      const PREFER_JOB_BOARDS = ["jobbank.dk", "jobindex.dk", "karriere.dk", "thehub.io", "linkedin.com"];
      const SKIP_JOB_SEARCH = ["careerjet", "jooble", "jobviewtrack", "stepstone", "adzuna", "facebook.com", "twitter.com", "youtube.com"];

      try {
        const brandMatch = job.title.match(/^([\w\s]{2,30}?)\s+søger\b/i);
        const titleBrand = brandMatch ? brandMatch[1].trim() : null;
        const TITLE_STOP_WORDS = new Set(["søger", "senior", "junior", "lead", "and", "for", "med", "til", "ved", "hos"]);
        const coreTitleTerms = job.title
          .replace(/^[\w\s]+?\s+søger\s*/i, "")
          .replace(/["""()/\\]/g, " ")
          .split(/[\s/]+/)
          .filter((w) => w.length > 3 && !TITLE_STOP_WORDS.has(w.toLowerCase()))
          .slice(0, 4);
        const companyTerms = [job.company];
        if (titleBrand && titleBrand.toLowerCase() !== job.company.toLowerCase()) companyTerms.push(titleBrand);

        const jobSearchQuery = `${companyTerms.join(" ")} ${coreTitleTerms.join(" ")} kontakt jobbank jobindex karriere`;
        console.log(`[research-company] DDG job posting query: ${jobSearchQuery}`);

        let { html: ddgHtml } = await fetchHtml(
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(jobSearchQuery)}&kl=dk-da`,
          12000,
        );
        let ddgLinks = parseDdgLinks(ddgHtml);

        if (ddgLinks.length === 0) {
          const fallbackQuery = `"${job.company}" job kontakt stillingsbeskrivelse`;
          console.log(`[research-company] DDG job posting fallback: ${fallbackQuery}`);
          ({ html: ddgHtml } = await fetchHtml(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(fallbackQuery)}&kl=dk-da`,
            12000,
          ));
          ddgLinks = parseDdgLinks(ddgHtml);
        }

        const sortedLinks = [
          ...ddgLinks.filter((u) => PREFER_JOB_BOARDS.some((d) => u.includes(d))),
          ...ddgLinks.filter((u) => !PREFER_JOB_BOARDS.some((d) => u.includes(d)) && !SKIP_JOB_SEARCH.some((d) => u.includes(d))),
        ];

        console.log(`[research-company] DDG job posting found ${sortedLinks.length} candidates`);
        for (const url of sortedLinks.slice(0, 3)) {
          const { text } = await fetchText(url, 15000);
          if (text.length < 300) continue;
          const found = await extractPageForJobPosting(text);
          if (found) break;
        }
      } catch (jobSearchErr) {
        console.error("[research-company] DDG job posting search failed", jobSearchErr);
      }

      // ── Homepage extraction ───────────────────────────────────────────────
      const slug = companySlug(job.company);
      const slugH = companySlugHyphen(job.company);
      const comCandidates = [
        `https://${slug}.com`, `https://www.${slug}.com`,
        ...(slugH !== slug ? [`https://${slugH}.com`, `https://www.${slugH}.com`] : []),
        `https://${slug}.io`, `https://www.${slug}.io`,
        `https://${slug}.ai`, `https://www.${slug}.ai`,
      ];
      const countryTldsForHomepage = countryTldsFromLocation(job.location);
      const countryTldCandidates = countryTldsForHomepage.flatMap((tld) => [
        `https://${slug}.${tld}`, `https://www.${slug}.${tld}`,
        ...(slugH !== slug ? [`https://${slugH}.${tld}`, `https://www.${slugH}.${tld}`] : []),
      ]);
      const homepagesToTry: string[] = [homepageUrl];
      for (const c of [...countryTldCandidates, ...comCandidates]) {
        try {
          if (new URL(c).hostname !== new URL(homepageUrl).hostname) homepagesToTry.push(c);
        } catch { /* skip malformed */ }
      }

      let homepageData: {
        oneLiner?: string; productSummary?: string; signals?: string[];
        pageLinks?: Array<{ url: string; kind: string }>;
      } | null = null;
      let usedHomepageUrl = homepageUrl;

      for (const candidateUrl of homepagesToTry) {
        try {
          const { html: homeHtml, finalUrl } = await fetchHtml(candidateUrl, 12000);
          if (!homeHtml || homeHtml.length < 500) continue;
          const homeText = stripHtmlToText(homeHtml).slice(0, 5000);
          if (homeText.length < 200) continue;
          const htmlLinks = extractInternalLinks(homeHtml, finalUrl);

          const homeExtract = await completeJson<unknown>({
            userId,
            maxTokens: 600,
            effort: "low",
            system: `This is a company homepage. Extract what the company does and identify internal pages worth visiting.
Return ONLY valid JSON:
{
  "oneLiner": "<what the company does in one sentence>",
  "productSummary": "<what they build/sell and who it's for>",
  "signals": ["<funding, customers, scale, mission, news>"],
  "pageLinks": [{ "url": "<absolute URL>", "kind": "<about|contact|blog|engineering|product|team|other>" }]
}
For pageLinks, select the most useful internal pages to research the company as an employer. Use only URLs from the provided links list.`,
            user: `Page text:\n${homeText}\n\nInternal links found:\n${htmlLinks.map((l) => `${l.url} (${l.kind})`).join("\n")}`,
          });

          tokenAcc.add(homeExtract.usage, homeExtract.model);
          const homeRaw = homeExtract.data;
          if (!homeRaw) continue;
          const homeParsed = homeRaw as {
            oneLiner?: string; productSummary?: string; signals?: string[];
            pageLinks?: Array<{ url: string; kind: string }>;
          };
          if (homeParsed?.oneLiner || homeParsed?.productSummary) {
            const gptLinks = homeParsed?.pageLinks ?? [];
            const extraLinks = htmlLinks.filter((hl) => !gptLinks.some((gl: { url: string }) => gl.url === hl.url));
            homepageData = { ...homeParsed, pageLinks: [...gptLinks, ...extraLinks] };
            usedHomepageUrl = finalUrl;
            homepageUrl = finalUrl;
            companyResearchRaw.sourceUrls = [finalUrl];
            console.log(`[research-company] homepage found at: ${finalUrl}`);
            break;
          }
          console.log(`[research-company] homepage empty at: ${candidateUrl} — trying next`);
        } catch {
          console.log(`[research-company] homepage fetch failed at: ${candidateUrl} — trying next`);
        }
      }

      companyResearchRaw.oneLiner = homepageData?.oneLiner ?? "";
      companyResearchRaw.productSummary = homepageData?.productSummary ?? "";
      companyResearchRaw.signals = homepageData?.signals ?? [];

      // ── About page extraction ─────────────────────────────────────────────
      const aboutVariants = ["/about", "/about-us", "/om-os"];
      try {
        const m = new URL(usedHomepageUrl).pathname.match(/^\/([a-z]{2})(?:\/|$)/);
        if (m) {
          const lp = `/${m[1]}`;
          aboutVariants.unshift(...["/about", "/about-us", "/om-os"].map((p) => `${lp}${p}`));
        }
      } catch { /* keep defaults */ }

      for (const aboutPath of aboutVariants) {
        const currentAddressReal = !!companyResearchRaw.address && /\d/.test(companyResearchRaw.address);
        if (currentAddressReal) break;
        try {
          const aboutUrl = new URL(aboutPath, usedHomepageUrl).href;
          const { text: aboutText } = await fetchText(aboutUrl, 12000);
          if (aboutText.length < 200) continue;
          const slice = aboutText.length > 9000
            ? aboutText.slice(0, 1000) + " … " + aboutText.slice(-8000)
            : aboutText;

          const aboutExtract = await completeJson<unknown>({
            userId,
            maxTokens: 600,
            effort: "low",
            system: `Extract from this company about/contact page. May be in any language.
Return ONLY valid JSON:
{
  "keyPoints": ["<key facts about the company>"],
  "technologies": ["<specific languages, frameworks, tools>"],
  "valuesOrCulture": ["<values, working style, team norms>"],
  "notable": ["<customers, funding, scale, awards>"],
  "address": "<full postal address including street, city, zip, country — or null>",
  "contactName": "<contact person name — or null>",
  "contactTitle": "<their job title — or null>",
  "contactEmail": "<email address — or null>",
  "contactPhone": "<phone number — or null>"
}
If multiple office addresses are listed, prefer the one in the same country as the job location: ${job.location ?? "unknown"}.`,
            user: slice,
          });

          tokenAcc.add(aboutExtract.usage, aboutExtract.model);
          const aboutRaw = aboutExtract.data;
          if (!aboutRaw) continue;
          const aboutData = aboutRaw as {
            keyPoints?: string[]; technologies?: string[]; valuesOrCulture?: string[];
            notable?: string[]; address?: string | null;
            contactName?: string | null; contactTitle?: string | null;
            contactEmail?: string | null; contactPhone?: string | null;
          };

          if (aboutData.address && /\d/.test(aboutData.address)) {
            companyResearchRaw.address = aboutData.address;
          }
          if (!companyResearchRaw.contactFromJobPosting && (aboutData.contactName || aboutData.contactEmail)) {
            companyResearchRaw.contactFromJobPosting = {
              name: aboutData.contactName ?? null,
              title: aboutData.contactTitle ?? null,
              email: aboutData.contactEmail ?? null,
              phone: aboutData.contactPhone ?? null,
            };
          }
          if ((aboutData.keyPoints?.length ?? 0) > 0 || (aboutData.valuesOrCulture?.length ?? 0) > 0 || (aboutData.technologies?.length ?? 0) > 0) {
            companyResearchRaw.subPages.push({
              keyPoints: aboutData.keyPoints ?? [],
              technologies: aboutData.technologies ?? [],
              valuesOrCulture: aboutData.valuesOrCulture ?? [],
              notable: aboutData.notable ?? [],
              address: aboutData.address ?? null,
            });
          }
          companyResearchRaw.sourceUrls.push(aboutUrl);
          if (companyResearchRaw.address && /\d/.test(companyResearchRaw.address)) break;
        } catch { /* try next variant */ }
      }

      // ── Sub-page extraction from homepage links ───────────────────────────
      if (homepageData?.oneLiner || homepageData?.productSummary) {
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
            const { text: subText } = await fetchText(link.url, 12000);
            if (subText.length < 200) continue;
            const slice = subText.length > 7000
              ? subText.slice(0, 1000) + " … " + subText.slice(-6000)
              : subText;
            const extractInstruction =
              link.kind === "contact" || link.kind === "about"
                ? `Extract the full postal address (street number, city, zip, country), any email addresses, phone numbers, and contact person names/titles. Also extract what the company does, their values, and team culture. If multiple office addresses are listed, prefer the one in the same country as the job location: ${job.location ?? "unknown"}.`
                : "Extract substance that helps a candidate understand this company before applying: what they do, their values and how they work, the specific technologies and tools they use, notable projects or customers, and how the team operates. Ignore nav, footers, cookie banners, and generic marketing copy.";

            const subExtract = await completeJson<unknown>({
              userId,
              maxTokens: 500,
              effort: "low",
              system: `${extractInstruction}
Return ONLY valid JSON:
{
  "keyPoints": ["<key facts>"],
  "technologies": ["<languages, frameworks, tools, platforms>"],
  "valuesOrCulture": ["<values, working style, team culture>"],
  "notable": ["<funding, headcount, customers, partnerships, awards>"],
  "address": "<full postal address — or null>",
  "contactName": "<contact name — or null>",
  "contactEmail": "<contact email — or null>",
  "contactPhone": "<contact phone — or null>"
}`,
              user: slice,
            });

            tokenAcc.add(subExtract.usage, subExtract.model);
            const subRaw = subExtract.data;
            if (!subRaw) continue;
            const subData = subRaw as {
              keyPoints?: string[]; technologies?: string[]; valuesOrCulture?: string[];
              notable?: string[]; address?: string | null;
              contactName?: string | null; contactEmail?: string | null; contactPhone?: string | null;
            };

            if ((subData.keyPoints?.length ?? 0) > 0 || (subData.technologies?.length ?? 0) > 0 || (subData.valuesOrCulture?.length ?? 0) > 0 || (subData.notable?.length ?? 0) > 0) {
              companyResearchRaw.subPages.push({
                keyPoints: subData.keyPoints ?? [],
                technologies: subData.technologies ?? [],
                valuesOrCulture: subData.valuesOrCulture ?? [],
                notable: subData.notable ?? [],
                address: subData.address ?? null,
              });
              if (subData.address && !companyResearchRaw.address) companyResearchRaw.address = subData.address;
              if (!companyResearchRaw.contactFromJobPosting && (subData.contactName || subData.contactEmail)) {
                companyResearchRaw.contactFromJobPosting = {
                  name: subData.contactName ?? null, title: null,
                  email: subData.contactEmail ?? null, phone: subData.contactPhone ?? null,
                };
              }
              companyResearchRaw.sourceUrls.push(link.url);
            }
          } catch (subErr) {
            console.error(`[research-company] sub-page fetch failed: ${link.url}`, subErr);
          }
        }
      }

      // ── DDG: company research (fallback when homepage yielded nothing) ────
      if (!companyResearchRaw.oneLiner && !companyResearchRaw.productSummary) {
        try {
          const companySearchQuery = `${job.company} ${job.title} company`;
          console.log(`[research-company] DDG company research query: ${companySearchQuery}`);
          const { html: companyDdgHtml } = await fetchHtml(
            `https://html.duckduckgo.com/html/?q=${encodeURIComponent(companySearchQuery)}&kl=dk-da`,
            12000,
          );
          const companyLinks = parseDdgLinks(companyDdgHtml).filter(
            (u) => !SKIP_JOB_SEARCH.some((d) => u.includes(d)),
          );

          let ddgVisited = 0;
          for (const resultUrl of companyLinks.slice(0, 3)) {
            if (ddgVisited >= 2) break;
            try {
              const { text: resultText } = await fetchText(resultUrl, 12000);
              if (resultText.length < 200) continue;

              const ddgExtract = await completeJson<unknown>({
                userId,
                maxTokens: 500,
                effort: "low",
                system: `Extract company information from this page.
Return ONLY valid JSON:
{
  "keyPoints": ["<key facts>"],
  "technologies": ["<languages, frameworks, tools, platforms>"],
  "valuesOrCulture": ["<values, working style, team culture>"],
  "notable": ["<funding, headcount, customers, partnerships, awards>"],
  "contactName": "<contact name — or null>",
  "contactEmail": "<contact email — or null>",
  "contactPhone": "<contact phone — or null>",
  "address": "<full postal address — or null>"
}
Skip nav, footers, cookie banners, and marketing boilerplate.`,
                user: resultText.slice(0, 6000),
              });

              tokenAcc.add(ddgExtract.usage, ddgExtract.model);
              const ddgRaw = ddgExtract.data;
              if (!ddgRaw) continue;
              const ddg = ddgRaw as {
                keyPoints?: string[]; technologies?: string[]; valuesOrCulture?: string[];
                notable?: string[]; contactName?: string | null; contactEmail?: string | null;
                contactPhone?: string | null; address?: string | null;
              };
              if ((ddg.keyPoints?.length ?? 0) > 0 || (ddg.technologies?.length ?? 0) > 0 || (ddg.valuesOrCulture?.length ?? 0) > 0 || (ddg.notable?.length ?? 0) > 0) {
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
                ddgVisited++;
              }
            } catch (ddgResultErr) {
              console.error("[research-company] DDG result visit failed", resultUrl, ddgResultErr);
            }
          }
        } catch (ddgErr) {
          console.error("[research-company] DuckDuckGo company search failed", ddgErr);
        }
      }
    } catch (httpResearchErr) {
      console.error("[agent/research-company] HTTP research error", httpResearchErr);
      // Never rethrow — fall through to synthesis with whatever was collected
    }

    // A real postal address always contains a digit (street number or zip code).
    // "Copenhagen HQ", "Remote", etc. are location hints, not real addresses — treat as missing.
    const hasRealAddress = !!companyResearchRaw.address && /\d/.test(companyResearchRaw.address);

    // Fallback: if no real address or contact info found, try common contact/about page paths directly
    if (!hasRealAddress || !companyResearchRaw.contactFromJobPosting) {
      const basePaths = [
        "/kontakt", "/contact", "/contact-us", "/contactus",
        "/om-os", "/about", "/about-us", "/about-us/contact",
        "/find-os", "/find-us",
        "/kontakt-os", "/kontaktoplysninger",
        "/vi-er-her", "/company/contact",
      ];
      // Detect language prefix from any visited source URL (e.g. /da/, /en/, /de/)
      let httpLangPrefix = "";
      for (const src of companyResearchRaw.sourceUrls) {
        try {
          const m = new URL(src).pathname.match(/^\/([a-z]{2})(?:\/|$)/);
          if (m) { httpLangPrefix = `/${m[1]}`; break; }
        } catch { /* skip */ }
      }
      // Always try common language prefixes for European companies — don't rely solely on
      // prefix detection from visited URLs (which fails when the browser phase doesn't run).
      // Covers sites like pandektes.com/da/about where /about alone returns nothing useful.
      const langPrefixesToTry = ["/da", "/en", "/de", "/sv", "/no"];
      const prefixedPaths = [
        // Detected prefix first (most likely correct), then other common prefixes
        ...(httpLangPrefix ? basePaths.map((p) => `${httpLangPrefix}${p}`) : []),
        ...langPrefixesToTry
          .filter((p) => p !== httpLangPrefix)
          .flatMap((p) => basePaths.map((base) => `${p}${base}`)),
      ];
      // Plain paths + prefixed paths. Plain paths first in case the site supports them directly.
      const contactPaths = [...basePaths, ...prefixedPaths];

      // Always try paths against BOTH the resolved domain AND the .com equivalent.
      // Rule: "always search both locale (e.g. .dk) and .com domains".
      // pandektes.dk may not have /about, but pandektes.com/da/about has the address.
      const slugForHttp = companySlug(job.company);
      const slugHForHttp = companySlugHyphen(job.company);
      const httpBaseCandidates: string[] = [homepageUrl];
      for (const c of [
        `https://www.${slugForHttp}.com`,
        `https://${slugForHttp}.com`,
        ...(slugHForHttp !== slugForHttp ? [`https://www.${slugHForHttp}.com`, `https://${slugHForHttp}.com`] : []),
      ]) {
        try {
          if (new URL(c).hostname !== new URL(homepageUrl).hostname) httpBaseCandidates.push(c);
        } catch { /* skip malformed */ }
      }

      // Use a mutable flag so we can break early once a real address AND contact are found
      let httpFoundRealAddress = hasRealAddress;
      outer: for (const httpBase of httpBaseCandidates) {
        for (const path of contactPaths) {
          if (httpFoundRealAddress && companyResearchRaw.contactFromJobPosting) break outer;
          try {
            const contactUrl = new URL(path, httpBase).href;
          const res = await fetch(contactUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
          });
          if (!res.ok) continue;
          const html = await res.text();
          // Strip script/style BEFORE stripping tags — otherwise JS and CSS text content
          // inflates the char count to 100k+, burying the actual address in noise.
          const cleanedHtml = html
            .replace(/<style[\s\S]*?<\/style>/gi, "")
            .replace(/<script[\s\S]*?<\/script>/gi, "");
          const fullText = cleanedHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
          if (fullText.length < 200) continue;
          // Addresses are typically at the bottom — take a generous tail slice.
          // Pandektes-style pages have ~194k chars of text; the address is at ~94% depth
          // (~11k chars from the end). A 2000-char tail misses it — use 8000 to be safe.
          const text = fullText.length > 9000
            ? fullText.slice(0, 1000) + " … " + fullText.slice(-8000)
            : fullText;

          const response = await completeJson<unknown>({
            userId,
            maxTokens: 250,
            effort: "low",
            system: `Extract from this company page. The page may be in any language.
Return ONLY valid JSON:
{
  "address": "<full postal address including street, city, zip, country — or null if not found>",
  "contactName": "<full name of a contact person (HR, hiring manager, or general contact) — or null>",
  "contactTitle": "<their job title — or null>",
  "contactEmail": "<their email address or a general contact email — or null>",
  "contactPhone": "<their phone number or a general contact phone — or null>"
}
If multiple office addresses appear on the page, return the one in the same country as the job location: ${job.location ?? "unknown"}. Only fall back to a different country's address if no local address exists.`,
            user: text,
          });

          tokenAcc.add(response.usage, response.model);
          const raw = response.data;
          if (raw) {
            const parsed = raw as {
              address?: string | null;
              contactName?: string | null;
              contactTitle?: string | null;
              contactEmail?: string | null;
              contactPhone?: string | null;
            };
            // Write address if we don't have a real one yet (with a digit = real postal address)
            if (parsed.address && !httpFoundRealAddress) {
              companyResearchRaw.address = parsed.address;
              if (/\d/.test(parsed.address)) {
                httpFoundRealAddress = true; // stop overwriting with a later path's result
              }
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
    }

    // If browser research found nothing, try all available sources in one combined call:
    // 1. Plain HTTP fetch of the company website
    // 2. The job posting itself (which usually contains an "About the company" section)
    // 3. The model's own training knowledge as implicit fallback
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
        const fallbackResponse = await completeJson<unknown>({
          userId,
          maxTokens: 500,
          effort: "low",
          system: `You are extracting company information. You have access to the company website text and/or the job posting. Job postings almost always include a company description section (often labelled "About us", "Om virksomheden", "About the company" or similar).

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
          user: `Company: ${job.company}\nJob title: ${job.title}\nLocation: ${job.location ?? "unknown"}\n\n${combinedContext}`,
        });

        tokenAcc.add(fallbackResponse.usage, fallbackResponse.model);
        const raw = fallbackResponse.data;
        if (raw) {
          const result = raw as {
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

    // Synthesis — always runs, even if browser research was empty

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
  "companyAddress": "<full postal address or null — if multiple addresses were found, prefer the one in the same country as the job location: ${job.location ?? "unknown"}>",
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
      const response = await completeJson<unknown>({
        userId,
        maxTokens: 1500,
        effort: "low",
        system: systemPrompt,
        user: userPrompt,
      });

      tokenAcc.add(response.usage, response.model);
      dossier = (response.data ?? {}) as Record<string, unknown>;
      // Override sources with actual scraped URLs — the model tends to hallucinate these
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

    tokenAcc.flush(userId, "research_company");
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
