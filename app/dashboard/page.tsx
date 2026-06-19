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
import { PipelineCard } from "@/components/dashboard/PipelineCard";
import { getDashboardStats, getJobsOverTime, getMatchScoreDistribution } from "@/lib/posthog-query";
import type { CompanyResearchPoint } from "@/components/dashboard/CompanyResearchChart";

type AgentRunRow = {
  job_title_searched: string | null;
  jobs_found: number | null;
  started_at: string | null;
};

type Timestamped = ActivityItem & { ts: number };

type ResearchedJobRow = {
  company: string;
  researched_at: string;
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
  const userMeta = user.metadata as { full_name?: string; name?: string; avatar_url?: string } | null;

  // ── Recent Activity + Charts ───────────────────────────────────────────────

  const [
    runsResult,
    researchedResult,
    dashboardStatsResult,
    jobsOverTimeResult,
    matchScoreResult,
    companyResearchResult,
    pipelineResult,
    profileResult,
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
      .select("company, researched_at")
      .eq("user_id", user.id)
      .not("researched_at", "is", null)
      .order("researched_at", { ascending: false })
      .limit(20),
    getDashboardStats(user.id),
    getJobsOverTime(user.id),
    getMatchScoreDistribution(user.id),
    insforge.database
      .from("jobs")
      .select("researched_at, source")
      .eq("user_id", user.id)
      .not("researched_at", "is", null)
      .gte("researched_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    insforge.database
      .from("jobs")
      .select("status")
      .eq("user_id", user.id),
    insforge.database
      .from("profiles")
      .select("avatar_url, is_admin, onboarding_seen")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  const rawRuns =
    runsResult.status === "fulfilled" ? runsResult.value.data : null;
  const rawResearched =
    researchedResult.status === "fulfilled" ? researchedResult.value.data : null;
  const phStats =
    dashboardStatsResult.status === "fulfilled"
      ? dashboardStatsResult.value
      : null;
  const jobsOverTimeData = jobsOverTimeResult.status === "fulfilled" ? jobsOverTimeResult.value : [];
  const matchScoreData = matchScoreResult.status === "fulfilled" ? matchScoreResult.value : [];
  const companyResearchData = (() => {
    type ResearchRow = { researched_at: string; source: string };
    const rows: ResearchRow[] =
      companyResearchResult.status === "fulfilled"
        ? ((companyResearchResult.value.data as ResearchRow[] | null) ?? [])
        : [];

    const DAY_LABELS_LOCAL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
    const byDay = new Map<string, { search: number; imported: number }>();
    for (const row of rows) {
      const d = new Date(row.researched_at);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const entry = byDay.get(key) ?? { search: 0, imported: 0 };
      if (row.source === "url") entry.imported++;
      else entry.search++;
      byDay.set(key, entry);
    }

    return Array.from({ length: 7 }, (_, i): CompanyResearchPoint => {
      const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return {
        label: DAY_LABELS_LOCAL[d.getUTCDay()],
        ...(byDay.get(key) ?? { search: 0, imported: 0 }),
      };
    });
  })();

  const pipelineData = (() => {
    const counts = { saved: 0, applied: 0, interviewing: 0, offer: 0, rejected: 0 };
    if (pipelineResult.status === "fulfilled" && pipelineResult.value.data) {
      for (const row of pipelineResult.value.data as { status: string }[]) {
        const s = row.status as keyof typeof counts;
        if (s in counts) counts[s]++;
      }
    }
    return counts;
  })();

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
    time: formatDateAgo(job.researched_at),
    ts: new Date(job.researched_at).getTime(),
  }));

  const activities: ActivityItem[] = [...runActivities, ...researchActivities]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 20)
    .map(({ type, text, time }) => ({ type, text, time }));

  // Redirect new users to profile page so they complete their profile first
  const profileData = profileResult.status === "fulfilled"
    ? (profileResult.value.data as { avatar_url?: string | null; is_admin?: boolean; onboarding_seen?: boolean } | null)
    : null;

  if (profileData !== null && !profileData.onboarding_seen) {
    redirect("/profile");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Navbar user={{ name: userMeta?.full_name ?? userMeta?.name, email: user.email, avatarUrl: profileData?.avatar_url ?? userMeta?.avatar_url }} isAdmin={profileData?.is_admin ?? false} />
      <main className="min-h-screen bg-background">
        <div className="w-full max-w-360 mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
          <StatsBar {...statsData} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <RecentActivity activities={activities} />
            <PipelineCard data={pipelineData} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <JobsOverTimeChart data={jobsOverTimeData} />
            <MatchScoreChart data={matchScoreData} />
          </div>
          <CompanyResearchChart data={companyResearchData} />
        </div>
      </main>
    </>
  );
}
