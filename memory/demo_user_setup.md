---
name: demo_user_setup
description: Demo user account for screenshot/demo generation; login via /api/auth/demo-login in dev
metadata:
  type: reference
---

## Demo User Account

**Email:** `demo@devjobinfo.com`  
**Password:** `DemoUser2024!` (set in `.env.local`)  
**User ID:** `07ea19b8-6b7b-4eba-b2b2-0f8b548e894b`  
**Status:** Approved, complete profile

### Quick login
1. Dev only: navigate to `http://localhost:3000/api/auth/demo-login`
2. Automatically logged in and redirected to dashboard
3. Pre-seeded with:
   - Complete profile: Alex Jensen, 8y senior full-stack engineer
   - 19 jobs across all statuses (Saved, Applied, Interviewing, No answer, Rejected after interview)
   - Realistic work experience, education, skills

### Seeding details
- Profile SQL: covers full_name, email, skills, experience, work_history, education, career preferences
- Jobs SQL: includes match scores, company research placeholders, realistic Scandi tech companies
- Both under `07ea19b8-6b7b-4eba-b2b2-0f8b548e894b` user ID

### Screenshots captured
- `public/images/dashboard-2026-07-10.jpeg` — dashboard with pipeline widget showing job counts per status
- `public/images/pipeline-2026-07-10.jpeg` — pipeline status filter widget (from job detail page)
- `public/images/jobs-pipeline-2026-07-10.jpeg` — jobs list showing each job with status pill

Use this account whenever generating new demo screenshots for docs/README.
