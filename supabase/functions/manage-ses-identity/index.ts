import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)
  
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

async function verifySesEmail(
  email: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string
): Promise<{ success: boolean; message: string }> {
  const endpoint = `https://email.${region}.amazonaws.com/`
  
  const params = new URLSearchParams()
  params.append('Action', 'VerifyEmailIdentity')
  params.append('EmailAddress', email)
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
      const errorMatch = responseText.match(/<Message>(.*?)<\/Message>/s)
      const errorMessage = errorMatch ? errorMatch[1] : `SES Error ${response.status}`
      return { success: false, message: errorMessage }
    }
    
    return { success: true, message: `Verification email sent to ${email}` }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, message: errorMessage }
  }
}

async function listSesIdentities(
  accessKeyId: string,
  secretAccessKey: string,
  region: string
): Promise<{ success: boolean; identities?: string[]; message?: string }> {
  const endpoint = `https://email.${region}.amazonaws.com/`
  
  const params = new URLSearchParams()
  params.append('Action', 'ListIdentities')
  params.append('IdentityType', 'EmailAddress')
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
      return { success: false, message: `SES Error ${response.status}` }
    }
    
    // Parse identities from XML
    const identityMatches = responseText.matchAll(/<member>(.*?)<\/member>/g)
    const identities: string[] = []
    for (const match of identityMatches) {
      identities.push(match[1])
    }
    
    return { success: true, identities }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, message: errorMessage }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')
    const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')
    const awsRegion = Deno.env.get('AWS_SES_REGION') || 'us-east-1'

    if (!awsAccessKeyId || !awsSecretAccessKey) {
      throw new Error('Missing AWS credentials')
    }

    // Verify admin access
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    })

    if (!isAdmin) {
      throw new Error('Admin access required')
    }

    const { action, email } = await req.json()

    let result: { success: boolean; message?: string; identities?: string[] }

    switch (action) {
      case 'add':
      case 'verify':
        if (!email) {
          throw new Error('Email is required')
        }
        result = await verifySesEmail(email, awsAccessKeyId, awsSecretAccessKey, awsRegion)
        break
      
      case 'list':
        result = await listSesIdentities(awsAccessKeyId, awsSecretAccessKey, awsRegion)
        break
      
      default:
        throw new Error('Invalid action. Use: add, verify, or list')
    }

    if (!result.success) {
      throw new Error(result.message || 'Operation failed')
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
