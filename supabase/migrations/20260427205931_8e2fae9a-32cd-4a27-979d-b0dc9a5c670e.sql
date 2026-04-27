ALTER TABLE public.sender_identities
  ADD COLUMN IF NOT EXISTS spf_status text NOT NULL DEFAULT 'not_set',
  ADD COLUMN IF NOT EXISTS dmarc_status text NOT NULL DEFAULT 'not_set',
  ADD COLUMN IF NOT EXISTS spf_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS dmarc_verified_at timestamptz;