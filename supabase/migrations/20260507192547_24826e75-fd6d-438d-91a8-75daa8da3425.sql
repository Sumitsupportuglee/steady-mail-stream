
CREATE TABLE public.contact_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX contact_categories_user_name_unique
  ON public.contact_categories (user_id, COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

ALTER TABLE public.contact_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own categories" ON public.contact_categories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own categories" ON public.contact_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own categories" ON public.contact_categories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own categories" ON public.contact_categories
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_contact_categories_updated_at
  BEFORE UPDATE ON public.contact_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contacts ADD COLUMN category_id UUID;
CREATE INDEX idx_contacts_category_id ON public.contacts(category_id);
