import { MatchScoreChart } from 'job_pilot';

const SCORE_RANGES = ['50–59', '60–69', '70–79', '80–89', '90–100'];

export function WithData() {
  return (
    <MatchScoreChart
      data={[
        { label: '50–59', search: 2, imported: 1 },
        { label: '60–69', search: 5, imported: 3 },
        { label: '70–79', search: 8, imported: 4 },
        { label: '80–89', search: 12, imported: 6 },
        { label: '90–100', search: 4, imported: 2 },
      ]}
    />
  );
}

export function SearchOnly() {
  return (
    <MatchScoreChart
      data={[
        { label: '50–59', search: 3, imported: 0 },
        { label: '60–69', search: 7, imported: 0 },
        { label: '70–79', search: 11, imported: 0 },
        { label: '80–89', search: 9, imported: 0 },
        { label: '90–100', search: 3, imported: 0 },
      ]}
    />
  );
}

export function Empty() {
  return (
    <MatchScoreChart
      data={SCORE_RANGES.map(label => ({ label, search: 0, imported: 0 }))}
    />
  );
}
