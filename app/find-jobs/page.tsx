import { createInsforgeServer } from "@/lib/insforge-server";
import { Navbar } from "@/components/layout/Navbar";
import { SearchCard } from "@/components/find-jobs/SearchCard";
import { JobsTable } from "@/components/find-jobs/JobsTable";
import type { JobRow } from "@/types";

export default async function FindJobsPage() {
  const insforge = await createInsforgeServer();
  const {
    data: { user },
  } = await insforge.auth.getCurrentUser();

  const [jobsResult, searchesResult] = await Promise.allSettled([
    insforge.database
      .from("jobs")
      .select("id, company, title, location, match_score, salary, found_at, matched_skills, status, source")
      .eq("user_id", user.id)
      .order("found_at", { ascending: false }),
    insforge.database
      .from("job_searches")
      .select("job_title, location, searched_at")
      .eq("user_id", user.id)
      .order("searched_at", { ascending: false })
      .limit(50),
  ]);

  const jobs =
    jobsResult.status === "fulfilled"
      ? ((jobsResult.value.data as JobRow[] | null) ?? [])
      : [];

  // Deduplicate by job_title+location, keep most recent of each
  type SearchRow = { job_title: string; location: string; searched_at: string };
  const rawSearches =
    searchesResult.status === "fulfilled"
      ? ((searchesResult.value.data as SearchRow[] | null) ?? [])
      : [];
  const seen = new Set<string>();
  const recentSearches = rawSearches
    .filter((s) => {
      const key = `${s.job_title.toLowerCase()}|${s.location.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map((s) => ({ jobTitle: s.job_title, location: s.location, searchedAt: s.searched_at }));

  return (
    <>
      <Navbar user={{ name: user.user_metadata?.full_name ?? user.user_metadata?.name, email: user.email, avatarUrl: user.user_metadata?.avatar_url }} />
      <main className="min-h-screen bg-background py-8">
        <div className="w-full max-w-360 mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6 pb-12">
          <SearchCard recentSearches={recentSearches} />
          <JobsTable jobs={jobs} />
        </div>
      </main>
    </>
  );
}
