CREATE TABLE public.partnership_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  country TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.partnership_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit partnership inquiries"
ON public.partnership_inquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view partnership inquiries"
ON public.partnership_inquiries
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update partnership inquiries"
ON public.partnership_inquiries
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete partnership inquiries"
ON public.partnership_inquiries
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));