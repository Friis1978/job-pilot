import { ApplicationPipeline } from 'job_pilot';

export function Saved() {
  return <ApplicationPipeline jobId="job-123" status="saved" />;
}

export function Applied() {
  return <ApplicationPipeline jobId="job-124" status="applied" />;
}

export function Interviewing() {
  return <ApplicationPipeline jobId="job-125" status="interviewing" />;
}

export function Offer() {
  return <ApplicationPipeline jobId="job-126" status="offer" />;
}

export function Rejected() {
  return <ApplicationPipeline jobId="job-127" status="rejected" />;
}
