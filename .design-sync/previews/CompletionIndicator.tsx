import { CompletionIndicator } from 'job_pilot';

export function Incomplete() {
  return (
    <CompletionIndicator
      percentage={60}
      missingFields={['Experience', 'Skills', 'Education']}
    />
  );
}

export function AlmostComplete() {
  return (
    <CompletionIndicator
      percentage={85}
      missingFields={['Portfolio URL']}
    />
  );
}

export function Complete() {
  return (
    <CompletionIndicator percentage={100} missingFields={[]} />
  );
}
