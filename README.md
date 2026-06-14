# JobPilot

An AI-powered job hunting assistant. Set up your profile once, and the agent finds relevant jobs, scores them against your skills, and researches companies — so you arrive at every application fully informed.

**Live:** [8kj4iaqv.insforge.site](https://8kj4iaqv.insforge.site)

---

## What it does

- **Find Jobs** — searches Adzuna, Jooble, Careerjet, and Glassdoor for roles matching your title and location
- **AI Matching** — GPT-4o scores every job 0–100 against your actual profile, with matched and missing skills
- **Company Research** — Browserbase + Stagehand browses the company's public pages; GPT-4o synthesises a structured dossier with overview, tech stack, culture, and interview talking points
- **Resume Generation** — generates a clean PDF resume from your profile using GPT-4o
- **Dashboard** — stats bar, recent activity feed, and PostHog-powered analytics charts

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| Backend | InsForge (PostgreSQL, Auth, Storage) |
| AI | OpenAI GPT-4o |
| Browser agent | Browserbase + Stagehand |
| Job sources | Adzuna, Jooble, Careerjet, Glassdoor |
| Analytics | PostHog |
| Deployment | InsForge (Vercel-backed) |

---

## Pages

```
/                  Homepage
/auth/login        Google + GitHub OAuth
/dashboard         Stats, recent activity, analytics
/find-jobs         Search + job list
/find-jobs/[id]    Job details + company research
/profile           Profile form, resume upload and generation
```

---

## Local setup

```bash
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_INSFORGE_URL=
NEXT_PUBLIC_INSFORGE_ANON_KEY=

NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=
NEXT_PUBLIC_POSTHOG_HOST=

OPENAI_API_KEY=

ADZUNA_APP_ID=
ADZUNA_APP_KEY=
JOOBLE_API_KEY=
CAREERJET_API_KEY=
RAPIDAPI_KEY=

BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=

POSTHOG_PERSONAL_API_KEY=
POSTHOG_API_HOST=
POSTHOG_PROJECT_ID=
```

```bash
npm run dev
```

---

## Deployment

Deploys automatically to InsForge on every push to `main` via GitHub Actions.

The workflow requires one repository secret:

| Secret | Description |
|--------|-------------|
| `INSFORGE_REFRESH_TOKEN` | InsForge CLI refresh token for CI auth |

To deploy manually:

```bash
npx @insforge/cli@latest deployments deploy .
```
