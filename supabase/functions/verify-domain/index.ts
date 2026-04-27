import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type RecordType = 'dkim' | 'spf' | 'dmarc'

async function dnsLookup(name: string, type: 'CNAME' | 'TXT'): Promise<string[]> {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { 'Accept': 'application/dns-json' } }
    )
    const json = await res.json()
    if (!json.Answer) return []
    return json.Answer
      .map((a: any) => String(a.data || ''))
      .map((s: string) => s.replace(/^"|"$/g, '').replace(/"\s+"/g, ''))
  } catch (e) {
    console.error('DNS lookup error', name, type, e)
    return []
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) throw new Error('Unauthorized')

    const body = await req.json()
    const { identity_id } = body
    const recordType: RecordType = (body.record_type as RecordType) || 'dkim'

    if (!identity_id) throw new Error('Missing identity_id')

    const { data: identity, error: fetchError } = await supabaseClient
      .from('sender_identities')
      .select('*')
      .eq('id', identity_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !identity) throw new Error('Sender identity not found')

    const domain = identity.from_email.split('@')[1]
    let isVerified = false
    let message = ''

    if (recordType === 'dkim') {
      const dkimHost = identity.dkim_record?.split('.')[0]
      if (!dkimHost) throw new Error('No DKIM record configured')
      const dnsQuery = `${dkimHost}._domainkey.${domain}`
      const records = await dnsLookup(dnsQuery, 'CNAME')
      isVerified = records.length > 0
      message = isVerified
        ? 'DKIM verified successfully!'
        : 'DKIM CNAME record not found. DNS propagation can take up to 48 hours.'

      await supabaseClient
        .from('sender_identities')
        .update({ domain_status: isVerified ? 'verified' : 'unverified' })
        .eq('id', identity_id)
    } else if (recordType === 'spf') {
      const records = await dnsLookup(domain, 'TXT')
      const spfRecord = records.find(r => r.toLowerCase().startsWith('v=spf1'))
      // Accept any valid SPF record (may include amazonses, sendgrid, _spf.google.com etc.)
      isVerified = !!spfRecord
      message = isVerified
        ? `SPF verified: ${spfRecord}`
        : 'SPF TXT record not found at root domain. Add it and try again.'

      await supabaseClient
        .from('sender_identities')
        .update({
          spf_status: isVerified ? 'verified' : 'failed',
          spf_verified_at: isVerified ? new Date().toISOString() : null,
        })
        .eq('id', identity_id)
    } else if (recordType === 'dmarc') {
      const records = await dnsLookup(`_dmarc.${domain}`, 'TXT')
      const dmarcRecord = records.find(r => r.toLowerCase().startsWith('v=dmarc1'))
      isVerified = !!dmarcRecord
      message = isVerified
        ? `DMARC verified: ${dmarcRecord}`
        : 'DMARC TXT record not found at _dmarc subdomain. Add it and try again.'

      await supabaseClient
        .from('sender_identities')
        .update({
          dmarc_status: isVerified ? 'verified' : 'failed',
          dmarc_verified_at: isVerified ? new Date().toISOString() : null,
        })
        .eq('id', identity_id)
    } else {
      throw new Error('Invalid record_type. Use dkim, spf, or dmarc.')
    }

    return new Response(
      JSON.stringify({ success: true, verified: isVerified, record_type: recordType, domain, message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('Verification error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
