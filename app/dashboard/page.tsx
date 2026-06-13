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
import { getDashboardStats } from "@/lib/posthog-query";
import type { JobsOverTimePoint } from "@/lib/posthog-query";
import type { MatchScorePoint } from "@/components/dashboard/MatchScoreChart";
import type { CompanyResearchPoint } from "@/components/dashboard/CompanyResearchChart";

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

  // ── Recent Activity + Charts ───────────────────────────────────────────────

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

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
      .select("company, found_at")
      .eq("user_id", user.id)
      .not("company_research", "is", null)
      .order("found_at", { ascending: false })
      .limit(20),
    getDashboardStats(user.id),
    insforge.database
      .from("jobs")
      .select("source, found_at")
      .eq("user_id", user.id)
      .gte("found_at", thirtyDaysAgo),
    insforge.database
      .from("jobs")
      .select("match_score, source")
      .eq("user_id", user.id)
      .not("match_score", "is", null),
    insforge.database
      .from("jobs")
      .select("company, source, found_at")
      .eq("user_id", user.id)
      .not("company_research", "is", null)
      .order("found_at", { ascending: true }),
    insforge.database
      .from("jobs")
      .select("status")
      .eq("user_id", user.id),
    insforge.database
      .from("profiles")
      .select("avatar_url")
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
  const jobsOverTimeData: JobsOverTimePoint[] = (() => {
    const rows = jobsOverTimeResult.status === "fulfilled" ? (jobsOverTimeResult.value.data ?? []) : [];
    const byDay = new Map<string, { search: number; imported: number }>();
    for (const row of rows as { source: string; found_at: string }[]) {
      const day = row.found_at.slice(0, 10); // "YYYY-MM-DD"
      const entry = byDay.get(day) ?? { search: 0, imported: 0 };
      if (row.source === "url") entry.imported++;
      else entry.search++;
      byDay.set(day, entry);
    }
    const now = Date.now();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now - (29 - i) * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }) + " " + d.getUTCDate();
      return { label, search: byDay.get(key)?.search ?? 0, imported: byDay.get(key)?.imported ?? 0 };
    });
  })();
  const matchScoreData: MatchScorePoint[] = (() => {
    const buckets = [
      { label: "50-60%", min: 50, max: 60 },
      { label: "60-70%", min: 60, max: 70 },
      { label: "70-80%", min: 70, max: 80 },
      { label: "80-90%", min: 80, max: 90 },
      { label: "90-100%", min: 90, max: 101 },
    ];
    const search = Object.fromEntries(buckets.map((b) => [b.label, 0]));
    const imported = Object.fromEntries(buckets.map((b) => [b.label, 0]));
    const rows = matchScoreResult.status === "fulfilled" ? (matchScoreResult.value.data ?? []) : [];
    for (const row of rows as { match_score: number; source: string }[]) {
      const bucket = buckets.find((b) => row.match_score >= b.min && row.match_score < b.max);
      if (!bucket) continue;
      if (row.source === "url") imported[bucket.label]++;
      else search[bucket.label]++;
    }
    return buckets.map((b) => ({ label: b.label, search: search[b.label], imported: imported[b.label] }));
  })();
  const companyResearchData: CompanyResearchPoint[] = (() => {
    const rows = companyResearchResult.status === "fulfilled"
      ? (companyResearchResult.value.data ?? []) as { company: string; source: string; found_at: string }[]
      : [];
    // Deduplicate by company name — keep the first (earliest) entry per company
    const seen = new Set<string>();
    const deduped = rows.filter((r) => {
      const key = r.company.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Group deduplicated entries into 7-day buckets
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const byDay = new Map<string, { search: number; imported: number }>();
    for (const row of deduped) {
      if (new Date(row.found_at).getTime() < sevenDaysAgo) continue;
      const day = row.found_at.slice(0, 10);
      const entry = byDay.get(day) ?? { search: 0, imported: 0 };
      if (row.source === "url") entry.imported++;
      else entry.search++;
      byDay.set(day, entry);
    }
    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = Date.now();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      return { label: DAY_LABELS[d.getUTCDay()], search: byDay.get(key)?.search ?? 0, imported: byDay.get(key)?.imported ?? 0 };
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
      <Navbar user={{ name: user.user_metadata?.full_name ?? user.user_metadata?.name, email: user.email, avatarUrl: (profileResult.status === "fulfilled" ? (profileResult.value.data as { avatar_url?: string | null } | null)?.avatar_url : null) ?? user.user_metadata?.avatar_url }} />
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
