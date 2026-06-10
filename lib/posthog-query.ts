type HogQLResponse = {
  results: (string | number | null)[][];
};

async function hogql(query: string): Promise<HogQLResponse> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const host = process.env.POSTHOG_API_HOST;
  const projectId = process.env.POSTHOG_PROJECT_ID;

  if (!key) throw new Error("POSTHOG_PERSONAL_API_KEY is not set");
  if (!host || !projectId) throw new Error("PostHog host or project ID not configured");

  try {
    const res = await fetch(
      `${host}/api/projects/${projectId}/query/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
        cache: "no-store",
      },
    );

    if (!res.ok) throw new Error(`PostHog query failed: ${res.status}`);
    return res.json() as Promise<HogQLResponse>;
  } catch (err) {
    console.error("[posthog-query]", err);
    throw err;
  }
}

// ── Shared type ─────────────────────────────────────────────────────────────

export type ChartPoint = { label: string; value: number };

// ── Date helpers (all UTC to match PostHog project timezone) ─────────────────

function utcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function utcDateLabel(d: Date): string {
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${month} ${d.getUTCDate()}`;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// ── Dashboard Stats ──────────────────────────────────────────────────────────

export type DashboardStats = {
  totalJobs: number;
  jobsThisWeek: number;
  jobsLastWeek: number;
  avgMatchRate: number;
  avgMatchRateThisWeek: number;
  avgMatchRateLastWeek: number;
  companiesResearched: number;
};

function safeNum(v: string | number | null | undefined): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const [jobResults, researchResults] = await Promise.all([
    hogql(
      `SELECT
         count() AS totalJobs,
         countIf(timestamp >= now() - INTERVAL 7 DAY) AS jobsThisWeek,
         countIf(timestamp >= now() - INTERVAL 14 DAY AND timestamp < now() - INTERVAL 7 DAY) AS jobsLastWeek,
         avg(properties.matchScore) AS avgMatchRate,
         avgIf(properties.matchScore, timestamp >= now() - INTERVAL 7 DAY) AS avgMatchRateThisWeek,
         avgIf(properties.matchScore, timestamp >= now() - INTERVAL 14 DAY AND timestamp < now() - INTERVAL 7 DAY) AS avgMatchRateLastWeek
       FROM events
       WHERE event = 'job_found'
         AND distinct_id = '${userId}'`,
    ),
    hogql(
      `SELECT count() AS companiesResearched
       FROM events
       WHERE event = 'company_researched'
         AND distinct_id = '${userId}'`,
    ),
  ]);

  const row = jobResults.results[0] ?? [];
  const resRow = researchResults.results[0] ?? [];

  return {
    totalJobs: safeNum(row[0]),
    jobsThisWeek: safeNum(row[1]),
    jobsLastWeek: safeNum(row[2]),
    avgMatchRate: Math.round(safeNum(row[3])),
    avgMatchRateThisWeek: Math.round(safeNum(row[4])),
    avgMatchRateLastWeek: Math.round(safeNum(row[5])),
    companiesResearched: safeNum(resRow[0]),
  };
}

// ── Jobs Found Over Time (last 30 days, daily) ───────────────────────────────

export async function getJobsOverTime(userId: string): Promise<ChartPoint[]> {
  const { results } = await hogql(
    `SELECT toDate(timestamp) AS day, count() AS cnt
     FROM events
     WHERE event = 'job_found'
       AND distinct_id = '${userId}'
       AND timestamp >= now() - INTERVAL 30 DAY
     GROUP BY day
     ORDER BY day`,
  );

  const countByDay = new Map<string, number>(
    results.map(([day, cnt]) => [String(day), Number(cnt)]),
  );

  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * 24 * 60 * 60 * 1000);
    return { label: utcDateLabel(d), value: countByDay.get(utcDateKey(d)) ?? 0 };
  });
}

// ── Match Score Distribution (all time, 5 buckets) ──────────────────────────

const SCORE_BUCKETS = [
  { label: "50-60%", min: 50, max: 60 },
  { label: "60-70%", min: 60, max: 70 },
  { label: "70-80%", min: 70, max: 80 },
  { label: "80-90%", min: 80, max: 90 },
  { label: "90-100%", min: 90, max: 101 },
] as const;

export async function getMatchScoreDistribution(
  userId: string,
): Promise<ChartPoint[]> {
  const { results } = await hogql(
    `SELECT properties.matchScore AS score, count() AS cnt
     FROM events
     WHERE event = 'job_found'
       AND distinct_id = '${userId}'
       AND isNotNull(properties.matchScore)
     GROUP BY score`,
  );

  const counts: Record<string, number> = Object.fromEntries(
    SCORE_BUCKETS.map((b) => [b.label, 0]),
  );

  for (const [score, cnt] of results) {
    const s = Number(score);
    const bucket = SCORE_BUCKETS.find((b) => s >= b.min && s < b.max);
    if (bucket) counts[bucket.label] += Number(cnt);
  }

  return SCORE_BUCKETS.map((b) => ({ label: b.label, value: counts[b.label] }));
}

// ── Company Research Activity (last 7 days, daily) ───────────────────────────

export async function getCompanyResearchActivity(
  userId: string,
): Promise<ChartPoint[]> {
  const { results } = await hogql(
    `SELECT toDate(timestamp) AS day, count() AS cnt
     FROM events
     WHERE event = 'company_researched'
       AND distinct_id = '${userId}'
       AND timestamp >= now() - INTERVAL 7 DAY
     GROUP BY day
     ORDER BY day`,
  );

  const countByDay = new Map<string, number>(
    results.map(([day, cnt]) => [String(day), Number(cnt)]),
  );

  const now = Date.now();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * 24 * 60 * 60 * 1000);
    return {
      label: DAY_LABELS[d.getUTCDay()],
      value: countByDay.get(utcDateKey(d)) ?? 0,
    };
  });
}
