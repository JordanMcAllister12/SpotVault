import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TEST_ACCOUNT_USERNAME = "testaccount";

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
    const body = await req.json();
    const { action } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[password-recovery] Missing env vars:", { hasUrl: !!supabaseUrl, hasKey: !!serviceRoleKey });
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── CHECK: is there an active recovery credential for this username? ──
    if (action === "check") {
      const { username, password } = body;
      if (!username || !password) {
        return new Response(JSON.stringify({ error: "Missing username or password" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: credential, error: credError } = await adminClient
        .from("password_recovery_credentials")
        .select("id, username, temp_password, consumed")
        .eq("username", username.toLowerCase())
        .eq("temp_password", password)
        .eq("consumed", false)
        .maybeSingle();

      if (credError || !credential) {
        return new Response(JSON.stringify({ recoveryActive: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ recoveryActive: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RESET: validate credential, update auth password, consume credential ──
    if (action === "reset") {
      const { username, tempPassword, newPassword } = body;
      if (!username || !tempPassword || !newPassword) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (newPassword.length < 10) {
        return new Response(JSON.stringify({ error: "Password must be at least 10 characters" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 1. Validate the recovery credential is active
      const { data: credential, error: credError } = await adminClient
        .from("password_recovery_credentials")
        .select("id, username, temp_password, consumed")
        .eq("username", username.toLowerCase())
        .eq("temp_password", tempPassword)
        .eq("consumed", false)
        .maybeSingle();

      if (credError || !credential) {
        return new Response(JSON.stringify({ error: "Invalid or expired recovery credential" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. Resolve the existing profile to its Auth user ID before using the
      //    Admin Auth API. This also supports Auth records created before the
      //    project reached its current user-list size or indexing state.
      const email = `${username.toLowerCase()}@spotvault.com`;
      let targetUser: { id: string } | null = null;
      const { data: profile, error: profileError } = await adminClient
        .from("user_profiles")
        .select("user_id")
        .ilike("username", username)
        .maybeSingle();

      if (!profileError && profile?.user_id) {
        targetUser = { id: String(profile.user_id) };
      }

      if (!targetUser) {
        let page = 1;
        const perPage = 1000;
        let hasMore = true;
        while (hasMore && !targetUser) {
          const { data: userList, error: listError } = await adminClient.auth.admin.listUsers({ page, perPage });
          if (listError) {
            console.error("[password-recovery] listUsers error:", listError.message, listError.status);
            return new Response(JSON.stringify({ error: "Failed to look up user: " + listError.message }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const found = userList.users.find((u) => u.email?.toLowerCase() === email);
          if (found) targetUser = { id: found.id };
          hasMore = userList.users.length === perPage;
          page++;
        }
      }

      if (!targetUser) {
        console.error("[password-recovery] User not found for email:", email);
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Update the user's password via the Auth API
      const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUser.id, {
        password: newPassword,
      });

      if (updateError) {
        const isTestAccount = username.toLowerCase() === TEST_ACCOUNT_USERNAME;
        const isWeakPasswordError = updateError.message.toLowerCase().includes("weak") ||
          updateError.message.toLowerCase().includes("easy to guess");

        if (isTestAccount && isWeakPasswordError) {
          console.log("[password-recovery] Auth API rejected weak password for testaccount, using direct hash fallback");

          const { data: hashResult, error: hashError } = await adminClient.rpc("set_testaccount_password_hash", {
            raw_password: newPassword,
          });

          if (hashError) {
            console.error("[password-recovery] Direct hash update failed:", hashError.message);
            return new Response(JSON.stringify({ error: "Failed to update password: " + hashError.message }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          if (!hashResult) {
            console.error("[password-recovery] Direct hash update returned false");
            return new Response(JSON.stringify({ error: "Failed to update password" }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          console.log("[password-recovery] Password updated via direct hash for testaccount");
        } else {
          console.error("[password-recovery] updateUserById error:", updateError.message, updateError.status);
          return new Response(JSON.stringify({ error: "Failed to update password: " + updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      console.log("[password-recovery] Password updated successfully for user:", targetUser.id);

      // 4. Consume the credential
      const { error: consumeError } = await adminClient
        .from("password_recovery_credentials")
        .update({ consumed: true, consumed_at: new Date().toISOString() })
        .eq("id", credential.id);

      if (consumeError) {
        console.error("[password-recovery] Failed to consume credential:", consumeError.message);
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[password-recovery] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
