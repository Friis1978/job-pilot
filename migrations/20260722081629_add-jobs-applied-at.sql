-- "Applied this week" counted jobs whose status is currently 'applied' and whose
-- updated_at fell in the week. Both halves are wrong:
--
--   * updated_at moves for ANY edit — a rescore, a regenerated summary, a bulk
--     score correction — so untouched applications kept re-entering the week.
--   * filtering on status = 'applied' drops jobs that have since moved on. A job
--     applied for and then rejected was still applied for.
--
-- The fix is to record WHEN the application happened, once, and never move it.
-- A trigger rather than route code: status is written from the status route and
-- from bulk operations, and any future path would have to remember to stamp it.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS applied_at timestamptz;

COMMENT ON COLUMN public.jobs.applied_at IS
  'When the job first entered an applied state. Never cleared — a rejected job was still applied for. NULL means never applied, or applied before this column existed.';

-- Statuses that mean an application exists. 'no_fit' and 'saved' do not: they
-- describe a decision made before applying.
CREATE OR REPLACE FUNCTION public.stamp_jobs_applied_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  -- Postgres carries unchanged columns into NEW, so an existing applied_at
  -- survives untouched updates. Only an unset one is ever stamped, which is what
  -- makes this idempotent: re-saving an applied job does not move the date.
  IF NEW.applied_at IS NULL
     AND NEW.status IN ('applied', 'interviewing', 'offer', 'rejected', 'rejected_after_interview', 'no_answer')
  THEN
    NEW.applied_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_stamp_applied_at ON public.jobs;
CREATE TRIGGER jobs_stamp_applied_at
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.stamp_jobs_applied_at();

-- Backfill. updated_at is the only surviving signal for historical applications,
-- and it is an approximation: it marks the last edit, not the application.
--
-- It is not even that for 45 rows touched at 2026-07-21 10:26 by a bulk
-- match_score correction, which reset their updated_at to that minute. Those are
-- deliberately left NULL rather than backfilled to a date that is known to be
-- wrong — a NULL reads as "applied, date unknown" and keeps them out of weekly
-- counts they do not belong in. 18 applied-state jobs are affected.
UPDATE public.jobs
SET applied_at = updated_at
WHERE applied_at IS NULL
  AND status IN ('applied', 'interviewing', 'offer', 'rejected', 'rejected_after_interview', 'no_answer')
  AND to_char(updated_at, 'YYYY-MM-DD HH24:MI') <> '2026-07-21 10:26';

CREATE INDEX IF NOT EXISTS idx_jobs_applied_at
  ON public.jobs (user_id, applied_at)
  WHERE applied_at IS NOT NULL;
