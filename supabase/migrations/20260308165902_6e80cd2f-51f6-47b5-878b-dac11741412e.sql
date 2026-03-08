
-- Table to log every search a user performs
CREATE TABLE public.lead_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'search',
  lead_limit INTEGER NOT NULL DEFAULT 5,
  results_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own searches" ON public.lead_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own searches" ON public.lead_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own searches" ON public.lead_searches FOR DELETE USING (auth.uid() = user_id);

-- Business directory table storing every scraped lead
CREATE TABLE public.business_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  search_id UUID REFERENCES public.lead_searches(id) ON DELETE SET NULL,
  business_name TEXT,
  website TEXT,
  emails TEXT[] NOT NULL DEFAULT '{}',
  phones TEXT[] NOT NULL DEFAULT '{}',
  address TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own directory" ON public.business_directory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own entries" ON public.business_directory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own entries" ON public.business_directory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own entries" ON public.business_directory FOR DELETE USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_business_directory_user ON public.business_directory(user_id);
CREATE INDEX idx_business_directory_search ON public.business_directory(search_id);
CREATE INDEX idx_lead_searches_user ON public.lead_searches(user_id);
