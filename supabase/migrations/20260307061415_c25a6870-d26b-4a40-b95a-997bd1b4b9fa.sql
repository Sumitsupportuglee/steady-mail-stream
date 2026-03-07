
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews (public landing page)
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);

-- Authenticated users can insert their own review
CREATE POLICY "Users can create their own review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own review
CREATE POLICY "Users can update their own review" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Users can delete their own review
CREATE POLICY "Users can delete their own review" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);
