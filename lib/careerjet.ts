import type { NormalizedJob } from "@/types";
import { stripHtml } from "@/lib/utils";

type CareerjetJob = {
  url: string;
  title: string;
  locations: string;
  company: string;
  salary: string;
  date: string;
  description: string;
  site: string;
};

type CareerjetResponse = {
  type: "JOBS" | "LOCATIONS" | "ERROR";
  hits?: number;
  jobs?: CareerjetJob[];
  error?: string;
};

export async function searchJobsCareerjet(
  jobTitle: string,
  location: string,
  locale: string = "da_DK",
): Promise<NormalizedJob[]> {
  const params = new URLSearchParams({
    affid: process.env.CAREERJET_API_KEY!,
    keywords: jobTitle,
    location,
    locale_code: locale,
    pagesize: "10",
    user_ip: "1.0.0.1",
    user_agent: "JobPilot/1.0",
  });

  const response = await fetch(
    `http://public.api.careerjet.net/search?${params}`,
    { headers: { Referer: "https://jobpilot.app/" } },
  );

  if (!response.ok) {
    throw new Error(`Careerjet API error: ${response.status}`);
  }

  const data: CareerjetResponse = await response.json();

  if (data.type === "ERROR" || !data.jobs) {
    throw new Error(`Careerjet error: ${data.error ?? "no results"}`);
  }

  return data.jobs.map((job, i) => ({
    id: `careerjet-${i}-${Date.now()}`,
    title: job.title,
    company: job.company || "Unknown",
    location: job.locations || location,
    description: stripHtml(job.description ?? ""),
    url: job.url,
    salary: job.salary || null,
    job_type: null,
    source: "careerjet" as const,
  }));
}
