
-- 1. Drop permissive service_role policies (service_role key bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Service role can update email queue" ON public.email_queue;
DROP POLICY IF EXISTS "Service role can update subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can insert email clicks" ON public.email_clicks;
DROP POLICY IF EXISTS "Service role can insert email opens" ON public.email_opens;
DROP POLICY IF EXISTS "Service role can insert unsubscribes" ON public.email_unsubscribes;
DROP POLICY IF EXISTS "Service role can insert webhook logs" ON public.webhook_logs;

-- 2. Reviews: add masked display_email and drop raw user_email
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS display_email TEXT;

UPDATE public.reviews
SET display_email = CASE
  WHEN user_email IS NULL OR position('@' in user_email) = 0 THEN 'anonymous'
  ELSE
    CASE
      WHEN length(split_part(user_email,'@',1)) <= 2
        THEN left(split_part(user_email,'@',1),1) || '***@' || split_part(user_email,'@',2)
      ELSE left(split_part(user_email,'@',1),2) || '***@' || split_part(user_email,'@',2)
    END
END
WHERE display_email IS NULL;

ALTER TABLE public.reviews DROP COLUMN IF EXISTS user_email;
ALTER TABLE public.reviews ALTER COLUMN display_email SET NOT NULL;

-- 3. Block self-escalation of privileged profile fields
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.email_credits      IS DISTINCT FROM OLD.email_credits      THEN NEW.email_credits      := OLD.email_credits;      END IF;
  IF NEW.daily_send_limit   IS DISTINCT FROM OLD.daily_send_limit   THEN NEW.daily_send_limit   := OLD.daily_send_limit;   END IF;
  IF NEW.hourly_send_limit  IS DISTINCT FROM OLD.hourly_send_limit  THEN NEW.hourly_send_limit  := OLD.hourly_send_limit;  END IF;
  IF NEW.is_approved        IS DISTINCT FROM OLD.is_approved        THEN NEW.is_approved        := OLD.is_approved;        END IF;
  IF NEW.tier               IS DISTINCT FROM OLD.tier               THEN NEW.tier               := OLD.tier;               END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 4. Restrict SECURITY DEFINER functions from anonymous callers
REVOKE EXECUTE ON FUNCTION public.get_master_directory_categories() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_integration_token(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reserve_smtp_quota(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pick_available_smtp(uuid[], uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_master_directory_categories() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_integration_token(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_smtp_quota(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.pick_available_smtp(uuid[], uuid) TO service_role;
