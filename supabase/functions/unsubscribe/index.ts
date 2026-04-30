import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hmacToken(emailQueueId: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(emailQueueId))
  const bytes = new Uint8Array(sig)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex.slice(0, 32) // short token, sufficient with HMAC-SHA256
}

function htmlPage(title: string, message: string, ok = true): Response {
  const color = ok ? '#16a34a' : '#dc2626'
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
  body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;max-width:480px;width:100%;border-radius:16px;padding:40px;box-shadow:0 10px 30px rgba(0,0,0,.06);text-align:center}
  .ico{width:56px;height:56px;border-radius:50%;background:${color}1a;color:${color};display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:16px}
  h1{font-size:22px;margin:0 0 8px}
  p{color:#475569;line-height:1.5;margin:0}
</style></head><body><div class="card"><div class="ico">${ok ? '✓' : '!'}</div><h1>${title}</h1><p>${message}</p></div></body></html>`
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders,
    },
  })
}

function wantsJson(req: Request): boolean {
  const accept = req.headers.get('accept') || ''
  return accept.includes('application/json')
}

function result(req: Request, title: string, message: string, ok = true): Response {
  if (!wantsJson(req)) return htmlPage(title, message, ok)
  return new Response(JSON.stringify({ ok, title, message }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

async function processUnsubscribe(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const emailQueueId = url.searchParams.get('id')
  const token = url.searchParams.get('token')

  if (!emailQueueId || !token) {
    return result(req, 'Invalid link', 'This unsubscribe link is missing required information.', false)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const expected = await hmacToken(emailQueueId, serviceKey)
  if (expected !== token) {
    return result(req, 'Invalid link', 'This unsubscribe link is invalid or has been tampered with.', false)
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const { data: queueItem } = await supabase
    .from('email_queue')
    .select('id, user_id, to_email, campaign_id, contact_id')
    .eq('id', emailQueueId)
    .single()

  if (!queueItem) {
    return result(req, 'Already unsubscribed', 'We could not find this email, but you will not receive further messages.', true)
  }

  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
  const userAgent = req.headers.get('user-agent') || 'unknown'

  // Idempotent insert
  await supabase.from('email_unsubscribes').insert({
    user_id: queueItem.user_id,
    email: queueItem.to_email.toLowerCase(),
    contact_id: queueItem.contact_id,
    campaign_id: queueItem.campaign_id,
    email_queue_id: queueItem.id,
    ip_address: ipAddress,
    user_agent: userAgent,
  })

  return result(
    req,
    'You have been unsubscribed',
    `We have removed <strong>${queueItem.to_email}</strong> from this sender's mailing list. You will not receive further emails from this campaign.`,
    true
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  try {
    // Both GET (link click) and POST (RFC 8058 one-click) are accepted.
    return await processUnsubscribe(req)
  } catch (err) {
    console.error('unsubscribe error:', err)
    return htmlPage('Something went wrong', 'Please try again later or contact the sender directly.', false)
  }
})
