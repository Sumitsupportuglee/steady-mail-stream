import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- AES-GCM Encryption Helpers ---

async function getEncryptionKey(): Promise<CryptoKey> {
  const keyHex = Deno.env.get('SMTP_ENCRYPTION_KEY')
  if (!keyHex || keyHex.length < 32) {
    throw new Error('SMTP_ENCRYPTION_KEY not configured or too short')
  }
  // Use first 32 bytes of the key string as raw key material
  const keyBytes = new TextEncoder().encode(keyHex.slice(0, 32))
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  
  // Combine IV + ciphertext and base64 encode
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  
  return btoa(String.fromCharCode(...combined))
}

export async function decrypt(encrypted: string): Promise<string> {
  const key = await getEncryptionKey()
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
  
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify JWT from the Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { action } = body

    if (action === 'create') {
      const { label, provider, smtp_host, smtp_port, smtp_username, smtp_password, smtp_encryption, is_default, client_id } = body

      if (!smtp_host || !smtp_username || !smtp_password) {
        return new Response(JSON.stringify({ error: 'Missing required SMTP fields' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Encrypt the password
      const encryptedPassword = await encrypt(smtp_password)

      const { data, error } = await supabase
        .from('smtp_accounts')
        .insert({
          user_id: user.id,
          label: label || 'SMTP Account',
          provider: provider || 'custom',
          smtp_host,
          smtp_port: smtp_port || 587,
          smtp_username,
          smtp_password: encryptedPassword,
          smtp_encryption: smtp_encryption || 'tls',
          is_default: is_default || false,
          client_id: client_id || null,
        })
        .select('id')
        .single()

      if (error) throw error

      return new Response(JSON.stringify({ success: true, id: data.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'update') {
      const { id, smtp_password, ...updates } = body

      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing account ID' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Verify ownership
      const { data: existing } = await supabase
        .from('smtp_accounts')
        .select('user_id')
        .eq('id', id)
        .single()

      if (!existing || existing.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Not found or unauthorized' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const updateData: Record<string, any> = {}
      if (updates.label) updateData.label = updates.label
      if (updates.smtp_host) updateData.smtp_host = updates.smtp_host
      if (updates.smtp_port) updateData.smtp_port = updates.smtp_port
      if (updates.smtp_username) updateData.smtp_username = updates.smtp_username
      if (updates.smtp_encryption) updateData.smtp_encryption = updates.smtp_encryption
      if (smtp_password) updateData.smtp_password = await encrypt(smtp_password)

      const { error } = await supabase
        .from('smtp_accounts')
        .update(updateData)
        .eq('id', id)

      if (error) throw error

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'decrypt') {
      // Used by process-queue internally — returns decrypted password for a given smtp_account_id
      const { smtp_account_id } = body

      const { data: acct } = await supabase
        .from('smtp_accounts')
        .select('smtp_password, user_id')
        .eq('id', smtp_account_id)
        .single()

      if (!acct || acct.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let password: string
      try {
        password = await decrypt(acct.smtp_password)
      } catch {
        // If decryption fails, password might be stored in plain text (legacy)
        password = acct.smtp_password
      }

      return new Response(JSON.stringify({ password }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
