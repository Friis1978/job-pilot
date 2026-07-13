import { Navbar } from "@/components/layout/Navbar";
import { StatsBar } from "@/components/dashboard/StatsBar";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { CompanyResearchChart } from "@/components/dashboard/CompanyResearchChart";
import { JobsOverTimeChart } from "@/components/dashboard/JobsOverTimeChart";
import { MatchScoreChart } from "@/components/dashboard/MatchScoreChart";
import { PipelineCard } from "@/components/dashboard/PipelineCard";

const DEMO_STATS = {
  jobsThisMonth: 47,
  jobsLastMonth: 38,
  jobsThisWeek: 8,
  jobsLastWeek: 12,
  avgMatchRate: 74,
  avgMatchRateLastWeek: 71,
  appliedThisWeek: 3,
  appliedLastWeek: 5,
  monthTrend: 23,
  weekTrend: -33,
  matchRateTrend: 5,
  appliedTrend: -40,
};

const DEMO_ACTIVITIES = [
  { type: "job_found" as const, text: "Found 12 jobs for Senior Frontend Engineer", time: "2 hours ago" },
  { type: "researched" as const, text: "Researched Stripe", time: "3 hours ago" },
  { type: "job_found" as const, text: "Found 8 jobs for Full Stack Developer", time: "Yesterday" },
  { type: "researched" as const, text: "Researched Vercel", time: "Yesterday" },
  { type: "researched" as const, text: "Researched Linear", time: "2 days ago" },
  { type: "job_found" as const, text: "Found 6 jobs for React Engineer", time: "3 days ago" },
];

const DEMO_PIPELINE = {
  saved: 5,
  applied: 11,
  interviewing: 2,
  offer: 1,
  rejected: 3,
  rejected_after_interview: 1,
  no_fit: 2,
  no_answer: 4,
};

const DEMO_JOBS_OVER_TIME = [
  { label: "Jun 27", search: 0, imported: 0 },
  { label: "Jun 28", search: 2, imported: 0 },
  { label: "Jun 29", search: 3, imported: 1 },
  { label: "Jun 30", search: 5, imported: 2 },
  { label: "Jul 1",  search: 4, imported: 0 },
  { label: "Jul 2",  search: 0, imported: 0 },
  { label: "Jul 3",  search: 1, imported: 1 },
  { label: "Jul 4",  search: 6, imported: 3 },
  { label: "Jul 5",  search: 8, imported: 1 },
  { label: "Jul 6",  search: 4, imported: 2 },
  { label: "Jul 7",  search: 3, imported: 0 },
  { label: "Jul 8",  search: 2, imported: 1 },
  { label: "Jul 9",  search: 7, imported: 2 },
  { label: "Jul 10", search: 5, imported: 1 },
];

const DEMO_MATCH_SCORES = [
  { label: "0–20",   search: 0,  imported: 0 },
  { label: "20–40",  search: 2,  imported: 0 },
  { label: "40–60",  search: 6,  imported: 3 },
  { label: "60–80",  search: 15, imported: 5 },
  { label: "80–100", search: 9,  imported: 2 },
];

const DEMO_COMPANY_RESEARCH = [
  { label: "Jun 27", search: 0, imported: 0 },
  { label: "Jun 28", search: 1, imported: 0 },
  { label: "Jun 29", search: 2, imported: 0 },
  { label: "Jun 30", search: 3, imported: 1 },
  { label: "Jul 1",  search: 2, imported: 0 },
  { label: "Jul 2",  search: 0, imported: 0 },
  { label: "Jul 3",  search: 0, imported: 1 },
  { label: "Jul 4",  search: 4, imported: 2 },
  { label: "Jul 5",  search: 5, imported: 1 },
  { label: "Jul 6",  search: 3, imported: 0 },
  { label: "Jul 7",  search: 2, imported: 1 },
  { label: "Jul 8",  search: 1, imported: 0 },
  { label: "Jul 9",  search: 4, imported: 2 },
  { label: "Jul 10", search: 3, imported: 1 },
];

export default function DemoDashboardPage() {
  return (
    <>
      <Navbar
        user={{ name: "Alex Jensen", email: "demo@devjobinfo.com", avatarUrl: undefined }}
        isAdmin={false}
      />
      <main className="min-h-screen bg-background">
        <div className="w-full max-w-360 mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
          <StatsBar {...DEMO_STATS} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <RecentActivity activities={DEMO_ACTIVITIES} />
            <PipelineCard data={DEMO_PIPELINE} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <JobsOverTimeChart data={DEMO_JOBS_OVER_TIME} />
            <MatchScoreChart data={DEMO_MATCH_SCORES} />
          </div>
          <CompanyResearchChart data={DEMO_COMPANY_RESEARCH} />
        </div>
      </main>
    </>
  );
}
