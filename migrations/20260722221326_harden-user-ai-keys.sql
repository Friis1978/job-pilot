-- Tighten user_ai_keys beyond the project default, because it is the one table
-- holding a credential that belongs to someone else.
--
-- Two gaps the default grants leave open:
--
-- 1. `anon` inherited SELECT/INSERT/UPDATE/DELETE, like every other table. RLS
--    already makes it useless — an unauthenticated request has auth.uid() NULL,
--    and `user_id = NULL` matches no row — but a secrets table should not be
--    reachable by an unauthenticated role at all. If a policy is ever loosened
--    by mistake, the grant is what decides whether that mistake is exploitable
--    from outside.
--
-- 2. RLS is not FORCEd, so the table owner (project_admin) bypasses every
--    policy. The app never connects as project_admin — createInsforgeServer()
--    uses the caller's JWT, so queries run as `authenticated` — which makes
--    FORCE free here and closes the bypass for anything that later connects
--    with the owner role.
--
-- Note for future migrations: with FORCE set, DML against this table from a
-- migration (which runs as project_admin) is also subject to RLS and will
-- affect no rows. DDL is unaffected. Drop the FORCE deliberately if a
-- backfill is ever genuinely needed.

REVOKE ALL ON public.user_ai_keys FROM anon;

ALTER TABLE public.user_ai_keys FORCE ROW LEVEL SECURITY;

COMMENT ON POLICY own_ai_key ON public.user_ai_keys IS
  'Owner-only, with no admin exception by design. Unlike token_usage, an admin must not be able to read another user''s API key.';
