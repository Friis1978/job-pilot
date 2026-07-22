-- Per-user AI spend, for the admin table.
--
-- A view rather than fetching token_usage into the page and summing there: the
-- table gains a row on every AI call, so client-side aggregation degrades as
-- the product is used.
--
-- security_invoker = true means the caller's RLS on token_usage applies, so this
-- inherits the policy added alongside it: an admin sees every user, and a normal
-- user sees only their own row. Without it the view would run as its owner and
-- expose everyone's spend to everyone.
CREATE OR REPLACE VIEW public.user_ai_spend
WITH (security_invoker = true) AS
SELECT
  user_id,
  ROUND(SUM(cost_usd), 4)                      AS total_cost_usd,
  COUNT(*)                                     AS generations,
  MAX(created_at)                              AS last_used_at,
  ROUND(SUM(cost_usd) FILTER (
    WHERE created_at >= date_trunc('month', now())
  ), 4)                                        AS cost_this_month
FROM public.token_usage
GROUP BY user_id;

COMMENT ON VIEW public.user_ai_spend IS
  'Per-user AI spend aggregated from token_usage. security_invoker, so admins see all rows and users see only their own.';

GRANT SELECT ON public.user_ai_spend TO authenticated;
