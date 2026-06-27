import { SalaryDisplay } from 'job_pilot';

export function USDRange() {
  return <SalaryDisplay salary="$120k–$160k" />;
}

export function EURSingle() {
  return <SalaryDisplay salary="€90,000" />;
}

export function DKKRange() {
  return <SalaryDisplay salary="700.000–900.000 DKK" />;
}

export function GBP() {
  return <SalaryDisplay salary="£75k–£90k" />;
}

export function NullSalary() {
  return <SalaryDisplay salary={null} />;
}
