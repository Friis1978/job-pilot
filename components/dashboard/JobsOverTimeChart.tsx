const DATA = [
  { label: "Mon", value: 15 },
  { label: "Tue", value: 35 },
  { label: "Wed", value: 30 },
  { label: "Thu", value: 45 },
  { label: "Fri", value: 85 },
  { label: "Sat", value: 80 },
  { label: "Sun", value: 15 },
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

// Catmull-Rom → cubic Bezier with tension 0.35
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  const t = 0.35;
  const px = (i: number) => pts[Math.max(0, Math.min(i, pts.length - 1))][0];
  const py = (i: number) => pts[Math.max(0, Math.min(i, pts.length - 1))][1];
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cp1x = (px(i) + (px(i + 1) - px(i - 1)) * t).toFixed(2);
    const cp1y = (py(i) + (py(i + 1) - py(i - 1)) * t).toFixed(2);
    const cp2x = (px(i + 1) - (px(i + 2) - px(i)) * t).toFixed(2);
    const cp2y = (py(i + 1) - (py(i + 2) - py(i)) * t).toFixed(2);
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

export function JobsOverTimeChart() {
  const slotW = CW / (DATA.length - 1);
  const baseY = PAD_T + CH;

  const points: [number, number][] = DATA.map((d, i) => [
    PAD_L + i * slotW,
    PAD_T + CH - (d.value / Y_MAX) * CH,
  ]);

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1][0]},${baseY} L ${points[0][0]},${baseY} Z`;

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-text-primary mb-5">
        Jobs Found Over Time
      </h2>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="jobsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

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

        {/* Area fill */}
        <path d={areaPath} fill="url(#jobsGradient)" />

        {/* Curve line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* X-axis labels */}
        {DATA.map((d, i) => (
          <text
            key={d.label}
            x={PAD_L + i * slotW}
            y={VH - PAD_B + 14}
            textAnchor="middle"
            fontSize="11"
            fill="var(--color-text-muted)"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
