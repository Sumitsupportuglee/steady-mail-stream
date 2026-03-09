
DROP POLICY IF EXISTS "Anyone can view app updates" ON public.app_updates;
CREATE POLICY "Anyone can view app updates"
  ON public.app_updates
  FOR SELECT
  USING (true);
