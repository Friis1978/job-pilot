import { JobsTable } from 'job_pilot';

const SAMPLE_JOBS = [
  {
    id: 'job-1',
    company: 'Stripe',
    title: 'Senior Frontend Engineer',
    location: 'Remote',
    match_score: 92,
    found_at: '2024-06-25T10:00:00Z',
    researched_at: '2024-06-25T11:00:00Z',
    matched_skills: ['React', 'TypeScript', 'Next.js'],
    status: 'saved',
    source: 'search',
  },
  {
    id: 'job-2',
    company: 'Vercel',
    title: 'Staff Software Engineer',
    location: 'San Francisco, CA',
    match_score: 88,
    found_at: '2024-06-25T08:00:00Z',
    researched_at: null,
    matched_skills: ['Node.js', 'TypeScript', 'React'],
    status: 'applied',
    source: 'search',
  },
  {
    id: 'job-3',
    company: 'Linear',
    title: 'Frontend Engineer',
    location: 'Remote',
    match_score: 85,
    found_at: '2024-06-24T15:00:00Z',
    researched_at: '2024-06-24T16:00:00Z',
    matched_skills: ['React', 'TypeScript'],
    status: 'interviewing',
    source: 'url',
  },
  {
    id: 'job-4',
    company: 'GitHub',
    title: 'TypeScript Engineer',
    location: 'Remote',
    match_score: 79,
    found_at: '2024-06-24T09:00:00Z',
    researched_at: null,
    matched_skills: ['TypeScript', 'Node.js'],
    status: 'saved',
    source: 'search',
  },
  {
    id: 'job-5',
    company: 'Figma',
    title: 'Senior React Developer',
    location: 'New York, NY',
    match_score: 74,
    found_at: '2024-06-23T12:00:00Z',
    researched_at: null,
    matched_skills: ['React', 'CSS'],
    status: 'rejected',
    source: 'search',
  },
];

export function WithJobs() {
  return <JobsTable jobs={SAMPLE_JOBS} />;
}

export function Empty() {
  return <JobsTable jobs={[]} />;
}
