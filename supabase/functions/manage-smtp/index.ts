import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    if (action === 'encrypt') {
      // No-op: return password as-is
      const { smtp_password } = body
      if (!smtp_password) {
        return new Response(JSON.stringify({ error: 'Missing SMTP password' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ success: true, encrypted_password: smtp_password }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'migrate-legacy') {
      // No-op: nothing to migrate without encryption
      return new Response(JSON.stringify({
        success: true,
        migrated: { smtp_accounts: 0, profiles: 0, clients: 0 },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'create') {
      const { label, provider, smtp_host, smtp_port, smtp_username, smtp_password, smtp_encryption, is_default, client_id } = body

      if (!smtp_host || !smtp_username || !smtp_password) {
        return new Response(JSON.stringify({ error: 'Missing required SMTP fields' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data, error } = await supabase
        .from('smtp_accounts')
        .insert({
          user_id: user.id,
          label: label || 'SMTP Account',
          provider: provider || 'custom',
          smtp_host,
          smtp_port: smtp_port || 587,
          smtp_username,
          smtp_password,
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
      if (smtp_password) updateData.smtp_password = smtp_password

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

      return new Response(JSON.stringify({ password: acct.smtp_password }), {
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
