import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Plan pricing in smallest currency units
const PLAN_PRICING: Record<string, { inr: number; usd: number }> = {
  starter_monthly: { inr: 349900, usd: 4900 },
  starter_yearly: { inr: 3499900, usd: 49900 },
  business_monthly: { inr: 799900, usd: 13900 },
  business_yearly: { inr: 7999900, usd: 139900 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
  const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return new Response(
      JSON.stringify({ error: "Razorpay credentials not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { action, ...body } = await req.json();

    const authHeader = req.headers.get("Authorization");
    const supabaseClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_order") {
      const { plan, is_indian } = body;
      // plan: starter_monthly, starter_yearly, business_monthly, business_yearly
      const pricing = PLAN_PRICING[plan];
      if (!pricing) {
        return new Response(JSON.stringify({ error: "Invalid plan" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const currency = is_indian ? "INR" : "USD";
      const amount = is_indian ? pricing.inr : pricing.usd;

      const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
        },
        body: JSON.stringify({
          amount,
          currency,
          receipt: `sub_${user.id.slice(0, 8)}_${Date.now()}`,
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.text();
        throw new Error(`Razorpay order creation failed: ${err}`);
      }

      const order = await orderRes.json();

      await supabaseAdmin.from("subscriptions").insert({
        user_id: user.id,
        plan,
        status: "pending",
        razorpay_order_id: order.id,
        amount: amount / 100,
      });

      return new Response(
        JSON.stringify({
          order_id: order.id,
          amount,
          currency,
          key_id: RAZORPAY_KEY_ID,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify_payment") {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(RAZORPAY_KEY_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const message = `${razorpay_order_id}|${razorpay_payment_id}`;
      const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
      const expectedSignature = Array.from(new Uint8Array(signatureBytes))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      if (expectedSignature !== razorpay_signature) {
        return new Response(JSON.stringify({ error: "Payment verification failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("*")
        .eq("razorpay_order_id", razorpay_order_id)
        .eq("user_id", user.id)
        .single();

      if (!sub) {
        return new Response(JSON.stringify({ error: "Subscription not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const now = new Date();
      const expiresAt = new Date(now);
      if (sub.plan.includes("yearly")) {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "active",
          razorpay_payment_id,
          razorpay_signature,
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", sub.id);

      return new Response(
        JSON.stringify({ success: true, expires_at: expiresAt.toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Razorpay function error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
