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

// Helper functions for AWS Signature Version 4
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmacSha256(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const keyData = typeof key === 'string' ? encoder.encode(key) : key
  const messageData = encoder.encode(message)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  return await crypto.subtle.sign('HMAC', cryptoKey, messageData)
}

async function hmacSha256Hex(key: ArrayBuffer, message: string): Promise<string> {
  const result = await hmacSha256(key, message)
  return Array.from(new Uint8Array(result))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// AWS Signature Version 4 signing
async function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  service: string
): Promise<Record<string, string>> {
  const parsedUrl = new URL(url)
  const host = parsedUrl.host
  const path = parsedUrl.pathname
  
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  
  // Create canonical request
  const canonicalHeaders = `content-type:${headers['Content-Type']}\nhost:${host}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'content-type;host;x-amz-date'
  
  const bodyHash = await sha256(body)
  const canonicalRequest = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${bodyHash}`
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const canonicalRequestHash = await sha256(canonicalRequest)
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`
  
  // Calculate signature using AWS4 signing key derivation
  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  const kSigning = await hmacSha256(kService, 'aws4_request')
  const signature = await hmacSha256Hex(kSigning, stringToSign)
  
  // Create authorization header
  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  
  return {
    ...headers,
    'Host': host,
    'X-Amz-Date': amzDate,
    'Authorization': authorizationHeader,
  }
}

async function sendEmailViaSES(
  from: string,
  to: string,
  subject: string,
  htmlBody: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const endpoint = `https://email.${region}.amazonaws.com/`
  
  // Build SES API request body
  const params = new URLSearchParams()
  params.append('Action', 'SendEmail')
  params.append('Source', from)
  params.append('Destination.ToAddresses.member.1', to)
  params.append('Message.Subject.Data', subject)
  params.append('Message.Subject.Charset', 'UTF-8')
  params.append('Message.Body.Html.Data', htmlBody)
  params.append('Message.Body.Html.Charset', 'UTF-8')
  params.append('Version', '2010-12-01')
  
  const body = params.toString()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  
  const signedHeaders = await signRequest(
    'POST',
    endpoint,
    headers,
    body,
    accessKeyId,
    secretAccessKey,
    region,
    'ses'
  )
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: signedHeaders,
      body: body,
    })
    
    const responseText = await response.text()
    
    if (!response.ok) {
      console.error('SES Error Response:', responseText)
      // Extract error message from XML
      const errorMatch = responseText.match(/<Message>(.*?)<\/Message>/s)
      const errorMessage = errorMatch ? errorMatch[1] : responseText
      return { success: false, error: errorMessage }
    }
    
    // Extract MessageId from successful response
    const messageIdMatch = responseText.match(/<MessageId>(.*?)<\/MessageId>/)
    const messageId = messageIdMatch ? messageIdMatch[1] : undefined
    
    return { success: true, messageId }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: errorMessage }
  }
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

    console.log(`Processing ${pendingEmails.length} pending emails`)

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
        const result = await sendEmailViaSES(
          email.from_email,
          email.to_email,
          email.subject,
          bodyWithClickTracking,
          awsAccessKeyId,
          awsSecretAccessKey,
          awsRegion
        )

        if (result.success) {
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
          console.log(`Email sent successfully to ${email.to_email}, MessageId: ${result.messageId}`)
        } else {
          throw new Error(result.error || 'Unknown SES error')
        }
      } catch (emailError: unknown) {
        errorCount++
        const errorMessage = emailError instanceof Error ? emailError.message : 'Unknown error'
        console.error(`Failed to send email to ${email.to_email}:`, errorMessage)
        
        // Update as failed
        await supabase
          .from('email_queue')
          .update({
            status: 'failed',
            attempt_count: email.attempt_count + 1,
            error_log: errorMessage,
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Process queue error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
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
