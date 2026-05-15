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
  sender_identity_id?: string | null
}

interface SmtpConfig {
  smtp_host: string
  smtp_port: number
  smtp_username: string
  smtp_password: string
  smtp_encryption: 'ssl' | 'tls'
}

// --- SMTP CLIENT (Raw TCP for Deno) ---

// Sender-side authorization failure (server rejected our MAIL FROM because
// the SMTP login isn't allowed to send AS that address). NOT a recipient
// problem — must not be auto-suppressed.
export function isSenderAuthError(msg: string): boolean {
  return /not owned by user|sender address rejected|sender not allowed|not authori[sz]ed (to send|as)|cannot send (as|from)|from address (not )?(allowed|permitted)/i.test(msg)
}

// Permanent recipient errors → suppress the address.
// Anything 5xx on RCPT TO that we should NOT retry.
export function isPermanentRecipientError(msg: string): boolean {
  if (isSenderAuthError(msg)) return false
  return /\b5\d{2}\b/.test(msg) && (
    /no such user|user unknown|mailbox unavailable|invalid mailbox|recipient (address )?rejected|invalid dns mx|no mx|relay (access )?denied|relaying denied|does not exist|account.*disabled|not our customer/i.test(msg)
    || /\b550\b|\b551\b|\b554\b/.test(msg)
  )
}

// Auth failures — we should stop the whole batch for this account.
export function isAuthError(msg: string): boolean {
  return /\b535\b|authentication (credentials? )?(invalid|failed|rejected)|auth.*(failed|invalid)/i.test(msg)
}

class SmtpClient {
  private conn: Deno.TcpConn | Deno.TlsConn | null = null
  private encoder = new TextEncoder()
  private decoder = new TextDecoder()
  private readBuf = ''
  private ehloHost = 'mailer.local'

  setEhloHost(host: string) {
    if (host && /^[a-z0-9.-]+$/i.test(host)) this.ehloHost = host
  }

  isConnected(): boolean { return this.conn !== null }

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
      await this.readMultilineResponse()
    } else {
      const tcpConn = await Deno.connect({
        hostname: config.smtp_host,
        port: config.smtp_port,
      })
      this.conn = tcpConn
      await this.readMultilineResponse()

      await this.sendCommand(`EHLO ${this.ehloHost}`)
      await this.readMultilineResponse()

      await this.sendCommand(`STARTTLS`)
      const tlsResp = await this.readResponse()
      if (!tlsResp.startsWith('220')) {
        throw new Error(`STARTTLS failed: ${tlsResp}`)
      }

      this.conn = await Deno.startTls(tcpConn, {
        hostname: config.smtp_host,
      })
      // After STARTTLS the read buffer must be cleared.
      this.readBuf = ''
    }

    await this.sendCommand(`EHLO ${this.ehloHost}`)
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

    try {
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

      const qpBody = dotStuff(encodeQuotedPrintable(htmlBody))

      const emailContent = headers.join('\r\n') + '\r\n\r\n' + qpBody + '\r\n.'
      await this.sendCommand(emailContent)
      const sendResp = await this.readResponse()
      if (!sendResp.startsWith('250')) throw new Error(`Send failed: ${sendResp}`)

      return messageId
    } catch (err) {
      // Try to reset the SMTP transaction so the next email can reuse the
      // session. If RSET itself fails, the connection is unrecoverable —
      // the caller will detect !isConnected() and reconnect.
      await this.reset().catch(() => { this.forceClose() })
      throw err
    }
  }

  // RSET clears any in-progress mail transaction. Safe to call between sends.
  async reset(): Promise<void> {
    if (!this.conn) throw new Error('Not connected')
    await this.sendCommand('RSET')
    const resp = await this.readResponse()
    if (!resp.startsWith('250')) {
      // Connection is poisoned — drop it.
      this.forceClose()
      throw new Error(`RSET failed: ${resp}`)
    }
  }

  forceClose(): void {
    try { this.conn?.close() } catch { /* ignore */ }
    this.conn = null
    this.readBuf = ''
  }

  async close(): Promise<void> {
    try {
      await this.sendCommand('QUIT')
      await this.readResponse()
    } catch { /* ignore */ }
    this.forceClose()
  }

  private async sendCommand(cmd: string): Promise<void> {
    if (!this.conn) throw new Error('Not connected')
    await this.conn.write(this.encoder.encode(cmd + '\r\n'))
  }

  // Read exactly ONE complete SMTP reply (handles multi-line "250-..." / "250 ...")
  // and buffers any leftover bytes for the next call.
  private async readResponse(): Promise<string> {
    if (!this.conn) throw new Error('Not connected')

    while (true) {
      const complete = this.extractCompleteReply()
      if (complete !== null) return complete

      const buf = new Uint8Array(8192)
      const n = await this.conn.read(buf)
      if (n === null) throw new Error('Connection closed')
      this.readBuf += this.decoder.decode(buf.subarray(0, n))
    }
  }

  // A complete SMTP reply ends with a line that has a SPACE after the 3-digit code
  // (e.g. "250 OK"). Lines with a "-" after the code (e.g. "250-AUTH ...") continue.
  private extractCompleteReply(): string | null {
    const lines: string[] = []
    let cursor = 0
    while (true) {
      const nl = this.readBuf.indexOf('\n', cursor)
      if (nl === -1) return null
      const rawLine = this.readBuf.slice(cursor, nl).replace(/\r$/, '')
      cursor = nl + 1
      lines.push(rawLine)
      // Done when this line is "XYZ ...." (space after code).
      if (rawLine.length >= 4 && /^\d{3}\s/.test(rawLine)) {
        const reply = lines.join('\n')
        this.readBuf = this.readBuf.slice(cursor)
        return reply
      }
      // Otherwise must be "XYZ-..." continuation; keep going.
    }
  }

  private async readMultilineResponse(): Promise<string> {
    return await this.readResponse()
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
  const appUrl = Deno.env.get('APP_URL') || Deno.env.get('SITE_URL') || 'https://steady-mail-stream.lovable.app'
  return `${appUrl.replace(/\/$/, '')}/unsubscribe?id=${encodeURIComponent(emailQueueId)}&token=${token}`
}

function buildUnsubscribeFunctionUrl(supabaseUrl: string, emailQueueId: string, token: string): string {
  return `${supabaseUrl}/functions/v1/unsubscribe?id=${encodeURIComponent(emailQueueId)}&token=${token}`
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function encodeQuotedPrintable(input: string): string {
  const bytes = new TextEncoder().encode(input.replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
  const lines: string[] = []
  let line = ''

  const pushSoftBreak = () => {
    lines.push(line + '=')
    line = ''
  }

  for (const byte of bytes) {
    if (byte === 0x0a) {
      lines.push(line.replace(/[ \t]+$/g, (m) => m.split('').map((ch) => `=${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`).join('')))
      line = ''
      continue
    }

    const chunk = (byte >= 33 && byte <= 60) || (byte >= 62 && byte <= 126)
      ? String.fromCharCode(byte)
      : `=${byte.toString(16).toUpperCase().padStart(2, '0')}`

    if (line.length + chunk.length > 73) pushSoftBreak()
    line += chunk
  }

  lines.push(line.replace(/[ \t]+$/g, (m) => m.split('').map((ch) => `=${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`).join('')))
  return lines.join('\r\n')
}

function dotStuff(input: string): string {
  return input.replace(/^\./gm, '..')
}

function injectTracking(htmlBody: string, emailQueueId: string, supabaseUrl: string, unsubscribeUrl: string): string {
  let body = htmlBody
  // Pre-escaped form of the unsubscribe URL that may already exist in body HTML
  const unsubEscaped = escapeHtmlAttr(unsubscribeUrl)

  body = body.replace(
    /href="(https?:\/\/[^"]+)"/gi,
    (_match, url) => {
      // Don't wrap the unsubscribe link in click tracking (raw or html-escaped)
      if (url === unsubscribeUrl || url === unsubEscaped) return `href="${unsubEscaped}"`
      const trackUrl = `${supabaseUrl}/functions/v1/track-click?id=${encodeURIComponent(emailQueueId)}&url=${encodeURIComponent(url)}`
      return `href="${escapeHtmlAttr(trackUrl)}"`
    }
  )

  const pixelUrl = `${supabaseUrl}/functions/v1/track-open?id=${encodeURIComponent(emailQueueId)}`
  const pixel = `<img src="${escapeHtmlAttr(pixelUrl)}" width="1" height="1" style="display:none" alt="" />`

  // Footer is wrapped in its own div (not nested table) and uses simple text
  // to prevent Gmail from collapsing it into the "..." quoted-content section.
  // IMPORTANT: ampersands in URL must be HTML-escaped to &amp; or some email
  // clients will mangle the query string and drop the &token= parameter,
  // causing the unsubscribe page to show "Invalid link - missing information".
  const footer = `
<div style="margin-top:32px;padding:20px 16px;border-top:1px solid #e5e7eb;text-align:center;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;line-height:1.6">
  <p style="margin:0 0 8px 0;color:#6b7280">You're receiving this email because you opted in or were contacted by the sender.</p>
  <p style="margin:0;color:#374151;font-size:14px">
    <a href="${unsubEscaped}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline;font-weight:600">Unsubscribe from this list</a>
    &nbsp;·&nbsp;
    <a href="${unsubEscaped}" target="_blank" rel="noopener" style="color:#6b7280;text-decoration:underline">Opt out</a>
  </p>
</div>`

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
    const PER_SESSION_LIMIT = 15      // reconnect every N sends to avoid "mails per session" caps
    const INTER_SEND_DELAY_MS = 250   // small delay smooths bursts -> fewer 451 rate-limits

    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempt_count', MAX_ATTEMPTS)
      .or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`)
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
      // Cache per-email-row identity overrides (id -> { from_email, from_name })
      const identityCache = new Map<string, { from_email: string; from_name: string | null }>()
      const resolveIdentity = async (id: string) => {
        if (identityCache.has(id)) return identityCache.get(id)!
        const { data } = await supabase
          .from('sender_identities')
          .select('from_email, from_name')
          .eq('id', id)
          .maybeSingle()
        const v = data?.from_email ? { from_email: data.from_email, from_name: data.from_name || null } : null
        if (v) identityCache.set(id, v)
        return v
      }

      // All emails in this `emails` array share the same SMTP account (grouped
      // above). If that SMTP account has a linked sender identity, ALL outgoing
      // From addresses in this batch must use it — otherwise providers like
      // Zoho/cPanel reject with "553 Sender address rejected: not owned by user".
      let linkedFromEmail: string | null = null
      let linkedFromName: string | null = null
      let smtpLoginEmail: string | null = null
      const sharedSmtpId = emails[0]?.smtp_account_id || null
      if (sharedSmtpId) {
        const { data: linkRow } = await supabase
          .from('smtp_accounts')
          .select('sender_identity_id, smtp_username')
          .eq('id', sharedSmtpId)
          .maybeSingle()
        if (linkRow?.smtp_username && /@/.test(linkRow.smtp_username)) {
          smtpLoginEmail = linkRow.smtp_username.toLowerCase()
        }
        if (linkRow?.sender_identity_id) {
          const { data: idn } = await supabase
            .from('sender_identities')
            .select('from_email, from_name')
            .eq('id', linkRow.sender_identity_id)
            .maybeSingle()
          if (idn?.from_email) {
            linkedFromEmail = idn.from_email
            linkedFromName = idn.from_name || null
          }
        }
      }

      // Track addresses we've already auto-suppressed in this run so we
      // skip duplicates without re-querying.
      const suppressedThisRun = new Set<string>()
      // If auth fails for this account we abort all chunks for it.
      let accountAuthFailed: string | null = null

      // Chunk emails into per-session sub-batches: a fresh SMTP connection
      // is opened for each chunk so providers don't trip "mails per session"
      // limits (451-Mails per session limit exceeded).
      for (let i = 0; i < emails.length; i += PER_SESSION_LIMIT) {
        if (accountAuthFailed) break
        const chunk = emails.slice(i, i + PER_SESSION_LIMIT)
        let client = new SmtpClient()
        // Use the sender's domain as EHLO hostname — many providers
        // reject or penalise "EHLO localhost".
        const effectiveFrom = linkedFromEmail || (chunk[0].from_email.match(/<(.+)>/)?.[1] || chunk[0].from_email)
        const fromDomain = effectiveFrom.split('@')[1]
        if (fromDomain) client.setEhloHost(fromDomain)
        let connected = false

        try {
          await client.connect(smtpConfig)
          connected = true
        } catch (connErr: unknown) {
          const errMsg = connErr instanceof Error ? connErr.message : 'SMTP connection failed'
          console.error(`SMTP connect failed: ${errMsg}`)

          // 535 auth error → stop hammering this account, mark all its emails failed
          // with a clear, user-actionable message.
          if (isAuthError(errMsg)) {
            accountAuthFailed = errMsg
            const friendly = 'SMTP login rejected (535). Please update the SMTP password in Settings → SMTP Accounts.'
            for (const email of emails) {
              if (email.campaign_id) affectedCampaignIds.add(email.campaign_id)
              await supabase
                .from('email_queue')
                .update({
                  status: 'failed',
                  attempt_count: (email.attempt_count || 0) + 1,
                  error_log: friendly,
                })
                .eq('id', email.id)
              errorCount++
            }
            break
          }

          // Other connection issues: keep emails pending so the next cron tick retries.
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

            // If a previous send dropped the session, reconnect before continuing.
            if (!client.isConnected()) {
              try {
                client = new SmtpClient()
                if (fromDomain) client.setEhloHost(fromDomain)
                await client.connect(smtpConfig)
              } catch (reErr: unknown) {
                const errMsg = reErr instanceof Error ? reErr.message : 'reconnect failed'
                console.warn(`SMTP reconnect failed: ${errMsg} — deferring rest of chunk`)
                // Leave remaining emails as pending for next tick
                break
              }
            }

            try {
              // Local + db-backed suppression check
              if (suppressedThisRun.has(email.to_email.toLowerCase())) {
                await supabase
                  .from('email_queue')
                  .update({
                    status: 'failed',
                    error_log: 'Recipient auto-suppressed (previous bounce)',
                    attempt_count: (email.attempt_count || 0) + 1,
                  })
                  .eq('id', email.id)
                errorCount++
                continue
              }

              // Suppression: skip recipients who unsubscribed from this user's mail
              const { data: optedOut } = await supabase
                .from('email_unsubscribes')
                .select('id')
                .eq('user_id', email.user_id)
                .ilike('email', email.to_email)
                .maybeSingle()

              if (optedOut) {
                await supabase
                  .from('email_queue')
                  .update({
                    status: 'failed',
                    error_log: 'Recipient has unsubscribed',
                    attempt_count: (email.attempt_count || 0) + 1,
                  })
                  .eq('id', email.id)
                errorCount++
                continue
              }

              const token = await unsubscribeToken(email.id, supabaseServiceKey)
              const unsubUrl = buildUnsubscribeUrl(supabaseUrl, email.id, token)
              const unsubFunctionUrl = buildUnsubscribeFunctionUrl(supabaseUrl, email.id, token)
              const trackedBody = injectTracking(email.body, email.id, supabaseUrl, unsubUrl)

              // Resolve per-email identity override first (rotation pool with
              // user-picked identity per SMTP). Falls back to the SMTP-linked
              // identity, then to the campaign's identity.
              let perRowFromEmail: string | null = null
              let perRowFromName: string | null = null
              if (email.sender_identity_id) {
                const idn = await resolveIdentity(email.sender_identity_id)
                if (idn) {
                  perRowFromEmail = idn.from_email
                  perRowFromName = idn.from_name
                }
              }

              let fromName: string | undefined = perRowFromName ?? linkedFromName ?? undefined
              if (!fromName && email.campaign_id) {
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

              // Reserve quota on the SMTP account before sending. If exhausted,
              // push this email forward 1 hour so it retries after the hourly window.
              if (email.smtp_account_id) {
                const { data: reserved } = await supabase.rpc('reserve_smtp_quota', { _smtp_id: email.smtp_account_id })
                if (reserved !== true) {
                  const nextSlot = new Date(Date.now() + 60 * 60 * 1000).toISOString()
                  await supabase
                    .from('email_queue')
                    .update({ scheduled_for: nextSlot })
                    .eq('id', email.id)
                  console.log(`Quota exhausted for SMTP ${email.smtp_account_id}, deferred ${email.id} to ${nextSlot}`)
                  continue
                }
              }

              // Per-row override > SMTP-linked > queued from_email
              const effectiveFromEmail = perRowFromEmail || linkedFromEmail || email.from_email

              await client.sendEmail(
                effectiveFromEmail,
                email.to_email,
                email.subject,
                trackedBody,
                fromName,
                unsubFunctionUrl
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

              // 1) Auth error mid-session → stop everything for this account
              if (isAuthError(errMsg)) {
                accountAuthFailed = errMsg
                const friendly = 'SMTP login rejected (535). Please update the SMTP password in Settings → SMTP Accounts.'
                await supabase
                  .from('email_queue')
                  .update({
                    status: 'failed',
                    attempt_count: (email.attempt_count || 0) + 1,
                    error_log: friendly,
                  })
                  .eq('id', email.id)
                errorCount++
                break
              }

              // 2) Permanent recipient bounce → auto-suppress this address.
              const isPermRcpt = /RCPT TO failed/i.test(errMsg) && isPermanentRecipientError(errMsg)
              if (isPermRcpt) {
                suppressedThisRun.add(email.to_email.toLowerCase())
                try {
                  await supabase.from('email_unsubscribes').insert({
                    user_id: email.user_id,
                    email: email.to_email,
                    contact_id: (email as any).contact_id ?? null,
                    campaign_id: email.campaign_id ?? null,
                    email_queue_id: email.id,
                    reason: `auto-bounce: ${errMsg.slice(0, 200)}`,
                  })
                } catch (_) { /* ignore duplicate */ }
                // Mark contact as bounced so it disappears from active lists
                try {
                  await supabase
                    .from('contacts')
                    .update({ status: 'bounced' })
                    .eq('user_id', email.user_id)
                    .ilike('email', email.to_email)
                } catch (_) { /* ignore */ }

                await supabase
                  .from('email_queue')
                  .update({
                    status: 'failed',
                    attempt_count: (email.attempt_count || 0) + 1,
                    error_log: `Permanent bounce — address suppressed: ${errMsg}`,
                  })
                  .eq('id', email.id)
                errorCount++
                continue
              }

              // 3) Transient vs permanent classification
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
                // Per-session / sequence problems → drop the connection so
                // we open a fresh one for remaining emails in this chunk.
                if (/mails per session|503 Bad sequence|421/i.test(errMsg)) {
                  client.forceClose()
                }
              }
            }
          }
        } finally {
          if (connected && client.isConnected()) {
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
