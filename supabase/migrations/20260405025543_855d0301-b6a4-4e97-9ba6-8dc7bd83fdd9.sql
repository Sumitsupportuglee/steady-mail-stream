
CREATE TABLE public.smtp_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  label TEXT NOT NULL DEFAULT 'Default',
  provider TEXT NOT NULL DEFAULT 'custom',
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_username TEXT NOT NULL,
  smtp_password TEXT NOT NULL,
  smtp_encryption TEXT NOT NULL DEFAULT 'tls',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.smtp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own smtp accounts" ON public.smtp_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own smtp accounts" ON public.smtp_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own smtp accounts" ON public.smtp_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own smtp accounts" ON public.smtp_accounts FOR DELETE USING (auth.uid() = user_id);

-- Migrate existing SMTP from profiles to smtp_accounts
INSERT INTO public.smtp_accounts (user_id, label, smtp_host, smtp_port, smtp_username, smtp_password, smtp_encryption, is_default)
SELECT id, 'Default', smtp_host, COALESCE(smtp_port, 587), smtp_username, smtp_password, COALESCE(smtp_encryption, 'tls'), true
FROM public.profiles
WHERE smtp_host IS NOT NULL AND smtp_username IS NOT NULL AND smtp_password IS NOT NULL;
