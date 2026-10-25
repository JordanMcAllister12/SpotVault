import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hash the provided token to compare against the stored hash
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── Atomic redemption via SECURITY DEFINER function ──
    // This atomically transitions status: pending → consumed in a single UPDATE,
    // preventing replay attacks even under concurrent requests.
    const { data: redeemed, error: redeemError } = await sb
      .rpc("sv_redeem_provisioning_token", { p_token_hash: tokenHash });

    if (redeemError) {
      console.error("[sk-redeem-token] RPC error:", redeemError.message);
      return new Response(JSON.stringify({ error: "Token validation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!redeemed || redeemed.length === 0) {
      // Token is invalid, expired, or already consumed — non-disclosing error
      return new Response(JSON.stringify({ valid: false, error: "This onboarding link is invalid or has expired." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provisioning = redeemed[0];

    // ── Check if this external user already has a linked SpotVault account ──
    const { data: existingUserId } = await sb
      .rpc("sv_check_account_link", { p_external_user_id: provisioning.external_user_id });

    if (existingUserId) {
      // Already linked — this is an existing user, they should log in instead
      return new Response(JSON.stringify({
        valid: true,
        status: "existing_user",
        externalUserId: provisioning.external_user_id,
        externalUsername: provisioning.external_username,
        displayName: provisioning.display_name,
        linkedSpotVaultUserId: existingUserId,
        loginUrl: "/sk",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Return provisioning data for new user onboarding ──
    return new Response(JSON.stringify({
      valid: true,
      status: "new_user",
      requestId: provisioning.id,
      externalUserId: provisioning.external_user_id,
      externalUsername: provisioning.external_username,
      displayName: provisioning.display_name,
      email: provisioning.email,
      metadata: provisioning.metadata,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sk-redeem-token] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
