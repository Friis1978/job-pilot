type HogQLResponse = {
  results: (string | number | null)[][];
};

/**
 * Executes a raw HogQL query against the configured PostHog project.
 * Applies an 8-second timeout and throws on non-2xx responses.
 */
async function hogql(query: string): Promise<HogQLResponse> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const host = process.env.POSTHOG_API_HOST;
  const projectId = process.env.POSTHOG_PROJECT_ID;

  if (!key) throw new Error("POSTHOG_PERSONAL_API_KEY is not set");
  if (!host || !projectId) throw new Error("PostHog host or project ID not configured");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

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
        signal: controller.signal,
      },
    );

    if (!res.ok) throw new Error(`PostHog query failed: ${res.status}`);
    return res.json() as Promise<HogQLResponse>;
  } catch (err) {
    console.error("[posthog-query]", err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
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

/** Coerces a HogQL result cell (string, number, or null) to a number, returning 0 for NaN/null. */
function safeNum(v: string | number | null | undefined): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Fetches aggregated job-search stats for the dashboard from PostHog event data.
 * All counts are scoped to the given user's `distinct_id`.
 */
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

// ── Jobs Found Over Time (last 14 days, daily, split by source) ─────────────

export type JobsOverTimePoint = { label: string; search: number; imported: number };

/**
 * Returns daily job counts for the last 30 days split into `search` (agent-found)
 * and `imported` (URL import) buckets. Days with no activity are included as zeros.
 */
export async function getJobsOverTime(userId: string): Promise<JobsOverTimePoint[]> {
  const { results } = await hogql(
    `SELECT toDate(timestamp) AS day, properties.source AS source, count() AS cnt
     FROM events
     WHERE event = 'job_found'
       AND distinct_id = '${userId}'
       AND timestamp >= now() - INTERVAL 14 DAY
     GROUP BY day, source
     ORDER BY day`,
  );

  const byDay = new Map<string, { search: number; imported: number }>();
  for (const [day, source, cnt] of results) {
    const key = String(day);
    const entry = byDay.get(key) ?? { search: 0, imported: 0 };
    if (String(source) === "url_import") entry.imported += Number(cnt);
    else entry.search += Number(cnt);
    byDay.set(key, entry);
  }

  const now = Date.now();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * 24 * 60 * 60 * 1000);
    const key = utcDateKey(d);
    const label = `${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${d.getUTCDate()}`;
    return { label, ...(byDay.get(key) ?? { search: 0, imported: 0 }) };
  });
}

// ── Match Score Distribution (all time, 5 buckets, split by source) ──────────

export type MatchScorePoint = { label: string; search: number; imported: number };

const SCORE_BUCKETS = [
  { label: "50-60%", min: 50, max: 60 },
  { label: "60-70%", min: 60, max: 70 },
  { label: "70-80%", min: 70, max: 80 },
  { label: "80-90%", min: 80, max: 90 },
  { label: "90-100%", min: 90, max: 101 },
] as const;

/**
 * Returns match score distribution across five fixed 10-point buckets (50–100%),
 * split by job source. Used to render the score histogram on the dashboard.
 */
export async function getMatchScoreDistribution(userId: string): Promise<MatchScorePoint[]> {
  const { results } = await hogql(
    `SELECT properties.matchScore AS score, properties.source AS source, count() AS cnt
     FROM events
     WHERE event = 'job_found'
       AND distinct_id = '${userId}'
       AND isNotNull(properties.matchScore)
     GROUP BY score, source`,
  );

  const search: Record<string, number> = Object.fromEntries(SCORE_BUCKETS.map((b) => [b.label, 0]));
  const imported: Record<string, number> = Object.fromEntries(SCORE_BUCKETS.map((b) => [b.label, 0]));

  for (const [score, source, cnt] of results) {
    const s = Number(score);
    const bucket = SCORE_BUCKETS.find((b) => s >= b.min && s < b.max);
    if (!bucket) continue;
    if (String(source) === "url_import") imported[bucket.label] += Number(cnt);
    else search[bucket.label] += Number(cnt);
  }

  return SCORE_BUCKETS.map((b) => ({ label: b.label, search: search[b.label], imported: imported[b.label] }));
}

// ── Token Usage By Feature (last 14 days, daily) ─────────────────────────────

export type TokenUsagePoint = { label: string; total: number } & Record<string, number | string>;

export type TokenUsageData = {
  points: TokenUsagePoint[];
  features: string[];
  totalTokens: number;
  isCost: boolean;
};

export async function getTokenUsageByFeature(userId: string): Promise<TokenUsageData> {
  try {
    const { results } = await hogql(
      `SELECT toDate(timestamp) AS day, properties.feature AS feature,
              sum(toFloatOrZero(toString(properties.cost_usd))) AS cost,
              sum(toFloatOrZero(toString(properties.total_tokens))) AS tokens
       FROM events
       WHERE event = 'ai_tokens_used'
         AND distinct_id = '${userId}'
         AND timestamp >= now() - INTERVAL 14 DAY
       GROUP BY day, feature
       ORDER BY day`,
    );

    const featureSet = new Set<string>();
    const byDay = new Map<string, Record<string, number>>();

    let hasCost = false;
    for (const [day, feature, cost, tokens] of results) {
      const key = String(day);
      const feat = String(feature);
      featureSet.add(feat);
      const entry = byDay.get(key) ?? {};
      const costVal = Number(cost);
      const tokensVal = Number(tokens);
      if (costVal > 0) hasCost = true;
      entry[feat] = (entry[feat] ?? 0) + (costVal > 0 ? costVal : tokensVal);
      byDay.set(key, entry);
    }

    const features = Array.from(featureSet);
    let totalTokens = 0;
    const now = Date.now();

    const points: TokenUsagePoint[] = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now - (13 - i) * 24 * 60 * 60 * 1000);
      const key = utcDateKey(d);
      const label = utcDateLabel(d);
      const dayData = byDay.get(key) ?? {};
      const total = features.reduce((sum, f) => sum + (dayData[f] ?? 0), 0);
      totalTokens += total;
      return { label, total, ...Object.fromEntries(features.map((f) => [f, dayData[f] ?? 0])) };
    });

    return { points, features, totalTokens, isCost: hasCost };
  } catch {
    return { points: [], features: [], totalTokens: 0, isCost: false };
  }
}

