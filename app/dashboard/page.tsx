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
import {
  getDashboardStats,
  getJobsOverTime,
  getMatchScoreDistribution,
  getCompanyResearchActivity,
} from "@/lib/posthog-query";

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

function weekTrend(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function DashboardPage() {
  const insforge = await createInsforgeServer();
  const {
    data: { user },
  } = await insforge.auth.getCurrentUser();
  if (!user) redirect("/");

  // ── Recent Activity + Charts ───────────────────────────────────────────────

  const [
    runsResult,
    researchedResult,
    dashboardStatsResult,
    jobsOverTimeResult,
    matchScoreResult,
    companyResearchResult,
  ] = await Promise.allSettled([
    insforge.database
      .from("agent_runs")
      .select("job_title_searched, jobs_found, started_at")
      .eq("user_id", user.id)
      .eq("status", "complete")
      .order("started_at", { ascending: false })
      .limit(20),
    insforge.database
      .from("jobs")
      .select("company, found_at")
      .eq("user_id", user.id)
      .not("company_research", "is", null)
      .order("found_at", { ascending: false })
      .limit(20),
    getDashboardStats(user.id),
    getJobsOverTime(user.id),
    getMatchScoreDistribution(user.id),
    getCompanyResearchActivity(user.id),
  ]);
  const rawRuns =
    runsResult.status === "fulfilled" ? runsResult.value.data : null;
  const rawResearched =
    researchedResult.status === "fulfilled" ? researchedResult.value.data : null;
  const phStats =
    dashboardStatsResult.status === "fulfilled"
      ? dashboardStatsResult.value
      : null;
  const jobsOverTimeData =
    jobsOverTimeResult.status === "fulfilled" ? jobsOverTimeResult.value : [];
  const matchScoreData =
    matchScoreResult.status === "fulfilled" ? matchScoreResult.value : [];
  const companyResearchData =
    companyResearchResult.status === "fulfilled"
      ? companyResearchResult.value
      : [];

  const statsData = {
    totalJobs: phStats?.totalJobs ?? 0,
    avgMatchRate: phStats?.avgMatchRate ?? 0,
    companiesResearched: phStats?.companiesResearched ?? 0,
    jobsThisWeek: phStats?.jobsThisWeek ?? 0,
    totalJobsTrend: phStats
      ? weekTrend(phStats.jobsThisWeek, phStats.jobsLastWeek)
      : null,
    matchRateTrend: phStats
      ? weekTrend(phStats.avgMatchRateThisWeek, phStats.avgMatchRateLastWeek)
      : null,
  };

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
    .slice(0, 20)
    .map(({ type, text, time }) => ({ type, text, time }));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Navbar user={{ name: user.user_metadata?.full_name ?? user.user_metadata?.name, email: user.email, avatarUrl: user.user_metadata?.avatar_url }} />
      <main className="min-h-screen bg-background">
        <div className="w-full max-w-360 mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
          <StatsBar {...statsData} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <RecentActivity activities={activities} />
            <CompanyResearchChart data={companyResearchData} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <JobsOverTimeChart data={jobsOverTimeData} />
            <MatchScoreChart data={matchScoreData} />
          </div>
        </div>
      </main>
    </>
  );
}
