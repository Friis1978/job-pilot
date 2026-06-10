import type { NormalizedJob } from "@/types";
import { stripHtml } from "@/lib/utils";

type LinkedInJob = {
  id: string;
  title: string;
  organization: string;
  locations_derived: string[];
  countries_derived: string[];
  description_text: string;
  external_apply_url: string;
  url: string;
  salary_raw: string | null;
  employment_type: string[];
};

type LinkedInResponse = LinkedInJob[];

export async function searchJobsLinkedIn(
  jobTitle: string,
  locationFilter: string,
): Promise<NormalizedJob[]> {
  const params = new URLSearchParams({
    offset: "0",
    title_filter: jobTitle,
    location_filter: locationFilter,
    description_type: "text",
  });

  const response = await fetch(
    `https://linkedin-job-search-api.p.rapidapi.com/active-jb-7d?${params}`,
    {
      headers: {
        "x-rapidapi-key": process.env.RAPIDAPI_KEY!,
        "x-rapidapi-host": "linkedin-job-search-api.p.rapidapi.com",
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`LinkedIn Jobs API error: ${response.status}`);
  }

  const data: LinkedInResponse = await response.json();

  return (data ?? []).map((job, i) => ({
    id: job.id ?? `linkedin-${i}-${Date.now()}`,
    title: job.title,
    company: job.organization ?? "Unknown",
    location: job.locations_derived?.[0] ?? locationFilter,
    description: stripHtml(job.description_text ?? ""),
    url: job.external_apply_url || job.url,
    salary: job.salary_raw ?? null,
    job_type: job.employment_type?.[0]?.toLowerCase().replace("_", "-") ?? null,
    source: "linkedin" as const,
  }));
}
