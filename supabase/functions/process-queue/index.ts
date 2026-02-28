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

  async connect(config: SmtpConfig): Promise<void> {
    if (config.smtp_encryption === 'ssl') {
      // Direct TLS connection (port 465)
      this.conn = await Deno.connectTls({
        hostname: config.smtp_host,
        port: config.smtp_port,
      })
      await this.readResponse() // Read greeting
    } else {
      // STARTTLS (port 587) - connect plain first, then upgrade
      const tcpConn = await Deno.connect({
        hostname: config.smtp_host,
        port: config.smtp_port,
      })
      this.conn = tcpConn
      await this.readResponse() // Read greeting

      await this.sendCommand(`EHLO localhost`)
      await this.readMultilineResponse()

      await this.sendCommand(`STARTTLS`)
      const tlsResp = await this.readResponse()
      if (!tlsResp.startsWith('220')) {
        throw new Error(`STARTTLS failed: ${tlsResp}`)
      }

      // Upgrade to TLS
      this.conn = await Deno.startTls(tcpConn, {
        hostname: config.smtp_host,
      })
    }

    // EHLO after TLS
    await this.sendCommand(`EHLO localhost`)
    await this.readMultilineResponse()

    // AUTH LOGIN
    await this.sendCommand(`AUTH LOGIN`)
    const authResp = await this.readResponse()
    if (!authResp.startsWith('334')) {
      throw new Error(`AUTH LOGIN failed: ${authResp}`)
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

  async sendEmail(
    from: string,
    to: string,
    subject: string,
    htmlBody: string,
    fromName?: string
  ): Promise<string> {
    // Extract clean email from "Name <email>" format
    const cleanFrom = from.match(/<(.+)>/)?.[1] || from
    const domain = cleanFrom.split('@')[1]

    // MAIL FROM
    await this.sendCommand(`MAIL FROM:<${cleanFrom}>`)
    const mailResp = await this.readResponse()
    if (!mailResp.startsWith('250')) throw new Error(`MAIL FROM failed: ${mailResp}`)

    // RCPT TO
    await this.sendCommand(`RCPT TO:<${to}>`)
    const rcptResp = await this.readResponse()
    if (!rcptResp.startsWith('250')) throw new Error(`RCPT TO failed: ${rcptResp}`)

    // DATA
    await this.sendCommand(`DATA`)
    const dataResp = await this.readResponse()
    if (!dataResp.startsWith('354')) throw new Error(`DATA failed: ${dataResp}`)

    // Build email with proper headers for safe delivery
    const messageId = `<${crypto.randomUUID()}@${domain}>`
    const date = new Date().toUTCString()

    const senderDisplay = fromName ? `${fromName} <${cleanFrom}>` : cleanFrom

    const headers = [
      `From: ${senderDisplay}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Date: ${date}`,
      `Message-ID: ${messageId}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      // Safe delivery headers
      `List-Unsubscribe: <mailto:unsubscribe@${domain}>`,
      `X-Mailer: SteadyMail/1.0`,
    ]

    // Encode body as quoted-printable (handle dots at line start)
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
      // Multi-line responses have '-' after code, last line has ' '
      const lines = line.split('\n')
      const lastLine = lines[lines.length - 1]
      if (lastLine.length >= 4 && lastLine[3] === ' ') break
    }
    return full.trim()
  }
}

// --- CAMPAIGN STATUS UPDATE ---

async function updateCampaignStatuses(
  supabase: any,
  campaignIds: string[]
): Promise<void> {
  for (const campaignId of campaignIds) {
    const { count: pendingCount, error: pendingError } = await supabase
      .from('email_queue')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')

    if (pendingError) {
      console.error(`Failed to count pending emails for campaign ${campaignId}:`, pendingError)
      continue
    }

    const pending = pendingCount ?? 0
    const newStatus = pending === 0 ? 'completed' : 'sending'

    const { error: updateError } = await supabase
      .from('campaigns')
      .update({ status: newStatus })
      .eq('id', campaignId)

    if (updateError) {
      console.error(`Failed to update campaign ${campaignId} status to ${newStatus}:`, updateError)
    }
  }
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

    // Fetch batch of pending emails
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

    // Group emails by user_id so we can batch SMTP connections
    const emailsByUser = new Map<string, QueueItem[]>()
    for (const email of pendingEmails as QueueItem[]) {
      const group = emailsByUser.get(email.user_id) || []
      group.push(email)
      emailsByUser.set(email.user_id, group)
    }

    let successCount = 0
    let errorCount = 0
    const affectedCampaignIds = new Set<string>()

    // Process each user's emails with their own SMTP config
    for (const [userId, emails] of emailsByUser) {
      // Fetch user's SMTP config
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('smtp_host, smtp_port, smtp_username, smtp_password, smtp_encryption')
        .eq('id', userId)
        .single()

      if (profileError || !profile?.smtp_host || !profile?.smtp_username || !profile?.smtp_password) {
        console.error(`User ${userId} has no SMTP config, marking emails as failed`)
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

      const smtpConfig: SmtpConfig = {
        smtp_host: profile.smtp_host,
        smtp_port: profile.smtp_port || 587,
        smtp_username: profile.smtp_username,
        smtp_password: profile.smtp_password,
        smtp_encryption: profile.smtp_encryption === 'ssl' ? 'ssl' : 'tls',
      }

      // Open one SMTP connection per user, send all their emails
      const client = new SmtpClient()
      let connected = false

      try {
        await client.connect(smtpConfig)
        connected = true
      } catch (connErr: unknown) {
        const errMsg = connErr instanceof Error ? connErr.message : 'SMTP connection failed'
        console.error(`SMTP connect failed for user ${userId}: ${errMsg}`)
        for (const email of emails) {
          if (email.campaign_id) affectedCampaignIds.add(email.campaign_id)
          await supabase
            .from('email_queue')
            .update({
              status: 'failed',
              attempt_count: (email.attempt_count || 0) + 1,
              error_log: `SMTP connection error: ${errMsg}`,
            })
            .eq('id', email.id)
          errorCount++
        }
        continue
      }

      try {
        for (const email of emails) {
          if (email.campaign_id) affectedCampaignIds.add(email.campaign_id)

          try {
            await client.sendEmail(
              email.from_email,
              email.to_email,
              email.subject,
              email.body
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
          } catch (sendErr: unknown) {
            const errMsg = sendErr instanceof Error ? sendErr.message : 'Unknown send error'
            console.error(`Failed to send to ${email.to_email}: ${errMsg}`)

            await supabase
              .from('email_queue')
              .update({
                status: 'failed',
                attempt_count: (email.attempt_count || 0) + 1,
                error_log: errMsg,
              })
              .eq('id', email.id)

            errorCount++
          }
        }
      } finally {
        await client.close()
      }
    }

    // Update campaign statuses
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
