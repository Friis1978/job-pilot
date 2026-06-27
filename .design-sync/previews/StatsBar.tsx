import { StatsBar } from 'job_pilot';

export function WithTrends() {
  return (
    <StatsBar
      totalJobs={47}
      avgMatchRate={78}
      companiesResearched={12}
      jobsThisWeek={9}
      totalJobsTrend={23}
      matchRateTrend={5}
    />
  );
}

export function NoPriorData() {
  return (
    <StatsBar
      totalJobs={5}
      avgMatchRate={82}
      companiesResearched={2}
      jobsThisWeek={5}
      totalJobsTrend={null}
      matchRateTrend={null}
    />
  );
}

export function Empty() {
  return (
    <StatsBar
      totalJobs={0}
      avgMatchRate={0}
      companiesResearched={0}
      jobsThisWeek={0}
      totalJobsTrend={null}
      matchRateTrend={null}
    />
  );
}
