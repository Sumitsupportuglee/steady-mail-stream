import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const emailQueueId = url.searchParams.get('id')
    const originalUrl = url.searchParams.get('url')

    if (!emailQueueId || !originalUrl) {
      return new Response('Missing parameters', { status: 400, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the email queue item to find campaign and user
    const { data: queueItem, error: queueError } = await supabase
      .from('email_queue')
      .select('campaign_id, user_id')
      .eq('id', emailQueueId)
      .single()

    if (queueError || !queueItem) {
      console.error('Queue item not found:', emailQueueId)
      // Still redirect even if tracking fails
      return Response.redirect(originalUrl, 302)
    }

    // Extract request info
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Record the click
    await supabase.from('email_clicks').insert({
      email_queue_id: emailQueueId,
      campaign_id: queueItem.campaign_id,
      user_id: queueItem.user_id,
      original_url: originalUrl,
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    // Redirect to original URL
    return Response.redirect(originalUrl, 302)
  } catch (error: any) {
    console.error('Track click error:', error)
    
    // Try to extract URL and redirect anyway
    const url = new URL(req.url)
    const originalUrl = url.searchParams.get('url')
    
    if (originalUrl) {
      return Response.redirect(originalUrl, 302)
    }
    
    return new Response('Error processing click', { status: 500, headers: corsHeaders })
  }
})
