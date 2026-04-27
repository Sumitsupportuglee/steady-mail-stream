import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QueueItem {
  id: string
  campaign_id: string
  user_id: string
  from_email: string
  to_email: string
  subject: string
  body: string
  status: string
  attempt_count: number
  smtp_account_id: string | null
}

interface SmtpConfig {
  smtp_host: string
  smtp_port: number
  smtp_username: string
  smtp_password: string
  smtp_encryption: 'ssl' | 'tls'
}

// --- SMTP CLIENT (Raw TCP for Deno) ---

class SmtpClient {
  private conn: Deno.TcpConn | Deno.TlsConn | null = null
  private encoder = new TextEncoder()
  private decoder = new TextDecoder()

  async connect(config: SmtpConfig, maxRetries = 3): Promise<void> {
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this._tryConnect(config)
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        const isTransient = lastError.message.includes('4.3.0') || lastError.message.includes('454') || lastError.message.includes('Try again later')
        if (isTransient && attempt < maxRetries) {
          console.warn(`SMTP transient error (attempt ${attempt}/${maxRetries}): ${lastError.message}, retrying in ${attempt * 2}s...`)
          await new Promise(r => setTimeout(r, attempt * 2000))
          try { this.conn?.close() } catch { /* ignore */ }
          this.conn = null
          continue
        }
        throw lastError
      }
    }
    throw lastError!
  }

  private async _tryConnect(config: SmtpConfig): Promise<void> {
    if (config.smtp_encryption === 'ssl') {
      this.conn = await Deno.connectTls({
        hostname: config.smtp_host,
        port: config.smtp_port,
      })
      await this.readResponse()
    } else {
      const tcpConn = await Deno.connect({
        hostname: config.smtp_host,
        port: config.smtp_port,
      })
      this.conn = tcpConn
      await this.readResponse()

      await this.sendCommand(`EHLO localhost`)
      await this.readMultilineResponse()

      await this.sendCommand(`STARTTLS`)
      const tlsResp = await this.readResponse()
      if (!tlsResp.startsWith('220')) {
        throw new Error(`STARTTLS failed: ${tlsResp}`)
      }

      this.conn = await Deno.startTls(tcpConn, {
        hostname: config.smtp_host,
      })
    }

    await this.sendCommand(`EHLO localhost`)
    const ehloResp = await this.readMultilineResponse()

    const authLine = ehloResp.split('\n').find(l => l.toUpperCase().includes('AUTH'))
    const supportsPlain = authLine?.toUpperCase().includes('PLAIN') ?? false

    console.log(`SMTP AUTH methods available: ${authLine || 'none detected'}, using: ${supportsPlain ? 'PLAIN' : 'LOGIN'}`)

    if (supportsPlain) {
      const authPlainStr = `\0${config.smtp_username}\0${config.smtp_password}`
      const authPlainB64 = btoa(authPlainStr)
      await this.sendCommand(`AUTH PLAIN ${authPlainB64}`)
      const authResp = await this.readResponse()
      if (!authResp.startsWith('235')) {
        throw new Error(`AUTH PLAIN failed: ${authResp}`)
      }
    } else {
      await this.sendCommand(`AUTH LOGIN`)
      const authResp = await this.readResponse()
      if (!authResp.startsWith('334')) {
        throw new Error(`AUTH LOGIN initiation failed: ${authResp}`)
      }

      await this.sendCommand(btoa(config.smtp_username))
      const userResp = await this.readResponse()
      if (!userResp.startsWith('334')) {
        throw new Error(`Username rejected: ${userResp}`)
      }

      await this.sendCommand(btoa(config.smtp_password))
      const passResp = await this.readResponse()
      if (!passResp.startsWith('235')) {
        throw new Error(`Authentication failed: ${passResp}`)
      }
    }
  }

  async sendEmail(
    from: string,
    to: string,
    subject: string,
    htmlBody: string,
    fromName?: string,
    unsubscribeUrl?: string
  ): Promise<string> {
    const cleanFrom = from.match(/<(.+)>/)?.[1] || from
    const domain = cleanFrom.split('@')[1]

    await this.sendCommand(`MAIL FROM:<${cleanFrom}>`)
    const mailResp = await this.readResponse()
    if (!mailResp.startsWith('250')) throw new Error(`MAIL FROM failed: ${mailResp}`)

    await this.sendCommand(`RCPT TO:<${to}>`)
    const rcptResp = await this.readResponse()
    if (!rcptResp.startsWith('250')) throw new Error(`RCPT TO failed: ${rcptResp}`)

    await this.sendCommand(`DATA`)
    const dataResp = await this.readResponse()
    if (!dataResp.startsWith('354')) throw new Error(`DATA failed: ${dataResp}`)

    const messageId = `<${crypto.randomUUID()}@${domain}>`
    const date = new Date().toUTCString()
    const senderDisplay = fromName ? `${fromName} <${cleanFrom}>` : cleanFrom

    const listUnsub = unsubscribeUrl
      ? `<${unsubscribeUrl}>, <mailto:unsubscribe@${domain}>`
      : `<mailto:unsubscribe@${domain}>`

    const headers = [
      `From: ${senderDisplay}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Date: ${date}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      `List-Unsubscribe: ${listUnsub}`,
      ...(unsubscribeUrl ? [`List-Unsubscribe-Post: List-Unsubscribe=One-Click`] : []),
      `X-Mailer: SteadyMail/1.0`,
    ]

    const qpBody = htmlBody
      .replace(/\r\n/g, '\n')
      .replace(/\n/g, '\r\n')

    const emailContent = headers.join('\r\n') + '\r\n\r\n' + qpBody + '\r\n.'
    await this.sendCommand(emailContent)
    const sendResp = await this.readResponse()
    if (!sendResp.startsWith('250')) throw new Error(`Send failed: ${sendResp}`)

    return messageId
  }

  async close(): Promise<void> {
    try {
      await this.sendCommand('QUIT')
      await this.readResponse()
    } catch { /* ignore */ }
    try {
      this.conn?.close()
    } catch { /* ignore */ }
    this.conn = null
  }

  private async sendCommand(cmd: string): Promise<void> {
    if (!this.conn) throw new Error('Not connected')
    await this.conn.write(this.encoder.encode(cmd + '\r\n'))
  }

  private async readResponse(): Promise<string> {
    if (!this.conn) throw new Error('Not connected')
    const buf = new Uint8Array(4096)
    const n = await this.conn.read(buf)
    if (n === null) throw new Error('Connection closed')
    return this.decoder.decode(buf.subarray(0, n)).trim()
  }

  private async readMultilineResponse(): Promise<string> {
    let full = ''
    while (true) {
      const line = await this.readResponse()
      full += line + '\n'
      const lines = line.split('\n')
      const lastLine = lines[lines.length - 1]
      if (lastLine.length >= 4 && lastLine[3] === ' ') break
    }
    return full.trim()
  }
}

// --- PASSWORD HELPER (no encryption) ---

async function decryptPassword(plaintext: string): Promise<string> {
  return plaintext
}

// --- SMTP CONFIG RESOLVER ---

async function getSmtpConfig(
  supabase: any,
  smtpAccountId: string | null,
  userId: string
): Promise<SmtpConfig | null> {
  if (smtpAccountId) {
    const { data, error } = await supabase
      .from('smtp_accounts')
      .select('smtp_host, smtp_port, smtp_username, smtp_password, smtp_encryption')
      .eq('id', smtpAccountId)
      .single()

    if (!error && data?.smtp_host && data?.smtp_username && data?.smtp_password) {
      return {
        smtp_host: data.smtp_host,
        smtp_port: data.smtp_port || 587,
        smtp_username: data.smtp_username,
        smtp_password: await decryptPassword(data.smtp_password),
        smtp_encryption: data.smtp_encryption === 'ssl' ? 'ssl' : 'tls',
      }
    }
    console.warn(`SMTP account ${smtpAccountId} not found or incomplete, falling back`)
  }

  // Fallback: default SMTP account for this user
  const { data: defaultAcct } = await supabase
    .from('smtp_accounts')
    .select('smtp_host, smtp_port, smtp_username, smtp_password, smtp_encryption')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single()

  if (defaultAcct?.smtp_host && defaultAcct?.smtp_username && defaultAcct?.smtp_password) {
    return {
      smtp_host: defaultAcct.smtp_host,
      smtp_port: defaultAcct.smtp_port || 587,
      smtp_username: defaultAcct.smtp_username,
      smtp_password: await decryptPassword(defaultAcct.smtp_password),
      smtp_encryption: defaultAcct.smtp_encryption === 'ssl' ? 'ssl' : 'tls',
    }
  }

  // Last fallback: any SMTP account for the user
  const { data: anyAcct } = await supabase
    .from('smtp_accounts')
    .select('smtp_host, smtp_port, smtp_username, smtp_password, smtp_encryption')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (anyAcct?.smtp_host && anyAcct?.smtp_username && anyAcct?.smtp_password) {
    return {
      smtp_host: anyAcct.smtp_host,
      smtp_port: anyAcct.smtp_port || 587,
      smtp_username: anyAcct.smtp_username,
      smtp_password: await decryptPassword(anyAcct.smtp_password),
      smtp_encryption: anyAcct.smtp_encryption === 'ssl' ? 'ssl' : 'tls',
    }
  }

  // Legacy fallback: profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('smtp_host, smtp_port, smtp_username, smtp_password, smtp_encryption')
    .eq('id', userId)
    .single()

  if (profile?.smtp_host && profile?.smtp_username && profile?.smtp_password) {
    return {
      smtp_host: profile.smtp_host,
      smtp_port: profile.smtp_port || 587,
      smtp_username: profile.smtp_username,
      smtp_password: await decryptPassword(profile.smtp_password),
      smtp_encryption: profile.smtp_encryption === 'ssl' ? 'ssl' : 'tls',
    }
  }

  return null
}

// --- CAMPAIGN STATUS UPDATE ---

async function updateCampaignStatuses(
  supabase: any,
  campaignIds: string[]
): Promise<void> {
  for (const campaignId of campaignIds) {
    const { count: pendingCount } = await supabase
      .from('email_queue')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')

    const { count: sentCount } = await supabase
      .from('email_queue')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'sent')

    const pending = pendingCount ?? 0
    const sent = sentCount ?? 0

    let newStatus: string
    if (pending > 0) {
      newStatus = 'sending'
    } else if (sent > 0) {
      newStatus = 'completed'
    } else {
      newStatus = 'completed'
    }

    await supabase
      .from('campaigns')
      .update({ status: newStatus })
      .eq('id', campaignId)
  }
}

// --- TRACKING + UNSUBSCRIBE INJECTION ---

async function unsubscribeToken(emailQueueId: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(emailQueueId))
  const bytes = new Uint8Array(sig)
  let hex = ''
  for (const b of bytes) hex += b.toString(16).padStart(2, '0')
  return hex.slice(0, 32)
}

function buildUnsubscribeUrl(supabaseUrl: string, emailQueueId: string, token: string): string {
  return `${supabaseUrl}/functions/v1/unsubscribe?id=${encodeURIComponent(emailQueueId)}&token=${token}`
}

function injectTracking(htmlBody: string, emailQueueId: string, supabaseUrl: string, unsubscribeUrl: string): string {
  let body = htmlBody

  body = body.replace(
    /href="(https?:\/\/[^"]+)"/gi,
    (_match, url) => {
      // Don't wrap the unsubscribe link in click tracking
      if (url === unsubscribeUrl) return `href="${url}"`
      const trackUrl = `${supabaseUrl}/functions/v1/track-click?id=${encodeURIComponent(emailQueueId)}&url=${encodeURIComponent(url)}`
      return `href="${trackUrl}"`
    }
  )

  const pixelUrl = `${supabaseUrl}/functions/v1/track-open?id=${encodeURIComponent(emailQueueId)}`
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt="" />`

  const footer = `
    <table role="presentation" width="100%" style="margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">
      <tr><td style="text-align:center;font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:12px;color:#6b7280;line-height:1.5">
        Don't want to receive these emails?
        <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline">Unsubscribe</a>
      </td></tr>
    </table>`

  if (body.includes('</body>')) {
    body = body.replace('</body>', `${footer}${pixel}</body>`)
  } else {
    body += footer + pixel
  }

  return body
}

// --- MAIN EXECUTION ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // BATCH FETCH: pull a larger window per cron tick. We chunk per SMTP
    // session below to respect provider per-session limits.
    const BATCH_SIZE = 200
    const MAX_ATTEMPTS = 3
    const PER_SESSION_LIMIT = 20      // reconnect every N sends to avoid "mails per session" caps
    const INTER_SEND_DELAY_MS = 250   // small delay smooths bursts -> fewer 451 rate-limits

    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempt_count', MAX_ATTEMPTS)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (fetchError) throw new Error(`DB Error: ${fetchError.message}`)

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending emails' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing ${pendingEmails.length} emails...`)

    // Group emails by SMTP config key (smtp_account_id or user_id)
    const emailsBySmtp = new Map<string, QueueItem[]>()
    for (const email of pendingEmails as QueueItem[]) {
      const key = email.smtp_account_id || `user:${email.user_id}`
      const group = emailsBySmtp.get(key) || []
      group.push(email)
      emailsBySmtp.set(key, group)
    }

    let successCount = 0
    let errorCount = 0
    const affectedCampaignIds = new Set<string>()

    for (const [_smtpKey, emails] of emailsBySmtp) {
      const firstEmail = emails[0]

      // Resolve SMTP config
      const smtpConfig = await getSmtpConfig(supabase, firstEmail.smtp_account_id, firstEmail.user_id)

      if (!smtpConfig) {
        console.error(`No SMTP config for user ${firstEmail.user_id}, marking emails as failed`)
        for (const email of emails) {
          if (email.campaign_id) affectedCampaignIds.add(email.campaign_id)
          await supabase
            .from('email_queue')
            .update({
              status: 'failed',
              attempt_count: (email.attempt_count || 0) + 1,
              error_log: 'SMTP not configured. Please set up your SMTP credentials in Settings.',
            })
            .eq('id', email.id)
          errorCount++
        }
        continue
      }

      // Cache from_name lookups per campaign for this batch
      const fromNameCache = new Map<string, string | undefined>()

      // Chunk emails into per-session sub-batches: a fresh SMTP connection
      // is opened for each chunk so providers don't trip "mails per session"
      // limits (451-Mails per session limit exceeded).
      for (let i = 0; i < emails.length; i += PER_SESSION_LIMIT) {
        const chunk = emails.slice(i, i + PER_SESSION_LIMIT)
        const client = new SmtpClient()
        let connected = false

        try {
          await client.connect(smtpConfig)
          connected = true
        } catch (connErr: unknown) {
          const errMsg = connErr instanceof Error ? connErr.message : 'SMTP connection failed'
          console.error(`SMTP connect failed: ${errMsg}`)
          // Connection issues are usually transient -> keep emails pending so
          // the next cron tick retries them, until MAX_ATTEMPTS is reached.
          for (const email of chunk) {
            if (email.campaign_id) affectedCampaignIds.add(email.campaign_id)
            const newAttempt = (email.attempt_count || 0) + 1
            const giveUp = newAttempt >= MAX_ATTEMPTS
            await supabase
              .from('email_queue')
              .update({
                status: giveUp ? 'failed' : 'pending',
                attempt_count: newAttempt,
                error_log: `SMTP connection error: ${errMsg}`,
              })
              .eq('id', email.id)
            if (giveUp) errorCount++
          }
          continue
        }

        try {
          for (const email of chunk) {
            if (email.campaign_id) affectedCampaignIds.add(email.campaign_id)

            try {
              const trackedBody = injectTracking(email.body, email.id, supabaseUrl)

              // Resolve sender display name (cached per campaign)
              let fromName: string | undefined
              if (email.campaign_id) {
                if (fromNameCache.has(email.campaign_id)) {
                  fromName = fromNameCache.get(email.campaign_id)
                } else {
                  const { data: camp } = await supabase
                    .from('campaigns')
                    .select('sender_identity_id')
                    .eq('id', email.campaign_id)
                    .single()
                  if (camp?.sender_identity_id) {
                    const { data: identity } = await supabase
                      .from('sender_identities')
                      .select('from_name')
                      .eq('id', camp.sender_identity_id)
                      .single()
                    if (identity?.from_name) fromName = identity.from_name
                  }
                  fromNameCache.set(email.campaign_id, fromName)
                }
              }

              await client.sendEmail(
                email.from_email,
                email.to_email,
                email.subject,
                trackedBody,
                fromName
              )

              await supabase
                .from('email_queue')
                .update({
                  status: 'sent',
                  attempt_count: (email.attempt_count || 0) + 1,
                  sent_at: new Date().toISOString(),
                })
                .eq('id', email.id)

              successCount++

              // Smooth out bursts to avoid provider rate-limits (451 ...).
              if (INTER_SEND_DELAY_MS > 0) {
                await new Promise(r => setTimeout(r, INTER_SEND_DELAY_MS))
              }
            } catch (sendErr: unknown) {
              const errMsg = sendErr instanceof Error ? sendErr.message : 'Unknown send error'
              console.error(`Failed to send to ${email.to_email}: ${errMsg}`)

              // Classify transient vs permanent SMTP errors. 4xx replies and
              // common rate-limit phrases -> retry next tick. 5xx -> give up.
              const isTransient =
                /\b4\d{2}\b/.test(errMsg) ||
                /try again later/i.test(errMsg) ||
                /mails per session/i.test(errMsg) ||
                /send limit exceeded/i.test(errMsg) ||
                /temporar/i.test(errMsg)

              const newAttempt = (email.attempt_count || 0) + 1
              const giveUp = !isTransient || newAttempt >= MAX_ATTEMPTS

              await supabase
                .from('email_queue')
                .update({
                  status: giveUp ? 'failed' : 'pending',
                  attempt_count: newAttempt,
                  error_log: errMsg,
                })
                .eq('id', email.id)

              if (giveUp) {
                errorCount++
              } else {
                // Per-session limit hit -> stop using this connection;
                // remaining emails in this chunk will go in the next session.
                if (/mails per session|503 Bad sequence/i.test(errMsg)) {
                  break
                }
              }
            }
          }
        } finally {
          if (connected) {
            try { await client.close() } catch { /* ignore */ }
          }
        }
      }
    }

    if (affectedCampaignIds.size > 0) {
      await updateCampaignStatuses(supabase, Array.from(affectedCampaignIds))
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
