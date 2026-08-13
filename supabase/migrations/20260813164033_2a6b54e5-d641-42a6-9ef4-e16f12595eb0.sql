ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_free_trial()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
     SET trial_started_at = COALESCE(trial_started_at, now()),
         trial_ends_at    = COALESCE(trial_ends_at, now() + interval '14 days'),
         updated_at       = now()
   WHERE id = auth.uid()
  RETURNING * INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_free_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_free_trial() TO authenticated;