-- Give every newly approved user $10 of credit, so they can use the app before
-- paying anything.
--
-- The credit is granted as a `payments` row rather than by setting
-- profiles.credit_balance_usd. That column is not authoritative: the token_usage
-- trigger recomputes it as SUM(payments) - SUM(token_usage) on the next AI call,
-- so a direct write would silently vanish the first time the user generated
-- anything. Inserting a payment also makes the grant visible in payment history,
-- which is where a user would look to understand their balance.
--
-- A trigger rather than route code: approval is written by the admin route today,
-- but also from raw SQL, and anything added later would have to remember.

CREATE OR REPLACE FUNCTION public.grant_welcome_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  welcome_amount CONSTANT numeric := 10.00;
  -- payments.stripe_session_id is UNIQUE, so this marker must be per-user. A
  -- shared constant would insert for the first user and then throw for every
  -- one after, failing the whole approval.
  marker CONSTANT text := 'welcome_credit:' || NEW.id::text;
BEGIN
  IF NEW.approval_status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.approval_status IS DISTINCT FROM 'approved')
     -- Granted once per user for good: approving, revoking and re-approving
     -- must not hand out a second $10.
     AND NOT EXISTS (SELECT 1 FROM public.payments WHERE stripe_session_id = marker)
  THEN
    INSERT INTO public.payments (user_id, amount_usd, stripe_session_id, paid_at)
    VALUES (NEW.id, welcome_amount, marker, now());
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.grant_welcome_credit() IS
  'Grants $10 of starting credit the first time a profile reaches approval_status = approved. Idempotent per user via the welcome_credit:<id> marker in payments.stripe_session_id.';

DROP TRIGGER IF EXISTS profiles_grant_welcome_credit ON public.profiles;
CREATE TRIGGER profiles_grant_welcome_credit
  AFTER INSERT OR UPDATE OF approval_status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_welcome_credit();
