import { ResearchButton } from 'job_pilot';

export function NotResearched() {
  return <ResearchButton jobId="job-123" hasResearch={false} />;
}

export function AlreadyResearched() {
  return <ResearchButton jobId="job-456" hasResearch={true} />;
}
