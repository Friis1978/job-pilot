const DATA = [
  { label: "50-60%", value: 5 },
  { label: "60-70%", value: 15 },
  { label: "70-80%", value: 45 },
  { label: "80-90%", value: 85 },
  { label: "90-100%", value: 30 },
];

const Y_TICKS = [0, 25, 50, 75, 100];
const Y_MAX = 100;

const PAD_L = 30;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 28;
const VW = 560;
const VH = 220;
const CW = VW - PAD_L - PAD_R;
const CH = VH - PAD_T - PAD_B;

export function MatchScoreChart() {
  const slotW = CW / DATA.length;
  const barW = Math.round(slotW * 0.52);

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-text-primary mb-5">
        Match Score Distribution
      </h2>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full"
        aria-hidden="true"
      >
        {/* Y-axis grid lines + labels */}
        {Y_TICKS.map((tick) => {
          const y = PAD_T + CH - (tick / Y_MAX) * CH;
          return (
            <g key={tick}>
              <line
                x1={PAD_L}
                y1={y}
                x2={VW - PAD_R}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              <text
                x={PAD_L - 6}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fill="var(--color-text-muted)"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Bars + X-axis labels */}
        {DATA.map((d, i) => {
          const barH = (d.value / Y_MAX) * CH;
          const barX = PAD_L + i * slotW + (slotW - barW) / 2;
          const barY = PAD_T + CH - barH;
          const labelX = PAD_L + i * slotW + slotW / 2;

          return (
            <g key={d.label}>
              <rect
                x={barX}
                y={barY}
                width={barW}
                height={barH}
                fill="var(--color-success)"
                rx="4"
              />
              <text
                x={labelX}
                y={VH - PAD_B + 14}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-text-muted)"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
