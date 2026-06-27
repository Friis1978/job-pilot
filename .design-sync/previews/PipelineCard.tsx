import { PipelineCard } from 'job_pilot';

export function WithData() {
  return (
    <PipelineCard
      data={{
        saved: 18,
        applied: 9,
        interviewing: 4,
        offer: 2,
        rejected: 3,
        no_fit: 5,
      }}
    />
  );
}

export function EarlyStage() {
  return (
    <PipelineCard
      data={{
        saved: 32,
        applied: 6,
        interviewing: 0,
        offer: 0,
        rejected: 1,
        no_fit: 2,
      }}
    />
  );
}

export function Empty() {
  return (
    <PipelineCard
      data={{
        saved: 0,
        applied: 0,
        interviewing: 0,
        offer: 0,
        rejected: 0,
        no_fit: 0,
      }}
    />
  );
}
