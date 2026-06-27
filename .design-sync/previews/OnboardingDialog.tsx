import { OnboardingDialog } from 'job_pilot';

export function Step1() {
  return (
    <div style={{ position: 'relative', height: '500px', overflow: 'hidden' }}>
      <OnboardingDialog show={true} />
    </div>
  );
}

export function Hidden() {
  return (
    <div style={{ padding: '24px' }}>
      <p className="text-sm text-text-muted">Onboarding dialog — hidden (show=false)</p>
      <OnboardingDialog show={false} />
    </div>
  );
}
