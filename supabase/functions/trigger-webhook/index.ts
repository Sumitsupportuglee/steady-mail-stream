import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const body = await req.json();
    const { event_type, data, provider } = body ?? {};

    if (!event_type || !data) {
      return new Response(JSON.stringify({ error: "event_type and data are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's enabled integrations
    let query = supabase
      .from("integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("is_enabled", true);

    if (provider) query = query.eq("provider", provider);

    const { data: integrations, error: intError } = await query;

    if (intError) {
      console.error("Error fetching integrations:", intError);
      return new Response(JSON.stringify({ error: "Failed to fetch integrations" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { provider: string; status: string; error?: string }[] = [];

    for (const integration of integrations || []) {
      if (!integration.webhook_url) continue;

      const payload = {
        event_type,
        timestamp: new Date().toISOString(),
        data,
      };

      try {
        const response = await fetch(integration.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const bodyText = await response.text().catch(() => "");
          results.push({
            provider: integration.provider,
            status: "failed",
            error: `HTTP ${response.status}${bodyText ? `: ${bodyText}` : ""}`,
          });

          await supabase.from("webhook_logs").insert({
            user_id: userId,
            integration_id: integration.id,
            direction: "outbound",
            event_type,
            status: "failed",
            error_message: `HTTP ${response.status}${bodyText ? `: ${bodyText}` : ""}`,
            payload,
          });

          continue;
        }

        results.push({ provider: integration.provider, status: "sent" });

        await supabase.from("webhook_logs").insert({
          user_id: userId,
          integration_id: integration.id,
          direction: "outbound",
          event_type,
          status: "sent",
          payload,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`Webhook to ${integration.provider} failed:`, error);
        results.push({ provider: integration.provider, status: "failed", error: message });

        await supabase.from("webhook_logs").insert({
          user_id: userId,
          integration_id: integration.id,
          direction: "outbound",
          event_type,
          status: "failed",
          error_message: message,
          payload,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("trigger-webhook error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
