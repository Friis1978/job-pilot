// Quick smoke test for all job search APIs
// Usage: node --env-file=.env.local scripts/test-job-sources.mjs

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const JOOBLE_KEY = process.env.JOOBLE_API_KEY;
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;

const JOB_TITLE = "software engineer";

async function test(name, fn) {
  try {
    const jobs = await fn();
    const count = Array.isArray(jobs) ? jobs.length : "?";
    console.log(`✅ ${name}: ${count} jobs`);
    if (Array.isArray(jobs) && jobs.length > 0) {
      const j = jobs[0];
      console.log(`   Sample: "${j.title ?? j.job_title ?? j.jobTitleText}" @ ${j.company ?? j.company_name ?? j.employer?.name ?? "?"}`);
    }
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
  }
}

// Glassdoor (Sweden)
await test("Glassdoor (Sweden)", async () => {
  const params = new URLSearchParams({ query: JOB_TITLE, location: "Sweden", page: "1" });
  const r = await fetch(`https://glassdoor-real-time.p.rapidapi.com/jobs/search?${params}`, {
    headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": "glassdoor-real-time.p.rapidapi.com" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return (data?.data?.jobListings ?? []).map(item => ({
    title: item.jobview.job.jobTitleText,
    company: item.jobview.header.employer?.name,
  }));
});

// Glassdoor (Denmark)
await test("Glassdoor (Denmark)", async () => {
  const params = new URLSearchParams({ query: JOB_TITLE, location: "Denmark", page: "1" });
  const r = await fetch(`https://glassdoor-real-time.p.rapidapi.com/jobs/search?${params}`, {
    headers: { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": "glassdoor-real-time.p.rapidapi.com" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return (data?.data?.jobListings ?? []).map(item => ({
    title: item.jobview.job.jobTitleText,
    company: item.jobview.header.employer?.name,
  }));
});

// Jobtech (Sweden)
await test("Jobtech (Sweden)", async () => {
  const params = new URLSearchParams({ q: JOB_TITLE, limit: "10" });
  const r = await fetch(`https://jobsearch.api.jobtechdev.se/search?${params}`, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return (data.hits ?? []).map(j => ({ title: j.headline, company: j.employer?.name }));
});

// Jooble
if (JOOBLE_KEY) {
  await test("Jooble", async () => {
    const r = await fetch(`https://jooble.org/api/${JOOBLE_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: JOB_TITLE, location: "Sweden" }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return data.jobs ?? [];
  });
} else {
  console.log("⚠️  Jooble: JOOBLE_API_KEY not set, skipping");
}

// Careerjet (Denmark)
await test("Careerjet (Denmark)", async () => {
  const params = new URLSearchParams({ keywords: JOB_TITLE, location: "Denmark", affid: "test", user_ip: "1.2.3.4", url: "http://localhost", locale_code: "en_DK" });
  const r = await fetch(`http://public.api.careerjet.net/search?${params}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.jobs ?? [];
});
