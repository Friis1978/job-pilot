import { CompanyResearchChart } from 'job_pilot';

export function WithData() {
  return (
    <CompanyResearchChart
      data={[
        { label: 'Jun 20', search: 2, imported: 1 },
        { label: 'Jun 21', search: 4, imported: 0 },
        { label: 'Jun 22', search: 1, imported: 2 },
        { label: 'Jun 23', search: 5, imported: 1 },
        { label: 'Jun 24', search: 3, imported: 0 },
        { label: 'Jun 25', search: 6, imported: 3 },
        { label: 'Jun 26', search: 2, imported: 1 },
      ]}
    />
  );
}

export function Empty() {
  return (
    <CompanyResearchChart
      data={[
        { label: 'Jun 20', search: 0, imported: 0 },
        { label: 'Jun 21', search: 0, imported: 0 },
        { label: 'Jun 22', search: 0, imported: 0 },
      ]}
    />
  );
}
