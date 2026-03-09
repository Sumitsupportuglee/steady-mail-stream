-- Integration API tokens for inbound webhooks (Zapier etc.)

-- 1) Metadata table (user-visible)
CREATE TABLE IF NOT EXISTS public.integration_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Default token',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NULL
);

ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
DO $$ BEGIN
  CREATE POLICY "Users can view their own integration tokens"
  ON public.integration_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create their own integration tokens"
  ON public.integration_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own integration tokens"
  ON public.integration_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own integration tokens"
  ON public.integration_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_integration_tokens_user_id ON public.integration_tokens(user_id);

-- 2) Secret hash table (NOT readable by clients)
CREATE TABLE IF NOT EXISTS public.integration_token_secrets (
  token_id uuid PRIMARY KEY REFERENCES public.integration_tokens(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE
);

ALTER TABLE public.integration_token_secrets ENABLE ROW LEVEL SECURITY;
-- No client access policies on purpose (service role bypasses RLS)

-- 3) RPC to create a token (stores hash server-side, returns token_id)
CREATE OR REPLACE FUNCTION public.create_integration_token(_name text, _token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _token_hash IS NULL OR length(_token_hash) < 16 THEN
    RAISE EXCEPTION 'Invalid token hash';
  END IF;

  INSERT INTO public.integration_tokens (user_id, name)
  VALUES (auth.uid(), COALESCE(NULLIF(trim(_name), ''), 'Default token'))
  RETURNING id INTO _token_id;

  INSERT INTO public.integration_token_secrets (token_id, token_hash)
  VALUES (_token_id, _token_hash);

  RETURN _token_id;
END;
$$;

-- 4) Allow users to insert webhook logs for their own events (for debugging)
DO $$ BEGIN
  CREATE POLICY "Users can insert their own webhook logs"
  ON public.webhook_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
