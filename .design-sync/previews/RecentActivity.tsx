import { RecentActivity } from 'job_pilot';

export function WithActivities() {
  return (
    <RecentActivity
      activities={[
        { type: 'job_found', text: 'Found Senior Frontend Engineer at Stripe', time: '2 hours ago' },
        { type: 'researched', text: 'Researched Vercel', time: '4 hours ago' },
        { type: 'job_found', text: 'Found Product Designer at Linear', time: '5 hours ago' },
        { type: 'job_found', text: 'Found TypeScript Engineer at GitHub', time: 'Yesterday' },
        { type: 'researched', text: 'Researched Figma', time: 'Yesterday' },
      ]}
    />
  );
}

export function Empty() {
  return <RecentActivity activities={[]} />;
}

export function Single() {
  return (
    <RecentActivity
      activities={[
        { type: 'job_found', text: 'Found Senior React Developer at Spotify', time: 'Just now' },
      ]}
    />
  );
}
