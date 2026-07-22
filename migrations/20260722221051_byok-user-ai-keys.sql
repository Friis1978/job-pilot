-- Bring-your-own Claude key.
--
-- Anthropic offers exactly two credential types: static API keys and Workload
-- Identity Federation. WIF federates *your own* cloud infrastructure identity —
-- there is no OAuth flow that lets this app act on an end user's Anthropic
-- account. So letting a user pay for their own usage means holding their key,
-- and the only question is how carefully.
--
-- Its own table, not a column on profiles:
--   * profiles is selected with `*` in several places and rendered into pages.
--     A key sitting there would eventually be serialised somewhere it should
--     not be. A separate table cannot be picked up by accident.
--   * the server has no service role — createInsforgeServer() acts with the
--     caller's own JWT — so RLS is the only database-level guard, and the owner
--     can read their own row straight through PostgREST. That is acceptable for
--     a key that belongs to them, but it means RLS is not what protects the
--     secret: the ciphertext is. Encryption happens in the app (AES-256-GCM,
--     BYOK_ENCRYPTION_KEY) and the plaintext never reaches the database, so a
--     table dump or a raw PostgREST read yields nothing usable.

CREATE TABLE IF NOT EXISTS public.user_ai_keys (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- AES-256-GCM. Split into its three parts rather than one packed string so a
  -- malformed row is obvious instead of failing deep inside the cipher.
  ciphertext       text        NOT NULL,
  iv               text        NOT NULL,
  auth_tag         text        NOT NULL,
  -- Last four characters only, for "sk-ant-…a4f2" in the UI. Never enough to
  -- reconstruct the key, always enough for the user to tell two keys apart.
  key_hint         text        NOT NULL,
  -- Set when a call fails authentication, so the UI can say "your key stopped
  -- working" instead of failing the same way every time with no explanation.
  status           text        NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'invalid')),
  last_verified_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_ai_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_ai_key ON public.user_ai_keys;
CREATE POLICY own_ai_key ON public.user_ai_keys
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.user_ai_keys IS
  'Per-user Anthropic API key, encrypted with AES-256-GCM by the application. The database never sees the plaintext; BYOK_ENCRYPTION_KEY lives only in the server environment.';
COMMENT ON COLUMN public.user_ai_keys.key_hint IS
  'Last four characters of the key, for display. Not sufficient to reconstruct it.';
