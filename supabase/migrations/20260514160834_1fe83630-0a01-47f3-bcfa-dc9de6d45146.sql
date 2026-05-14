ALTER TABLE public.smtp_accounts
  ADD COLUMN IF NOT EXISTS sender_identity_id uuid
  REFERENCES public.sender_identities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_smtp_accounts_sender_identity_id
  ON public.smtp_accounts(sender_identity_id);

-- Backfill: link by matching smtp_username to sender_identities.from_email within same user
UPDATE public.smtp_accounts s
SET sender_identity_id = si.id
FROM public.sender_identities si
WHERE s.sender_identity_id IS NULL
  AND si.user_id = s.user_id
  AND lower(si.from_email) = lower(s.smtp_username);