
ALTER TABLE public.profiles
ADD COLUMN smtp_host text DEFAULT NULL,
ADD COLUMN smtp_port integer DEFAULT NULL,
ADD COLUMN smtp_username text DEFAULT NULL,
ADD COLUMN smtp_password text DEFAULT NULL,
ADD COLUMN smtp_encryption text DEFAULT 'tls' CHECK (smtp_encryption IN ('ssl', 'tls'));
