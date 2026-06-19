import { CURRENCY_TO_DKK } from "@/lib/utils";

export function SalaryDisplay({ salary }: { salary: string | null }) {
  if (!salary) return <>—</>;

  let currency = "DKK";
  if (salary.includes("€")) currency = "EUR";
  else if (salary.includes("$")) currency = "USD";
  else if (salary.includes("£")) currency = "GBP";
  else if (/\bSEK\b/i.test(salary)) currency = "SEK";
  else if (/\bNOK\b/i.test(salary)) currency = "NOK";

  const parseVal = (s: string, k: boolean, m: boolean) => {
    const n = parseFloat(s.replace(/[,\s]/g, ""));
    if (isNaN(n) || n === 0) return 0;
    return m ? n * 1_000_000 : k ? n * 1_000 : n;
  };

  const matches = [...salary.matchAll(/([0-9][0-9,\.]*)\s*([kKmM]?)/g)]
    .map(m => parseVal(m[1], /[kK]/.test(m[2]), /[mM]/.test(m[2])))
    .filter(n => n > 0)
    .slice(0, 2);

  if (!matches.length || matches[0] < 1_000) return <>{salary}</>;

  const rate = CURRENCY_TO_DKK[currency] ?? 1;
  const dkk = matches.map(v => v * rate);

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1_000)}K`;

  const monthly = dkk.map(v => v / 12);
  const moStr = monthly.length === 2
    ? `DKK ${fmt(monthly[0])}–${fmt(monthly[1])}/mo`
    : `DKK ${fmt(monthly[0])}/mo`;

  return (
    <span className="flex flex-col items-end gap-0.5">
      <span>{salary}</span>
      <span className="text-text-muted font-normal">{moStr}</span>
    </span>
  );
}
