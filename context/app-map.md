# App Map — Job Pilot

Quick reference for every domain, file, and function in the app. Use this when you need to find where something lives.

---

## Pages & Routes

| Route | File | What it does |
|---|---|---|
| `/` | `app/page.tsx` | Landing page — hero, features, how-it-works, CTA |
| `/auth/login` | `app/auth/login/page.tsx` | OAuth login (Google, GitHub) |
| `/auth/callback` | `app/auth/callback/route.ts` | OAuth redirect handler |
| `/dashboard` | `app/dashboard/page.tsx` | Stats, pipeline summary, activity feed, charts |
| `/find-jobs` | `app/find-jobs/page.tsx` | Job search form + jobs table |
| `/find-jobs/[id]` | `app/find-jobs/[id]/page.tsx` | Job detail — research dossier, cover letter, tailored resume |
| `/profile` | `app/profile/page.tsx` | Profile builder with completion indicator |

---

## API Routes

### Auth
| Route | File | What it does |
|---|---|---|
| `POST /api/auth/logout` | `app/api/auth/logout/route.ts` | Clear auth cookies, log out |
| `POST /api/auth/refresh` | `app/api/auth/refresh/route.ts` | Refresh auth session token |

### Resume
| Route | File | What it does |
|---|---|---|
| `POST /api/resume/generate` | `app/api/resume/generate/route.ts` | Generate resume PDF from profile (AI) |
| `POST /api/resume/extract` | `app/api/resume/extract/route.ts` | Parse uploaded PDF, extract profile fields (AI) |
| — | `app/api/resume/ResumePDF.tsx` | React PDF component for rendering resume |

### Agent Triggers (long-running, up to 5 min)
| Route | File | What it does |
|---|---|---|
| `POST /api/agent/find` | `app/api/agent/find/route.ts` | Search jobs across all sources |
| `POST /api/agent/research` | `app/api/agent/research/route.ts` | Research company for a job |
| `POST /api/agent/cover-letter` | `app/api/agent/cover-letter/route.ts` | Generate cover letter |
| `POST /api/agent/import-url` | `app/api/agent/import-url/route.ts` | Import and parse job from external URL |

### Jobs
| Route | File | What it does |
|---|---|---|
| `DELETE /api/jobs/[id]` | `app/api/jobs/[id]/route.ts` | Delete a job |
| `PATCH /api/jobs/[id]/status` | `app/api/jobs/[id]/status/route.ts` | Update job status (saved/applied/interviewing/offer/rejected) |
| `POST /api/jobs/[id]/rescore` | `app/api/jobs/[id]/rescore/route.ts` | Recalculate match score for one job |
| `GET /api/jobs/[id]/tailored-resume` | `app/api/jobs/[id]/tailored-resume/route.ts` | Generate tailored resume PDF for specific job |
| `GET /api/jobs/[id]/cover-letter` | `app/api/jobs/[id]/cover-letter/route.ts` | Download cover letter as PDF |
| `GET /api/jobs/[id]/cover-letter-text` | `app/api/jobs/[id]/cover-letter-text/route.ts` | Get cover letter as plain text |
| `DELETE /api/jobs/clear` | `app/api/jobs/clear/route.ts` | Delete all jobs for user |
| `POST /api/jobs/research-all` | `app/api/jobs/research-all/route.ts` | Research all unresearched jobs |
| `POST /api/jobs/rescore-all` | `app/api/jobs/rescore-all/route.ts` | Recalculate all match scores |
| `POST /api/jobs/regenerate-summaries` | `app/api/jobs/regenerate-summaries/route.ts` | Regenerate AI summaries for all jobs |

---

## AI Agents

| File | What it does |
|---|---|
| `agent/find-jobs.ts` | Search 5+ job sources in parallel, score results against user profile |
| `agent/research-company.ts` | Stagehand browser automation — scrape company site, build dossier |
| `agent/generate-cover-letter.ts` | Generate personalised cover letter using profile + job data |
| `agent/import-job-from-url.ts` | Parse a job listing from an external URL, save to DB |

---

## Server Actions

| File | Function | What it does |
|---|---|---|
| `actions/profile.ts` | `saveProfile()` | Save profile form to DB, compute `is_complete` flag |
| `actions/profile.ts` | `updateAvatarUrl()` | Update avatar URL only |
| `actions/profile.ts` | `updateResumeUrl()` | Update resume PDF URL only |

---

## Components

### Layout
| File | What it does |
|---|---|
| `components/layout/Navbar.tsx` | Top nav — logo, user dropdown, auth state |
| `components/layout/Footer.tsx` | Footer |

### Profile
| File | What it does |
|---|---|
| `components/profile/ProfileForm.tsx` | Full profile form — personal info, skills, work exp, education, preferences, cover letter |
| `components/profile/ProfilePageShell.tsx` | Profile page wrapper with tabs and resume section |
| `components/profile/CompletionIndicator.tsx` | Progress ring showing % complete and missing required fields |
| `components/profile/ResumeUpload.tsx` | PDF upload with auto-extraction to profile fields |
| `components/profile/AvatarCropModal.tsx` | Avatar image crop and upload modal |
| `components/profile/ConnectedAccounts.tsx` | OAuth linked accounts display |

### Find Jobs
| File | What it does |
|---|---|
| `components/find-jobs/SearchCard.tsx` | Job search form — title, location, recent searches |
| `components/find-jobs/JobsTable.tsx` | Sortable, filterable jobs table with score, status, company |
| `components/find-jobs/ResearchButton.tsx` | Trigger company research for a job |
| `components/find-jobs/CoverLetterSection.tsx` | Generate, view, and download cover letter |
| `components/find-jobs/TailoredResumeButton.tsx` | Generate tailored resume for a job |
| `components/find-jobs/RescoreButton.tsx` | Recalculate match score |
| `components/find-jobs/StatusBadge.tsx` | Dropdown to change job application status |
| `components/find-jobs/ApplicationPipeline.tsx` | Visual pipeline — saved → applied → interviewing → offer |

### Dashboard
| File | What it does |
|---|---|
| `components/dashboard/StatsBar.tsx` | KPI cards — total jobs, avg match score, researched count |
| `components/dashboard/RecentActivity.tsx` | Timeline of recent agent runs and events |
| `components/dashboard/PipelineCard.tsx` | Pipeline stage counts |
| `components/dashboard/JobsOverTimeChart.tsx` | Line chart — jobs discovered over time |
| `components/dashboard/MatchScoreChart.tsx` | Histogram — match score distribution |
| `components/dashboard/CompanyResearchChart.tsx` | Bar chart — companies researched |

### UI Primitives
| File | What it does |
|---|---|
| `components/ui/Tooltip.tsx` | Generic tooltip — used in JobsTable and charts |
| `components/ui/Toaster.tsx` | Toast notification renderer |

### Global
| File | What it does |
|---|---|
| `components/BulkOpsProvider.tsx` | Context for multi-select bulk job operations |
| `components/SessionKeepAlive.tsx` | Periodically refresh auth token to prevent logout |
| `components/PostHogIdentitySync.tsx` | Sync user identity to PostHog on login |

---

## Libraries & Utilities

### Backend Clients
| File | What it does |
|---|---|
| `lib/insforge-client.ts` | Browser-side InsForge client (auth, DB, storage) |
| `lib/insforge-server.ts` | Server-side InsForge client factory |
| `lib/browserbase.ts` | Browserbase client for headless browser scraping |

### Job Source Integrations
| File | Source | What it does |
|---|---|---|
| `lib/adzuna.ts` | Adzuna | Search jobs via Adzuna API |
| `lib/jobtech.ts` | JobTech | Swedish jobs API |
| `lib/jooble.ts` | Jooble | Search via Jooble API |
| `lib/careerjet.ts` | CareerJet | CareerJet job search |
| `lib/glassdoor.ts` | Glassdoor | Glassdoor listings |

### Analytics
| File | What it does |
|---|---|
| `lib/posthog-server.ts` | PostHog server client |
| `lib/posthog-query.ts` | Dashboard metric queries (trends, distribution, pipeline) |

### Utilities
| File | Key functions |
|---|---|
| `lib/utils.ts` | `computeTotalYearsExperience()`, `computeSkillYears()`, `normalizeLocation()`, `stripHtml()` |
| `lib/detect-language.ts` | `detectLanguage()` — detect job language for localised cover letters |
| `lib/toast.ts` | `toast(message, type)` — show success/error toasts |

---

## Types

All in `types/index.ts`:

| Type | What it represents |
|---|---|
| `Profile` | Full user profile DB record |
| `ProfileFormInput` | Form input shape passed to `saveProfile()` |
| `WorkExperience` | Single work experience entry |
| `Education` | Single education entry |
| `PersonalProject` | Single personal project entry |
| `JobRow` | Lightweight job record (table display) |
| `NormalizedJob` | Job after source normalisation (pre-score) |
| `ScoredJob` | Job with match score, matched skills, reasoning |
| `AdzunaJob` | Raw Adzuna API job shape |

---

## Key User Flows

### Job Discovery
1. User fills search form → `SearchCard` → `POST /api/agent/find`
2. `agent/find-jobs.ts` searches all sources in parallel
3. Claude AI scores each job against profile
4. Jobs saved to DB → `JobsTable` reloads

### Company Research
1. User clicks Research → `ResearchButton` → `POST /api/agent/research`
2. `agent/research-company.ts` uses Stagehand to scrape company website
3. Claude AI extracts dossier (overview, culture, contacts, tech, interview prep)
4. Saved to job record → shown on `/find-jobs/[id]`

### Cover Letter
1. User clicks Generate → `CoverLetterSection` → `POST /api/agent/cover-letter`
2. `agent/generate-cover-letter.ts` builds prompt from profile + job + research
3. Cover letter saved to job → can be viewed, downloaded as PDF or text

### Resume
1. Upload PDF → `ResumeUpload` → `POST /api/resume/extract` → profile fields pre-filled
2. Fill profile → `saveProfile()` → stored in DB
3. Generate resume → `POST /api/resume/generate` → PDF from `ResumePDF.tsx`
4. Tailored resume → `GET /api/jobs/[id]/tailored-resume` → job-specific PDF

### Profile Completion
1. Required fields checked in `app/profile/page.tsx` → `computeCompletion()`
2. `CompletionIndicator` shows % and missing fields
3. `saveProfile()` recomputes `is_complete` on every save
