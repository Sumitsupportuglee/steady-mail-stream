
-- Function: auto-create CRM lead when an email is sent (status = 'sent')
CREATE OR REPLACE FUNCTION public.auto_create_crm_lead_from_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _contact_name TEXT;
  _contact_email TEXT;
  _client_id UUID;
  _existing_lead UUID;
BEGIN
  -- Only trigger when status changes to 'sent'
  IF NEW.status = 'sent' AND (OLD.status IS NULL OR OLD.status <> 'sent') THEN
    -- Check if a CRM lead already exists for this contact + user
    SELECT id INTO _existing_lead
    FROM public.crm_leads
    WHERE user_id = NEW.user_id AND email = NEW.to_email
    LIMIT 1;

    -- Only create if no existing lead
    IF _existing_lead IS NULL THEN
      -- Get contact info
      SELECT name, email, client_id INTO _contact_name, _contact_email, _client_id
      FROM public.contacts
      WHERE id = NEW.contact_id
      LIMIT 1;

      INSERT INTO public.crm_leads (user_id, client_id, contact_id, name, email, stage, notes, position)
      VALUES (
        NEW.user_id,
        _client_id,
        NEW.contact_id,
        COALESCE(_contact_name, split_part(NEW.to_email, '@', 1)),
        NEW.to_email,
        'contacted',
        'Auto-created from campaign email sent on ' || to_char(NOW(), 'YYYY-MM-DD'),
        0
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on email_queue updates
CREATE TRIGGER trg_auto_crm_lead_on_email_sent
  AFTER UPDATE ON public.email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_crm_lead_from_email();

-- Also trigger on insert (in case status is 'sent' on insert)
CREATE TRIGGER trg_auto_crm_lead_on_email_insert
  AFTER INSERT ON public.email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_crm_lead_from_email();

-- Function: auto-advance CRM lead stage on email open
CREATE OR REPLACE FUNCTION public.auto_advance_crm_on_open()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _to_email TEXT;
BEGIN
  -- Get the email from the queue entry
  SELECT to_email INTO _to_email FROM public.email_queue WHERE id = NEW.email_queue_id;

  -- Advance lead from 'contacted' to 'interested'
  UPDATE public.crm_leads
  SET stage = 'interested'
  WHERE user_id = NEW.user_id
    AND email = _to_email
    AND stage = 'contacted';

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_advance_crm_on_open
  AFTER INSERT ON public.email_opens
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_advance_crm_on_open();

-- Function: auto-advance CRM lead stage on email click
CREATE OR REPLACE FUNCTION public.auto_advance_crm_on_click()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _to_email TEXT;
BEGIN
  SELECT to_email INTO _to_email FROM public.email_queue WHERE id = NEW.email_queue_id;

  -- Advance lead to 'interested' if still at contacted, or keep at interested+
  UPDATE public.crm_leads
  SET stage = 'interested'
  WHERE user_id = NEW.user_id
    AND email = _to_email
    AND stage IN ('contacted', 'new_lead');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_advance_crm_on_click
  AFTER INSERT ON public.email_clicks
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_advance_crm_on_click();
