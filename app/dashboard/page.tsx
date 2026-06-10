import { redirect } from "next/navigation";
import { createInsforgeServer } from "@/lib/insforge-server";
import { formatDateAgo } from "@/lib/utils";
import { Navbar } from "@/components/layout/Navbar";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import type { ActivityItem } from "@/components/dashboard/RecentActivity";
import { CompanyResearchChart } from "@/components/dashboard/CompanyResearchChart";
import { JobsOverTimeChart } from "@/components/dashboard/JobsOverTimeChart";
import { MatchScoreChart } from "@/components/dashboard/MatchScoreChart";

type JobStatsRow = {
  match_score: number;
  company_research: unknown;
  found_at: string;
};

type AgentRunRow = {
  job_title_searched: string | null;
  jobs_found: number | null;
  started_at: string | null;
};

type Timestamped = ActivityItem & { ts: number };

type ResearchedJobRow = {
  company: string;
  found_at: string;
};

function rowAvg(rows: JobStatsRow[]): number {
  if (rows.length === 0) return 0;
  return Math.round(
    rows.reduce((sum, j) => sum + j.match_score, 0) / rows.length,
  );
}

function weekTrend(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function DashboardPage() {
  const insforge = await createInsforgeServer();
  const {
    data: { user },
  } = await insforge.auth.getCurrentUser();
  if (!user) redirect("/auth/login");

  // ── Stats ──────────────────────────────────────────────────────────────────

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const { data: rawJobs } = await insforge.database
    .from("jobs")
    .select("match_score, company_research, found_at")
    .eq("user_id", user.id);

  const jobs = (rawJobs ?? []) as JobStatsRow[];
  const thisWeek = jobs.filter((j) => new Date(j.found_at) >= sevenDaysAgo);
  const lastWeek = jobs.filter(
    (j) =>
      new Date(j.found_at) >= fourteenDaysAgo &&
      new Date(j.found_at) < sevenDaysAgo,
  );

  const statsData = {
    totalJobs: jobs.length,
    avgMatchRate: rowAvg(jobs),
    companiesResearched: jobs.filter((j) => j.company_research !== null).length,
    jobsThisWeek: thisWeek.length,
    totalJobsTrend: weekTrend(thisWeek.length, lastWeek.length),
    matchRateTrend: weekTrend(rowAvg(thisWeek), rowAvg(lastWeek)),
  };

  // ── Recent Activity ────────────────────────────────────────────────────────

  const [runsResult, researchedResult] = await Promise.allSettled([
    insforge.database
      .from("agent_runs")
      .select("job_title_searched, jobs_found, started_at")
      .eq("user_id", user.id)
      .eq("status", "complete")
      .order("started_at", { ascending: false })
      .limit(10),
    insforge.database
      .from("jobs")
      .select("company, found_at")
      .eq("user_id", user.id)
      .not("company_research", "is", null)
      .order("found_at", { ascending: false })
      .limit(10),
  ]);
  const rawRuns =
    runsResult.status === "fulfilled" ? runsResult.value.data : null;
  const rawResearched =
    researchedResult.status === "fulfilled" ? researchedResult.value.data : null;

  const runActivities: Timestamped[] = ((rawRuns ?? []) as AgentRunRow[])
    .filter((run) => (run.jobs_found ?? 0) > 0)
    .map((run) => ({
      type: "job_found" as const,
      text: `Found ${run.jobs_found} job${run.jobs_found === 1 ? "" : "s"} for ${run.job_title_searched ?? "unknown role"}`,
      time: formatDateAgo(run.started_at ?? new Date().toISOString()),
      ts: new Date(run.started_at ?? new Date().toISOString()).getTime(),
    }));

  const researchActivities: Timestamped[] = (
    (rawResearched ?? []) as ResearchedJobRow[]
  ).map((job) => ({
    type: "researched" as const,
    text: `Researched ${job.company}`,
    time: formatDateAgo(job.found_at),
    ts: new Date(job.found_at).getTime(),
  }));

  const activities: ActivityItem[] = [...runActivities, ...researchActivities]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8)
    .map(({ type, text, time }) => ({ type, text, time }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        <div className="w-full max-w-360 mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
          <StatsBar {...statsData} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <RecentActivity activities={activities} />
            <CompanyResearchChart />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <JobsOverTimeChart />
            <MatchScoreChart />
          </div>
        </div>
      </main>
    </>
  );
}
