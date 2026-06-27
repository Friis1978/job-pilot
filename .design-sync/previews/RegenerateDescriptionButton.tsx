import { RegenerateDescriptionButton } from 'job_pilot';

export function WithSummary() {
  return <RegenerateDescriptionButton jobId="job-123" hasSummary={true} />;
}

export function WithoutSummary() {
  return <RegenerateDescriptionButton jobId="job-456" hasSummary={false} />;
}
