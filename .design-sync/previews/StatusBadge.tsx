import { StatusBadge } from 'job_pilot';

export function Saved() {
  return <StatusBadge jobId="job-1" status="saved" />;
}

export function Applied() {
  return <StatusBadge jobId="job-2" status="applied" />;
}

export function Interviewing() {
  return <StatusBadge jobId="job-3" status="interviewing" />;
}

export function Offer() {
  return <StatusBadge jobId="job-4" status="offer" />;
}

export function Rejected() {
  return <StatusBadge jobId="job-5" status="rejected" />;
}

export function NoFit() {
  return <StatusBadge jobId="job-6" status="no_fit" />;
}
