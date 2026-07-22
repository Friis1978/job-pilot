import { redirect } from "next/navigation";
import { createInsforgeServer } from "@/lib/insforge-server";
import { formatDateAgo, NO_ANSWER_DAYS } from "@/lib/utils";
import { Navbar } from "@/components/layout/Navbar";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import type { ActivityItem } from "@/components/dashboard/RecentActivity";
import { CompanyResearchChart } from "@/components/dashboard/CompanyResearchChart";
import { JobsOverTimeChart } from "@/components/dashboard/JobsOverTimeChart";
import { MatchScoreChart } from "@/components/dashboard/MatchScoreChart";
import { PipelineCard } from "@/components/dashboard/PipelineCard";
import { getDashboardStats, getJobsOverTime, getMatchScoreDistribution, getTokenUsageByFeature } from "@/lib/posthog-query";
import { TokenUsageChart } from "@/components/dashboard/TokenUsageChart";
import type { CompanyResearchPoint } from "@/components/dashboard/CompanyResearchChart";

/** Row shape for the pipeline query — status plus the application timestamp. */
type PipelineRow = { status: string; updated_at: string; applied_at: string | null };

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
    tokenUsageResult,
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
    getTokenUsageByFeature(user.id),
    insforge.database
      .from("jobs")
      .select("researched_at, source")
      .eq("user_id", user.id)
      .not("researched_at", "is", null)
      .gte("researched_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
    insforge.database
      .from("jobs")
      .select("status, updated_at, applied_at")
      .eq("user_id", user.id),
    insforge.database
      .from("profiles")
      .select("avatar_url, is_admin, onboarding_seen, credit_balance_usd")
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
  const tokenUsageData = tokenUsageResult.status === "fulfilled"
    ? tokenUsageResult.value
    : { points: [], features: [], totalTokens: 0, isCost: false };
  const companyResearchData = (() => {
    type ResearchRow = { researched_at: string; source: string };
    const rows: ResearchRow[] =
      companyResearchResult.status === "fulfilled"
        ? ((companyResearchResult.value.data as ResearchRow[] | null) ?? [])
        : [];

    const byDay = new Map<string, { search: number; imported: number }>();
    for (const row of rows) {
      const d = new Date(row.researched_at);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const entry = byDay.get(key) ?? { search: 0, imported: 0 };
      if (row.source === "url") entry.imported++;
      else entry.search++;
      byDay.set(key, entry);
    }

    return Array.from({ length: 14 }, (_, i): CompanyResearchPoint => {
      const d = new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      const label = `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCDate()}`;
      return {
        label,
        ...(byDay.get(key) ?? { search: 0, imported: 0 }),
      };
    });
  })();

  const pipelineData = (() => {
    const counts = { saved: 0, applied: 0, interviewing: 0, offer: 0, rejected: 0, rejected_after_interview: 0, no_fit: 0, no_answer: 0 };
    if (pipelineResult.status === "fulfilled" && pipelineResult.value.data) {
      const cutoff = Date.now() - NO_ANSWER_DAYS * 24 * 60 * 60 * 1000;
      for (const row of pipelineResult.value.data as PipelineRow[]) {
        const s = row.status as keyof typeof counts;
        if (s in counts) counts[s]++;
        // "No answer" means the application is old, not that the row is stale —
        // measure from applied_at so an unrelated edit does not reset the clock.
        if (row.status === "applied" && row.applied_at && new Date(row.applied_at).getTime() < cutoff) {
          counts.no_answer++;
        }
      }
    }
    return counts;
  })();

  const { appliedThisWeek, appliedLastWeek } = (() => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon...
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const startOfThisWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday)).getTime();
    const startOfLastWeek = startOfThisWeek - 7 * 24 * 60 * 60 * 1000;
    let thisWeek = 0;
    let lastWeek = 0;
    if (pipelineResult.status === "fulfilled" && pipelineResult.value.data) {
      // Count by applied_at, not status + updated_at. updated_at moves on any
      // edit, which pulled untouched applications back into the current week,
      // and filtering on status === "applied" dropped jobs that had since been
      // rejected — those were still applied for.
      for (const row of pipelineResult.value.data as PipelineRow[]) {
        if (!row.applied_at) continue;
        const t = new Date(row.applied_at).getTime();
        if (t >= startOfThisWeek) thisWeek++;
        else if (t >= startOfLastWeek) lastWeek++;
      }
    }
    return { appliedThisWeek: thisWeek, appliedLastWeek: lastWeek };
  })();

  const statsData = {
    jobsThisMonth: phStats?.jobsThisMonth ?? 0,
    jobsLastMonth: phStats?.jobsLastMonth ?? 0,
    jobsThisWeek: phStats?.jobsThisWeek ?? 0,
    jobsLastWeek: phStats?.jobsLastWeek ?? 0,
    avgMatchRate: phStats?.avgMatchRate ?? 0,
    avgMatchRateLastWeek: phStats?.avgMatchRateLastWeek ?? 0,
    appliedThisWeek,
    appliedLastWeek,
    monthTrend: phStats ? weekTrend(phStats.jobsThisMonth, phStats.jobsLastMonth) : null,
    weekTrend: phStats ? weekTrend(phStats.jobsThisWeek, phStats.jobsLastWeek) : null,
    matchRateTrend: phStats ? weekTrend(phStats.avgMatchRateThisWeek, phStats.avgMatchRateLastWeek) : null,
    appliedTrend: weekTrend(appliedThisWeek, appliedLastWeek),
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
    ? (profileResult.value.data as { avatar_url?: string | null; is_admin?: boolean; onboarding_seen?: boolean; credit_balance_usd?: number | null } | null)
    : null;

  if (profileData !== null && !profileData.onboarding_seen) {
    redirect("/profile");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Navbar user={{ name: userMeta?.full_name ?? userMeta?.name, email: user.email, avatarUrl: profileData?.avatar_url ?? userMeta?.avatar_url }} isAdmin={profileData?.is_admin ?? false} creditBalance={profileData?.credit_balance_usd !== undefined ? Number(profileData.credit_balance_usd) : undefined} />
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
          <TokenUsageChart
            data={tokenUsageData.points}
            features={tokenUsageData.features}
            totalTokens={tokenUsageData.totalTokens}
            isCost={tokenUsageData.isCost}
            creditBalance={profileData?.credit_balance_usd !== undefined ? Number(profileData.credit_balance_usd) : undefined}
          />
        </div>
      </main>
    </>
  );
}
