
-- Per-SMTP-account quotas and counters
ALTER TABLE public.smtp_accounts
  ADD COLUMN IF NOT EXISTS daily_send_limit integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS hourly_send_limit integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS emails_sent_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emails_sent_this_hour integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_daily_reset timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_hourly_reset timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Campaign-level rotation pool (null = legacy single-account behavior)
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS smtp_rotation_pool uuid[] DEFAULT NULL;

-- Per-email scheduling for smoothing bursts across the pool
ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_email_queue_pending_scheduled
  ON public.email_queue (status, scheduled_for)
  WHERE status = 'pending';

-- Atomically reserve quota on an SMTP account.
-- Resets counters when a window has rolled over.
-- Returns true if quota was reserved (caller should send), false otherwise.
CREATE OR REPLACE FUNCTION public.reserve_smtp_quota(_smtp_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean := false;
BEGIN
  UPDATE public.smtp_accounts
     SET
       emails_sent_today = CASE
         WHEN last_daily_reset < (now() - interval '1 day') THEN 1
         ELSE emails_sent_today + 1
       END,
       last_daily_reset = CASE
         WHEN last_daily_reset < (now() - interval '1 day') THEN now()
         ELSE last_daily_reset
       END,
       emails_sent_this_hour = CASE
         WHEN last_hourly_reset < (now() - interval '1 hour') THEN 1
         ELSE emails_sent_this_hour + 1
       END,
       last_hourly_reset = CASE
         WHEN last_hourly_reset < (now() - interval '1 hour') THEN now()
         ELSE last_hourly_reset
       END
   WHERE id = _smtp_id
     AND is_active = true
     AND (
       (last_daily_reset < (now() - interval '1 day')) OR (emails_sent_today < daily_send_limit)
     )
     AND (
       (last_hourly_reset < (now() - interval '1 hour')) OR (emails_sent_this_hour < hourly_send_limit)
     );

  GET DIAGNOSTICS _ok = ROW_COUNT;
  RETURN _ok;
END;
$$;

-- Pick the next account in a pool that has quota right now.
-- Returns NULL if every account is exhausted.
CREATE OR REPLACE FUNCTION public.pick_available_smtp(_pool uuid[], _user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.smtp_accounts
  WHERE user_id = _user_id
    AND is_active = true
    AND id = ANY(_pool)
    AND (
      last_daily_reset < (now() - interval '1 day')
      OR emails_sent_today < daily_send_limit
    )
    AND (
      last_hourly_reset < (now() - interval '1 hour')
      OR emails_sent_this_hour < hourly_send_limit
    )
  ORDER BY
    -- prefer accounts with most remaining hourly headroom
    (hourly_send_limit - emails_sent_this_hour) DESC,
    (daily_send_limit - emails_sent_today) DESC,
    random()
  LIMIT 1;
$$;
