# Job Pilot

An AI-powered job hunting assistant. Set up your profile once, then let the agent find relevant jobs, score them against your actual skills, research each company, and generate a tailored cover letter — all before you click Apply.

**Live:** [8kj4iaqv.insforge.site](https://8kj4iaqv.insforge.site)

---

## What it does

- **Job discovery** — searches Adzuna, JobTech, Jooble, CareerJet, and Glassdoor in parallel for roles matching your title and location
- **AI matching** — GPT-4o scores every job 0–100 against your profile and explains why it fits, with matched and missing skills highlighted
- **Company research** — Browserbase + Stagehand autonomously browses the company's public website and builds a structured dossier: overview, tech stack, culture signals, why the role exists, and interview prep talking points
- **Cover letter generation** — GPT-4o writes a personalised letter from your profile, the job description, and the company research; detects the job's language and writes in it (Danish, Swedish, Norwegian, German, Dutch, French, Spanish, English)
- **Resume generation** — generates a clean PDF resume from your profile, or a job-tailored version for a specific role
- **Resume extraction** — upload an existing PDF and GPT-4o pre-fills your profile fields from it
- **Application pipeline** — track jobs through Saved → Applied → Interviewing → Offer
- **Dashboard analytics** — PostHog-powered charts for jobs over time, match score distribution, and company research activity

---

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router) |
| Backend (DB, Auth, Storage) | InsForge |
| AI model | OpenAI GPT-4o |
| Cloud browser | Browserbase |
| Browser automation | Stagehand |
| Job sources | Adzuna, JobTech, Jooble, CareerJet, RapidAPI (Glassdoor) |
| Analytics | PostHog |
| PDF generation | @react-pdf/renderer |
| Styling | Tailwind CSS 4 |
| Language | TypeScript (strict) |

---

## Pages

```
/                  Homepage
/auth/login        Google + GitHub OAuth
/dashboard         Stats, activity feed, analytics
/find-jobs         Search + job list with filters
/find-jobs/[id]    Job details, company research, cover letter, tailored resume
/profile           Profile builder, resume upload and generation
```

---

## Prerequisites

- Node.js 20+
- An [InsForge](https://insforge.dev) project with Google and/or GitHub OAuth configured
- An [OpenAI](https://platform.openai.com) account with GPT-4o access
- A [Browserbase](https://browserbase.com) account for company research
- Job source API keys (Adzuna required; Jooble, CareerJet, RapidAPI optional but recommended)
- A [PostHog](https://posthog.com) project for analytics (optional)

---

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env.local` in the project root:

```env
# InsForge — database, auth, and file storage
NEXT_PUBLIC_INSFORGE_URL=https://your-project.region.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=your-anon-key

# OpenAI — job matching, cover letters, resume generation, research synthesis
OPENAI_API_KEY=sk-...

# Browserbase — headless browser for company research
BROWSERBASE_API_KEY=bb_live_...
BROWSERBASE_PROJECT_ID=your-project-id

# Job sources
ADZUNA_APP_ID=your-adzuna-app-id        # developer.adzuna.com
ADZUNA_APP_KEY=your-adzuna-app-key
JOOBLE_API_KEY=your-jooble-key          # jooble.org/api/index
CAREERJET_API_KEY=your-careerjet-key    # careerjet.com/affiliate
RAPIDAPI_KEY=your-rapidapi-key          # rapidapi.com — used for Glassdoor

# PostHog — event tracking and dashboard charts
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
POSTHOG_PERSONAL_API_KEY=phx_...
POSTHOG_API_HOST=https://eu.posthog.com
POSTHOG_PROJECT_ID=your-project-id
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variable reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_INSFORGE_URL` | Yes | InsForge backend base URL |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | Yes | InsForge public anon key |
| `OPENAI_API_KEY` | Yes | OpenAI API key — needs GPT-4o access |
| `BROWSERBASE_API_KEY` | Yes | Browserbase API key for company research |
| `BROWSERBASE_PROJECT_ID` | Yes | Browserbase project ID |
| `ADZUNA_APP_ID` | Yes | Adzuna app ID |
| `ADZUNA_APP_KEY` | Yes | Adzuna app key |
| `JOOBLE_API_KEY` | No | Jooble API key |
| `CAREERJET_API_KEY` | No | CareerJet API key |
| `RAPIDAPI_KEY` | No | RapidAPI key — used for Glassdoor integration |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | No | PostHog project token for browser-side event capture |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | PostHog ingest host (`https://eu.i.posthog.com` for EU) |
| `POSTHOG_PERSONAL_API_KEY` | No | PostHog personal API key — used for dashboard chart queries |
| `POSTHOG_API_HOST` | No | PostHog API host (`https://eu.posthog.com` for EU) |
| `POSTHOG_PROJECT_ID` | No | PostHog project ID |

---

## Project structure

```
/
├── agent/                      # AI agent logic — no React, no UI
│   ├── find-jobs.ts            # Multi-source job discovery + GPT-4o scoring
│   ├── research-company.ts     # Browserbase + Stagehand company dossier
│   ├── generate-cover-letter.ts
│   └── import-job-from-url.ts
├── app/
│   ├── page.tsx                # Landing page
│   ├── auth/                   # OAuth login + callback handler
│   ├── dashboard/              # Stats, activity feed, analytics charts
│   ├── find-jobs/              # Search form + job list + job details
│   ├── profile/                # Profile builder + resume management
│   └── api/                    # API routes (agent triggers, resume, jobs CRUD)
├── actions/                    # Next.js Server Actions (profile save/update)
├── components/                 # UI components — no DB calls, no business logic
├── lib/                        # Third-party client init + shared utilities
├── types/                      # Shared TypeScript types
└── context/                    # Architecture docs and AI agent guidelines
```

See [`context/app-map.md`](context/app-map.md) for a full reference of every route, component, agent, and utility function.

---

## Key flows

### Finding jobs
1. Fill in job title and location on the Find Jobs page
2. The agent searches all sources in parallel and GPT-4o scores each result against your profile
3. Jobs appear in the table sorted by match score with matched and missing skills
4. Click any row to open the full job detail page

### Company research
1. Open a job's detail page and click **Research Company**
2. The agent opens a Browserbase session, browses the company's public website (homepage, About, Engineering/Blog pages), and synthesises a structured dossier
3. Fallback: if the site can't be reached, GPT-4o generates a best-effort dossier from the company name and job description alone

### Cover letter
1. Click **Generate Cover Letter** on any job detail page
2. GPT-4o writes a letter using your profile, job description, and company research dossier
3. The letter is written in the detected language of the job posting
4. Download as PDF or copy as plain text; previous versions are archived automatically

### Resume
1. Upload an existing PDF on the Profile page — GPT-4o extracts your details and pre-fills the form
2. Edit any field manually, then generate a clean PDF resume from your current profile
3. From any job detail page, generate a job-tailored version optimised for that role

---

## Deployment

Deploys automatically to InsForge on every push to `main` via GitHub Actions.

The workflow requires one repository secret:

| Secret | Description |
|---|---|
| `INSFORGE_REFRESH_TOKEN` | InsForge CLI refresh token for CI authentication |

To deploy manually:

```bash
npx @insforge/cli@latest deployments deploy .
```

---

## Notes

- **Browserbase** is required for company research. Without it the agent falls back to GPT-4o synthesis only (no live browsing).
- **Agent routes** (`/api/agent/*`) can run for up to 5 minutes. On short-timeout serverless platforms, max execution time may need to be increased.
- **Job language detection** covers Danish, Swedish, Norwegian, German, Dutch, French, Spanish, and English. Letters are always written in the detected language of the job posting.
- **Adzuna** always searches with `category=it-jobs`. Change this in `lib/adzuna.ts` for non-tech roles.
- **RLS** — all database queries are scoped to the authenticated user via InsForge Row Level Security. Never query without a `user_id` filter in application code.
