import type { NormalizedJob } from "@/types";
import { stripHtml } from "@/lib/utils";

type GlassdoorHeader = {
  employer: { name: string } | null;
  locationName: string | null;
  jobViewUrl: string | null;
  normalizedJobTitle: string | null;
  payPeriodAdjustedPay: { p50: number | null } | null;
  indeedJobAttribute: {
    extractedJobAttributes: { key: string; value: string }[];
  } | null;
};

type GlassdoorJob = {
  jobTitleText: string;
  listingId: number;
  description?: string;
};

type GlassdoorListing = {
  jobview: {
    header: GlassdoorHeader;
    job: GlassdoorJob;
  };
};

type GlassdoorResponse = {
  data: {
    jobListings: GlassdoorListing[];
  };
};

export async function searchJobsGlassdoor(
  jobTitle: string,
  location: string,
): Promise<NormalizedJob[]> {
  const params = new URLSearchParams({
    query: jobTitle,
    location,
    page: "1",
  });

  const response = await fetch(
    `https://glassdoor-real-time.p.rapidapi.com/jobs/search?${params}`,
    {
      headers: {
        "x-rapidapi-key": process.env.RAPIDAPI_KEY!,
        "x-rapidapi-host": "glassdoor-real-time.p.rapidapi.com",
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Glassdoor API error: ${response.status}`);
  }

  const data: GlassdoorResponse = await response.json();
  const listings = data?.data?.jobListings ?? [];

  return listings.map((item, i) => {
    const header = item.jobview.header;
    const job = item.jobview.job;

    const salary = header.payPeriodAdjustedPay?.p50
      ? `~$${Math.round(header.payPeriodAdjustedPay.p50 / 1000)}k`
      : null;

    const description = job.description
      ? stripHtml(job.description)
      : (header.indeedJobAttribute?.extractedJobAttributes
          ?.map((a) => a.value)
          .join("\n") ?? "");

    return {
      id: `glassdoor-${job.listingId ?? i}-${Date.now()}`,
      title: job.jobTitleText ?? header.normalizedJobTitle ?? "Unknown",
      company: header.employer?.name ?? "Unknown",
      location: header.locationName ?? location,
      description,
      url: header.jobViewUrl ?? "",
      salary,
      job_type: null,
      source: "glassdoor" as const,
    };
  });
}
