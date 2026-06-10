import type { NormalizedJob } from "@/types";
import { stripHtml } from "@/lib/utils";

type JoobleJob = {
  title: string;
  company: string;
  location: string;
  salary: string;
  link: string;
  updated: string;
  snippet: string;
  type?: string;
};

type JoobleResponse = {
  jobs: JoobleJob[];
};

export async function searchJobsJooble(
  jobTitle: string,
  location: string,
): Promise<NormalizedJob[]> {
  const response = await fetch(
    `https://jooble.org/api/${process.env.JOOBLE_API_KEY!}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: jobTitle,
        location,
        ResultOnPage: 10,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Jooble API error: ${response.status}`);
  }

  const data: JoobleResponse = await response.json();

  return (data.jobs ?? []).map((job, i) => ({
    id: `jooble-${i}-${Date.now()}`,
    title: job.title,
    company: job.company ?? "Unknown",
    location: job.location || location,
    description: stripHtml(job.snippet ?? ""),
    url: job.link,
    salary: job.salary || null,
    job_type: job.type ?? null,
    source: "jooble" as const,
  }));
}
