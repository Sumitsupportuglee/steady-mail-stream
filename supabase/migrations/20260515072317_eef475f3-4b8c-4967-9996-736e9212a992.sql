ALTER TABLE public.email_queue
  ADD COLUMN IF NOT EXISTS sender_identity_id uuid REFERENCES public.sender_identities(id) ON DELETE SET NULL;