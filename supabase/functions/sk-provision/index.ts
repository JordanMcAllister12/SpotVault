import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TOKEN_TTL_MINUTES = 10;
const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_REQUESTS = 20;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ── Server-to-server authentication ──
    const integrationSecret = Deno.env.get("STAKEKINGS_INTEGRATION_SECRET");
    if (!integrationSecret) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providedSecret = authHeader.replace("Bearer ", "").trim();
    if (providedSecret !== integrationSecret) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse and validate request body ──
    const body = await req.json();
    const { externalUserId, username, displayName, email, metadata } = body;

    if (!externalUserId || typeof externalUserId !== "string") {
      return new Response(JSON.stringify({ error: "Missing required field: externalUserId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!username || typeof username !== "string") {
      return new Response(JSON.stringify({ error: "Missing required field: username" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Initialize service-role Supabase client ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Rate limiting: count requests in the last hour ──
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count: recentCount } = await sb
      .from("sk_provisioning_audit")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "provision_requested")
      .gte("created_at", windowStart);

    if (recentCount !== null && recentCount >= RATE_LIMIT_MAX_REQUESTS) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Check if this external user already has a linked SpotVault account ──
    const { data: existingLink } = await sb
      .rpc("sv_check_account_link", { p_external_user_id: externalUserId });

    if (existingLink) {
      // Account already exists — return login redirect info, don't provision a new token
      await sb.from("sk_provisioning_audit").insert({
        event_type: "provision_skipped_existing",
        external_user_id: externalUserId,
        user_id: existingLink,
        detail: { reason: "account_already_linked" },
      });

      return new Response(JSON.stringify({
        status: "existing_account",
        message: "This StakeKings user already has a SpotVault account. Direct them to log in.",
        loginUrl: "/sk",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Idempotency: check for an existing pending request for this external user ──
    const { data: existingPending } = await sb
      .from("sk_provisioning_requests")
      .select("id, token_hash, expires_at, status")
      .eq("external_user_id", externalUserId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPending) {
      // There's already a valid pending request. We can't return the token (we only
      // stored the hash), so we return the onboarding URL — the user should use
      // the link they were already sent. If it expired, they need a new one.
      const isExpired = new Date(existingPending.expires_at) < new Date();

      if (isExpired) {
        // Expired — mark it and fall through to create a new one
        await sb.from("sk_provisioning_requests")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", existingPending.id);
      } else {
        await sb.from("sk_provisioning_audit").insert({
          event_type: "provision_duplicate_suppressed",
          external_user_id: externalUserId,
          request_id: existingPending.id,
          detail: { reason: "pending_request_exists" },
        });

        return new Response(JSON.stringify({
          status: "already_provisioned",
          message: "A pending onboarding link already exists for this user. Check the original delivery channel.",
          expiresAt: existingPending.expires_at,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Generate cryptographically secure one-time token ──
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const rawToken = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");

    // Hash the token with SHA-256 — only the hash is stored
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
    const appUrl = Deno.env.get("APP_URL") || "https://spotvault.app";

    // ── Insert the provisioning request ──
    const { data: request, error: insertError } = await sb
      .from("sk_provisioning_requests")
      .insert({
        external_user_id: externalUserId,
        external_username: username,
        display_name: displayName || null,
        email: email || null,
        token_hash: tokenHash,
        status: "pending",
        expires_at: expiresAt,
        metadata: metadata || {},
      })
      .select("id")
      .single();

    if (insertError || !request) {
      console.error("[sk-provision] Insert failed:", insertError?.message);
      return new Response(JSON.stringify({ error: "Failed to create provisioning request" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Audit log ──
    await sb.from("sk_provisioning_audit").insert({
      event_type: "provision_requested",
      request_id: request.id,
      external_user_id: externalUserId,
      detail: { username, display_name: displayName, has_email: !!email },
    });

    // ── Build onboarding URL with the raw token ──
    const onboardingUrl = `${appUrl}/sk/onboard?token=${rawToken}`;

    return new Response(JSON.stringify({
      status: "provisioned",
      requestId: request.id,
      onboardingUrl,
      expiresAt,
      expiresInMinutes: TOKEN_TTL_MINUTES,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sk-provision] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
