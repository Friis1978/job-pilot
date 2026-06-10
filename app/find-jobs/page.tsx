import { redirect } from "next/navigation";
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

  if (!user) redirect("/login");

  const { data } = await insforge.database
    .from("jobs")
    .select("id, company, title, match_score, salary, found_at")
    .eq("user_id", user.id)
    .order("found_at", { ascending: false });

  const jobs = (data as JobRow[] | null) ?? [];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background py-8">
        <div className="w-full max-w-360 mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6 pb-12">
          <SearchCard />
          <JobsTable jobs={jobs} />
        </div>
      </main>
    </>
  );
}
