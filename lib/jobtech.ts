import type { NormalizedJob } from "@/types";
import { stripHtml } from "@/lib/utils";

type JobTechHit = {
  id: string;
  headline: string;
  description: { text: string };
  employer: { name: string };
  workplace_address: { city?: string; region?: string };
  webpage_url: string;
  employment_type?: { label: string };
  salary_description?: string;
};

type JobTechResponse = {
  hits: JobTechHit[];
};

/**
 * Searches the Swedish JobTech Dev API (jobtechdev.se) by job title.
 * The API is Sweden-only; no location filter is applied — results are always Swedish postings.
 */
export async function searchJobsSweden(jobTitle: string): Promise<NormalizedJob[]> {
  const params = new URLSearchParams({
    q: jobTitle,
    limit: "10",
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.JOBTECH_API_KEY) {
    headers["api-key"] = process.env.JOBTECH_API_KEY;
  }

  const response = await fetch(
    `https://jobsearch.api.jobtechdev.se/search?${params}`,
    { headers },
  );

  if (!response.ok) {
    throw new Error(`JobTech API error: ${response.status}`);
  }

  const data: JobTechResponse = await response.json();

  return (data.hits ?? []).map((hit) => ({
    id: hit.id,
    title: hit.headline,
    company: hit.employer?.name ?? "Unknown",
    location:
      hit.workplace_address?.city ??
      hit.workplace_address?.region ??
      "Sweden",
    description: stripHtml(hit.description?.text ?? ""),
    url: hit.webpage_url,
    salary: hit.salary_description ?? null,
    job_type: hit.employment_type?.label ?? null,
    source: "jobtech" as const,
  }));
}
