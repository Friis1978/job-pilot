import { JobsOverTimeChart } from 'job_pilot';

export function WithData() {
  return (
    <JobsOverTimeChart
      data={[
        { label: 'Jun 20', search: 4, imported: 1 },
        { label: 'Jun 21', search: 7, imported: 2 },
        { label: 'Jun 22', search: 3, imported: 0 },
        { label: 'Jun 23', search: 9, imported: 3 },
        { label: 'Jun 24', search: 6, imported: 1 },
        { label: 'Jun 25', search: 11, imported: 4 },
        { label: 'Jun 26', search: 5, imported: 2 },
      ]}
    />
  );
}

export function Empty() {
  return (
    <JobsOverTimeChart
      data={[
        { label: 'Jun 20', search: 0, imported: 0 },
        { label: 'Jun 21', search: 0, imported: 0 },
        { label: 'Jun 22', search: 0, imported: 0 },
      ]}
    />
  );
}
