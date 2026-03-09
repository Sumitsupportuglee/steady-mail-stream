import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64Url(bytes: Uint8Array) {
  // btoa expects a binary string
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawToken = authHeader.replace("Bearer ", "").trim();
    if (!rawToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const tokenHash = await sha256Hex(rawToken);

    // Resolve token -> user
    const { data: secretRow, error: secretError } = await admin
      .from("integration_token_secrets")
      .select("token_id")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (secretError) {
      console.error("Token lookup error:", secretError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!secretRow?.token_id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokenRow, error: tokenError } = await admin
      .from("integration_tokens")
      .select("id,user_id")
      .eq("id", secretRow.token_id)
      .maybeSingle();

    if (tokenError || !tokenRow?.user_id) {
      console.error("Token resolve error:", tokenError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = tokenRow.user_id as string;

    // Touch token
    await admin
      .from("integration_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    const body = await req.json();
    const { event_type, data } = body ?? {};

    if (!event_type) {
      return new Response(JSON.stringify({ error: "event_type is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle inbound contact creation
    if (event_type === "create_contact" && data?.email) {
      const { error: insertError } = await admin.from("contacts").insert({
        user_id: userId,
        email: String(data.email),
        name: data.name ? String(data.name) : null,
        client_id: data.client_id ? String(data.client_id) : null,
      });

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin.from("webhook_logs").insert({
        user_id: userId,
        direction: "inbound",
        event_type,
        status: "received",
        payload: body,
      });

      return new Response(JSON.stringify({ success: true, message: "Contact created" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle inbound CRM lead creation
    if (event_type === "create_lead" && data?.name) {
      const { error: insertError } = await admin.from("crm_leads").insert({
        user_id: userId,
        name: String(data.name),
        email: data.email ? String(data.email) : null,
        company: data.company ? String(data.company) : null,
        deal_value: data.deal_value ?? null,
        stage: data.stage || "new_lead",
        client_id: data.client_id ? String(data.client_id) : null,
      });

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await admin.from("webhook_logs").insert({
        user_id: userId,
        direction: "inbound",
        event_type,
        status: "received",
        payload: body,
      });

      return new Response(JSON.stringify({ success: true, message: "Lead created" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown event_type: ${event_type}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("zapier-inbound error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
