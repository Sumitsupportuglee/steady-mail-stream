import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { SESClient, SendEmailCommand } from 'https://esm.sh/@aws-sdk/client-ses@3.712.0'

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
    
    // AWS SES Configuration
    const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')
    const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')
    const awsRegion = Deno.env.get('AWS_SES_REGION') || 'us-east-1'

    if (!awsAccessKeyId || !awsSecretAccessKey) {
      throw new Error('AWS credentials not configured')
    }

    const sesClient = new SESClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    })

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
        // Build email with tracking pixel
        const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-open?id=${email.id}`
        const bodyWithTracking = email.body + `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" alt="" />`

        // Rewrite links for click tracking
        const bodyWithClickTracking = rewriteLinksForTracking(bodyWithTracking, email.id, supabaseUrl)

        // Send email via AWS SES
        const sendCommand = new SendEmailCommand({
          Source: email.from_email,
          Destination: {
            ToAddresses: [email.to_email],
          },
          Message: {
            Subject: {
              Data: email.subject,
              Charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: bodyWithClickTracking,
                Charset: 'UTF-8',
              },
            },
          },
          // List-Unsubscribe header for compliance
          Tags: [
            {
              Name: 'campaign_id',
              Value: email.campaign_id,
            },
          ],
        })

        await sesClient.send(sendCommand)

        // Mark as sent
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
        console.log(`Email sent successfully to ${email.to_email}`)
      } catch (emailError: any) {
        errorCount++
        console.error(`Failed to send email to ${email.to_email}:`, emailError.message)
        
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

// Helper function to rewrite links for click tracking
function rewriteLinksForTracking(html: string, emailQueueId: string, supabaseUrl: string): string {
  // Match href attributes in anchor tags
  const linkRegex = /<a\s+([^>]*href=["'])([^"']+)(["'][^>]*)>/gi
  
  return html.replace(linkRegex, (match, before, url, after) => {
    // Skip tracking pixel and mailto links
    if (url.includes('track-open') || url.includes('track-click') || url.startsWith('mailto:')) {
      return match
    }
    
    const trackingUrl = `${supabaseUrl}/functions/v1/track-click?id=${emailQueueId}&url=${encodeURIComponent(url)}`
    return `<a ${before}${trackingUrl}${after}>`
  })
}
