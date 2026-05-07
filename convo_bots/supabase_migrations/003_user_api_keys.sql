-- ─── user_api_keys ────────────────────────────────────────────────────────────
-- Per-profile API key storage. Keys are tied to the user's account so they
-- persist across devices. Stored as plaintext behind RLS; only the authenticated
-- user can read/write their own rows (plus the service-role admin key).
--
-- IMPORTANT: run this after running the base schema (001_init.sql).

CREATE TABLE IF NOT EXISTS public.user_api_keys (
  user_id   uuid    REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider  text    NOT NULL CHECK (provider IN ('anthropic', 'openai', 'huggingface')),
  api_key   text    NOT NULL,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can only access own api keys"
  ON public.user_api_keys
  FOR ALL
  USING (auth.uid() = user_id);

-- ─── profiles: track ToS acceptance ──────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz;
