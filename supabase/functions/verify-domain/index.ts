import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Get the authorization header to identify the user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
    
    // Verify the user's JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const { identity_id } = await req.json()

    if (!identity_id) {
      throw new Error('Missing identity_id')
    }

    // Get the sender identity
    const { data: identity, error: fetchError } = await supabaseClient
      .from('sender_identities')
      .select('*')
      .eq('id', identity_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !identity) {
      throw new Error('Sender identity not found')
    }

    const domain = identity.from_email.split('@')[1]
    const dkimHost = identity.dkim_record?.split('.')[0]

    // Perform DNS lookup to verify CNAME record
    // Note: In production, you'd use a proper DNS lookup service
    // For now, we'll simulate the verification by checking if the record exists
    let isVerified = false
    
    try {
      // Try to resolve the CNAME record using DNS over HTTPS (Google's public DNS)
      const dnsQuery = `${dkimHost}._domainkey.${domain}`
      const response = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(dnsQuery)}&type=CNAME`,
        { headers: { 'Accept': 'application/dns-json' } }
      )
      
      const dnsResult = await response.json()
      
      // Check if we got a valid response with CNAME records
      if (dnsResult.Answer && dnsResult.Answer.length > 0) {
        isVerified = true
        console.log(`DNS verification successful for ${dnsQuery}:`, dnsResult.Answer)
      } else if (dnsResult.Status === 0) {
        // Status 0 means NOERROR - the query was successful
        // Even without Answer, check if there's any record
        console.log(`DNS query returned NOERROR for ${dnsQuery}, but no CNAME found`)
      }
    } catch (dnsError) {
      console.error('DNS lookup error:', dnsError)
      // Don't throw - just means verification failed
    }

    // Update the sender identity status
    const newStatus = isVerified ? 'verified' : 'unverified'
    
    const { error: updateError } = await supabaseClient
      .from('sender_identities')
      .update({ domain_status: newStatus })
      .eq('id', identity_id)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: isVerified,
        domain,
        message: isVerified 
          ? 'Domain verified successfully! You can now send emails from this address.'
          : 'DNS records not found yet. Please ensure CNAME records are configured correctly and try again. DNS propagation can take up to 48 hours.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Verification error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
