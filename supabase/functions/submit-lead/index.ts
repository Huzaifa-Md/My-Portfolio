import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

// CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    // Read IP from headers
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

    // Rate Limiting (Simple Hash)
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const ipHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase env vars");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Clean up old rate limits (older than 24h)
    await supabase
      .from("rate_limits")
      .delete()
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Check rate limit: 15 min check (max 3)
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: count15m, error: count15mErr } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", fifteenMinsAgo);

    if (count15mErr) throw count15mErr;
    if (count15m !== null && count15m >= 3) {
      return new Response(JSON.stringify({ error: "Too many requests. Please wait a while before trying again." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    // Check rate limit: 24 hour check (max 10)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: count24h, error: count24hErr } = await supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", twentyFourHoursAgo);

    if (count24hErr) throw count24hErr;
    if (count24h !== null && count24h >= 10) {
      return new Response(JSON.stringify({ error: "Too many requests. Please wait a while before trying again." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    // Parse JSON
    const bodyText = await req.text();
    // Payload size check (16KB)
    if (bodyText.length > 16 * 1024) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 413,
      });
    }

    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { name, email, phone, message, turnstileToken, _hp } = payload;

    // Honeypot check
    if (_hp) {
      // Silently reject
      await supabase.from("rate_limits").insert({ ip_hash: ipHash });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      });
    }

    // Validation
    const cleanName = (name || "").trim();
    const cleanEmail = (email || "").trim();
    const cleanPhone = (phone || "").trim();
    const cleanMessage = (message || "").trim();

    if (!cleanName || cleanName.length > 100) {
      return new Response(JSON.stringify({ error: "Invalid name" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!cleanEmail || cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!cleanMessage || cleanMessage.length < 10 || cleanMessage.length > 5000) {
      return new Response(JSON.stringify({ error: "Invalid message length (must be between 10 and 5000 characters)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Spam Detection
    const spamPatterns = [
      /https?:\/\//ig,       // URLs (more than 2)
      /www\./ig,
      /buy now|discount|cheap/i,
      /(.)\1{4,}/,           // Repeated characters
    ];
    
    let urlCount = (cleanMessage.match(/https?:\/\//ig) || []).length;
    let wwwCount = (cleanMessage.match(/www\./ig) || []).length;
    
    if (urlCount + wwwCount > 2 || spamPatterns.slice(2).some(p => p.test(cleanMessage))) {
      await supabase.from("rate_limits").insert({ ip_hash: ipHash });
      return new Response(JSON.stringify({ error: "Spam detected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Turnstile Verification
    if (!turnstileToken) {
       return new Response(JSON.stringify({ error: "Missing Turnstile token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!turnstileSecret) {
      // In development/if keys aren't set, we might bypass or log, but secure is to fail.
      // However, for setup purposes, if the user hasn't put the key yet, we fail gracefully.
      console.warn("TURNSTILE_SECRET_KEY is not set in Supabase Secrets");
      return new Response(JSON.stringify({ error: "Turnstile configuration error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Bypass check if placeholder is used (so we don't break the user's dev experience before they set a real key)
    if (turnstileSecret !== "PLACEHOLDER_SECRET_KEY") {
      const formData = new URLSearchParams();
      formData.append("secret", turnstileSecret);
      formData.append("response", turnstileToken);
      formData.append("remoteip", ip);

      const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: formData,
      });
      const turnstileData = await turnstileRes.json();

      if (!turnstileData.success) {
        return new Response(JSON.stringify({ error: "Turnstile verification failed" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }
    } else {
       console.warn("Using placeholder turnstile secret, bypassing verification");
    }

    // Insert Lead
    const { error: insertError } = await supabase
      .from("leads")
      .insert({
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || null,
        message: cleanMessage,
      });

    if (insertError) throw insertError;

    // Record Rate Limit entry
    await supabase.from("rate_limits").insert({ ip_hash: ipHash });

    // Send email notification (best-effort, non-blocking) - calling the existing function if it exists
    // we do this using fetch to not block the current request
    const notifyUrl = `${supabaseUrl}/functions/v1/notify-lead`;
    fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ name: cleanName, email: cleanEmail, phone: cleanPhone, message: cleanMessage }),
    }).catch(() => {});
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
