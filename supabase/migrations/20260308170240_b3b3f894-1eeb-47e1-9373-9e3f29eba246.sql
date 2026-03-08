
-- Master business directory: aggregates ALL scraped leads across all users, admin-only access
CREATE TABLE public.master_business_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributed_by UUID NOT NULL,
  business_name TEXT,
  website TEXT,
  emails TEXT[] NOT NULL DEFAULT '{}',
  phones TEXT[] NOT NULL DEFAULT '{}',
  address TEXT,
  source_url TEXT,
  search_query TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.master_business_directory ENABLE ROW LEVEL SECURITY;

-- Only admins can view the master directory
CREATE POLICY "Admins can view master directory" ON public.master_business_directory
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete from master directory
CREATE POLICY "Admins can delete from master directory" ON public.master_business_directory
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Any authenticated user can insert (via trigger/app code when they search)
CREATE POLICY "Authenticated users can insert to master directory" ON public.master_business_directory
  FOR INSERT WITH CHECK (auth.uid() = contributed_by);

CREATE INDEX idx_master_directory_name ON public.master_business_directory(business_name);
CREATE INDEX idx_master_directory_created ON public.master_business_directory(created_at DESC);
