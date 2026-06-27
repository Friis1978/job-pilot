import { TailoredResumeButton } from 'job_pilot';

export function WithResearch() {
  return (
    <TailoredResumeButton
      jobId="job-123"
      companyName="Stripe"
      hasResearch={true}
    />
  );
}

export function WithoutResearch() {
  return (
    <TailoredResumeButton
      jobId="job-456"
      companyName="GitHub"
      hasResearch={false}
    />
  );
}

export function FullWidth() {
  return (
    <TailoredResumeButton
      jobId="job-789"
      companyName="Vercel"
      hasResearch={true}
      fullWidth={true}
    />
  );
}
