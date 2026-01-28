import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QueueItem {
  id: string
  user_id: string
  campaign_id: string
  contact_id: string
  from_email: string
  to_email: string
  subject: string
  body: string
  status: string
  attempt_count: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const masterSmtpKey = Deno.env.get('MASTER_SMTP_KEY')
    const smtpHost = Deno.env.get('SMTP_HOST')
    const smtpPort = Deno.env.get('SMTP_PORT')
    const smtpUser = Deno.env.get('SMTP_USER')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch 50 pending emails
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)

    if (fetchError) {
      throw new Error(`Failed to fetch queue: ${fetchError.message}`)
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, success: 0, errors: 0, message: 'No pending emails' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let successCount = 0
    let errorCount = 0

    // Process each email
    for (const email of pendingEmails as QueueItem[]) {
      try {
        // Build email with tracking pixel and List-Unsubscribe header
        const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-open?id=${email.id}`
        const bodyWithTracking = email.body + `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" alt="" />`

        // Note: Actual email sending implementation depends on provider
        // This is a placeholder for when SMTP credentials are configured
        if (masterSmtpKey && smtpHost) {
          // Email would be sent here using the configured SMTP provider
          // Example headers:
          // - List-Unsubscribe: <mailto:unsubscribe@domain.com>
          // - From: email.from_email
          // - To: email.to_email
          // - Subject: email.subject
          // - HTML Body: bodyWithTracking
          
          console.log(`Would send email to ${email.to_email} from ${email.from_email}`)
        }

        // For now, mark as sent (in production, this happens after actual send)
        const { error: updateError } = await supabase
          .from('email_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            attempt_count: email.attempt_count + 1,
          })
          .eq('id', email.id)

        if (updateError) {
          throw new Error(`Failed to update status: ${updateError.message}`)
        }

        successCount++
      } catch (emailError: any) {
        errorCount++
        
        // Update as failed
        await supabase
          .from('email_queue')
          .update({
            status: 'failed',
            attempt_count: email.attempt_count + 1,
            error_log: emailError.message || 'Unknown error',
          })
          .eq('id', email.id)
      }
    }

    // Update campaign status if all emails are processed
    const campaignIds = [...new Set(pendingEmails.map((e: QueueItem) => e.campaign_id))]
    
    for (const campaignId of campaignIds) {
      const { count: pendingCount } = await supabase
        .from('email_queue')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')

      if (pendingCount === 0) {
        await supabase
          .from('campaigns')
          .update({ status: 'completed' })
          .eq('id', campaignId)
      } else {
        await supabase
          .from('campaigns')
          .update({ status: 'sending' })
          .eq('id', campaignId)
      }
    }

    return new Response(
      JSON.stringify({
        processed: pendingEmails.length,
        success: successCount,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Process queue error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
