-- 1. Extend crm_stage_type enum
ALTER TYPE public.crm_stage_type ADD VALUE IF NOT EXISTS 'unsubscribed';

-- 2. email_unsubscribes table
CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  contact_id UUID,
  campaign_id UUID,
  email_queue_id UUID,
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_unsubscribes_user_email_uniq
  ON public.email_unsubscribes (user_id, lower(email));
CREATE INDEX IF NOT EXISTS email_unsubscribes_user_id_idx
  ON public.email_unsubscribes (user_id);
CREATE INDEX IF NOT EXISTS email_unsubscribes_campaign_id_idx
  ON public.email_unsubscribes (campaign_id);

ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own unsubscribes"
  ON public.email_unsubscribes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert unsubscribes"
  ON public.email_unsubscribes FOR INSERT
  WITH CHECK (true);

-- 3. Trigger: when an unsubscribe is recorded, update contacts + crm_leads
CREATE OR REPLACE FUNCTION public.auto_unsubscribe_contact_and_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark matching contacts as unsubscribed
  UPDATE public.contacts
  SET status = 'unsubscribed', updated_at = now()
  WHERE user_id = NEW.user_id
    AND lower(email) = lower(NEW.email);

  -- Move matching CRM leads to 'unsubscribed' stage
  UPDATE public.crm_leads
  SET stage = 'unsubscribed', updated_at = now()
  WHERE user_id = NEW.user_id
    AND lower(email) = lower(NEW.email);

  -- If no CRM lead exists yet, create one in unsubscribed stage so it shows up
  INSERT INTO public.crm_leads (user_id, contact_id, name, email, stage, position, notes)
  SELECT NEW.user_id, NEW.contact_id,
         COALESCE(split_part(NEW.email, '@', 1), NEW.email),
         NEW.email,
         'unsubscribed', 0,
         'Auto-created from unsubscribe on ' || to_char(now(), 'YYYY-MM-DD')
  WHERE NOT EXISTS (
    SELECT 1 FROM public.crm_leads
    WHERE user_id = NEW.user_id AND lower(email) = lower(NEW.email)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_unsubscribe ON public.email_unsubscribes;
CREATE TRIGGER trg_auto_unsubscribe
AFTER INSERT ON public.email_unsubscribes
FOR EACH ROW EXECUTE FUNCTION public.auto_unsubscribe_contact_and_lead();

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_unsubscribes;
ALTER TABLE public.email_unsubscribes REPLICA IDENTITY FULL;