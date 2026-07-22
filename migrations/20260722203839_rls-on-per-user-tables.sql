-- Four tables held per-user data with row level security switched off and no
-- policies, so any authenticated user could read every other user's rows
-- through the API:
--
--   cover_letter_history  generated cover letters — names, work history
--   job_searches          what each user searched for
--   skipped_jobs          postings the agent discarded, with match scores
--   token_usage           what each user has spent
--
-- All four carry user_id, and no application code reads them across users, so
-- owner-scoped policies are safe. token_usage additionally allows admins to
-- read every row, which the admin table needs to show per-user AI spend.
--
-- current_user_is_admin() already exists as a SECURITY DEFINER helper and is
-- used by the profiles policies; reusing it avoids a second source of truth.

-- ── cover_letter_history ────────────────────────────────────────────────────
ALTER TABLE public.cover_letter_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_cover_letter_history ON public.cover_letter_history;
CREATE POLICY own_cover_letter_history ON public.cover_letter_history
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── job_searches ────────────────────────────────────────────────────────────
ALTER TABLE public.job_searches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_job_searches ON public.job_searches;
CREATE POLICY own_job_searches ON public.job_searches
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── skipped_jobs ────────────────────────────────────────────────────────────
ALTER TABLE public.skipped_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_skipped_jobs ON public.skipped_jobs;
CREATE POLICY own_skipped_jobs ON public.skipped_jobs
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ── token_usage ─────────────────────────────────────────────────────────────
-- Rows are written by insert_token_usage(), which is SECURITY DEFINER and so
-- is unaffected by these policies. Nothing else writes here, so the only grant
-- needed is read.
ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_token_usage ON public.token_usage;
CREATE POLICY own_token_usage ON public.token_usage
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR current_user_is_admin());

-- Policy columns must be indexed or every check is a sequential scan.
CREATE INDEX IF NOT EXISTS idx_cover_letter_history_user ON public.cover_letter_history (user_id);
CREATE INDEX IF NOT EXISTS idx_job_searches_user        ON public.job_searches (user_id);
CREATE INDEX IF NOT EXISTS idx_skipped_jobs_user        ON public.skipped_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_user         ON public.token_usage (user_id);
