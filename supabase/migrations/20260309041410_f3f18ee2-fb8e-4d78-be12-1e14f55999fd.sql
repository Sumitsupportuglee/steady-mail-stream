-- Fix linter: RLS enabled but no policy on integration_token_secrets
DO $$ BEGIN
  CREATE POLICY "No client access to integration token secrets (select)"
  ON public.integration_token_secrets
  FOR SELECT
  TO authenticated
  USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "No client access to integration token secrets (insert)"
  ON public.integration_token_secrets
  FOR INSERT
  TO authenticated
  WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "No client access to integration token secrets (update)"
  ON public.integration_token_secrets
  FOR UPDATE
  TO authenticated
  USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "No client access to integration token secrets (delete)"
  ON public.integration_token_secrets
  FOR DELETE
  TO authenticated
  USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
