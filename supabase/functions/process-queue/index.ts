import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QueueItem {
  id: string
  from_email: string
  to_email: string
  subject: string
  body: string
  status: string
  attempt_count: number
}

// --- AWS SIGNATURE V4 HELPERS (Pure Web Crypto - No FS) ---

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
  // AWS Format: YYYYMMDD'T'HHMMSS'Z'
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  
  // Canonical Headers must be sorted by name and values trimmed
  const canonicalHeaders = `content-type:${headers['Content-Type'].trim()}\nhost:${host}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'content-type;host;x-amz-date'
  
  const bodyHash = await sha256(body)
  const canonicalRequest = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${bodyHash}`
  
  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const canonicalRequestHash = await sha256(canonicalRequest)
  const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${canonicalRequestHash}`
  
  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  const kSigning = await hmacSha256(kService, 'aws4_request')
  const signature = await hmacSha256Hex(kSigning, stringToSign)
  
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
  
  const params = new URLSearchParams()
  params.append('Action', 'SendEmail')
  params.append('Source', from)
  params.append('Destination.ToAddresses.member.1', to)
  params.append('Message.Subject.Data', subject)
  params.append('Message.Subject.Charset', 'UTF-8')
  params.append('Message.Body.Html.Data', htmlBody)
  params.append('Message.Body.Html.Charset', 'UTF-8')
  params.append('Version', '2010-12-01')

  // Robust Domain Extraction for Unsubscribe Header
  // Handles "Bob <bob@mail.com>" and "bob@mail.com"
  const emailMatch = from.match(/<(.+)>/) || [null, from]
  const cleanEmail = emailMatch[1] || from
  const domain = cleanEmail.split('@')[1]

  if (domain) {
    params.append('Message.Headers.member.1.Name', 'List-Unsubscribe')
    params.append('Message.Headers.member.1.Value', `<mailto:unsubscribe@${domain}>`)
  }
  
  const body = params.toString()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  
  // Sign the request
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
      // Extract XML error message
      const errorMatch = responseText.match(/<Message>(.*?)<\/Message>/s)
      const errorMessage = errorMatch ? errorMatch[1] : `SES Error ${response.status}: ${responseText}`
      return { success: false, error: errorMessage }
    }
    
    const messageIdMatch = responseText.match(/<MessageId>(.*?)<\/MessageId>/)
    const messageId = messageIdMatch ? messageIdMatch[1] : undefined
    
    return { success: true, messageId }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error'
    return { success: false, error: errorMessage }
  }
}

// --- MAIN EXECUTION ---

Deno.serve(async (req) => {
  // 1. Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Setup Config
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // AWS SES Secrets (Required)
    const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')
    const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')
    const awsRegion = Deno.env.get('AWS_SES_REGION') || 'us-east-1'

    // 3. Safety Check: Are secrets present?
    if (!awsAccessKeyId || !awsSecretAccessKey) {
      console.error('Missing AWS Secrets. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in Supabase Edge Function Secrets.')
      throw new Error('Server Configuration Error: Missing AWS Secrets')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 4. Fetch Batch of Pending Emails
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)

    if (fetchError) throw new Error(`DB Error: ${fetchError.message}`)

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending emails' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${pendingEmails.length} emails...`)

    let successCount = 0
    let errorCount = 0

    // 5. Send Loop
    for (const email of pendingEmails as QueueItem[]) {
      
      const result = await sendEmailViaSES(
        email.from_email,
        email.to_email,
        email.subject,
        email.body,
        awsAccessKeyId,
        awsSecretAccessKey,
        awsRegion
      )

      if (result.success) {
        await supabase
          .from('email_queue')
          .update({
            status: 'sent',
            attempt_count: (email.attempt_count || 0) + 1,
            // message_id: result.messageId // Uncomment if your table has this column
          })
          .eq('id', email.id)

        successCount++
      } else {
        errorCount++
        console.error(`Failed to send to ${email.to_email}: ${result.error}`)
        
        await supabase
          .from('email_queue')
          .update({
            status: 'failed',
            attempt_count: (email.attempt_count || 0) + 1,
            error_log: result.error, 
          })
          .eq('id', email.id)
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
    console.error('CRITICAL FUNCTION ERROR:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
