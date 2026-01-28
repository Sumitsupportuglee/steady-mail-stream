-- Allow service role to insert into tracking tables (for edge functions)
-- Drop existing policies and recreate with proper access

DROP POLICY IF EXISTS "Users can insert email opens" ON public.email_opens;
DROP POLICY IF EXISTS "Users can insert email clicks" ON public.email_clicks;

-- Allow service role full access for tracking inserts (via edge functions)
CREATE POLICY "Service role can insert email opens"
  ON public.email_opens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can insert email clicks"
  ON public.email_clicks FOR INSERT
  WITH CHECK (true);

-- Allow service role to update email_queue (for process-queue edge function)
CREATE POLICY "Service role can update email queue"
  ON public.email_queue FOR UPDATE
  USING (true);

-- Allow service role to update campaigns status
CREATE POLICY "Service role can update campaigns"
  ON public.campaigns FOR UPDATE
  USING (true);