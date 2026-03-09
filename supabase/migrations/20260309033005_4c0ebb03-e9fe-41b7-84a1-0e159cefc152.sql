
CREATE TABLE public.app_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  version TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view app updates"
  ON public.app_updates
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can manage app updates"
  ON public.app_updates
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
