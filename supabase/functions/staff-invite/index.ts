import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvitationActivateRequest {
  token: string;
  email: string;
  password: string;
  full_name?: string;
  username?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (req.method === "POST") {
      const body: InvitationActivateRequest = await req.json();
      const { token, email, password } = body;

      if (!token || !email || !password) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: token, email, password" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Create the auth user
      const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: body.full_name || body.username || email,
          display_name: body.full_name || body.username || email.split("@")[0],
        },
      });

      if (createError) {
        return new Response(
          JSON.stringify({ error: `Failed to create account: ${createError.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const newUserId = authData.user.id;

      // Create user profile
      await adminClient.from("user_profiles").upsert({
        user_id: newUserId,
        display_name: body.full_name || body.username || email.split("@")[0],
        username: body.username || email.split("@")[0],
        created_at: new Date().toISOString(),
      });

      // Consume the invitation (sets org, role, tags, permissions)
      const { data: invData, error: invError } = await adminClient.rpc("sv_consume_staff_invitation", {
        p_token: token,
        p_new_user_id: newUserId,
      });

      if (invError) {
        // Clean up the created user if invitation fails
        await adminClient.auth.admin.deleteUser(newUserId);
        const errMsg = invError.message;
        if (errMsg.includes("INVALID_TOKEN")) {
          return new Response(
            JSON.stringify({ error: "This invitation token is not valid or has already been used." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (errMsg.includes("EXPIRED_TOKEN")) {
          return new Response(
            JSON.stringify({ error: "This invitation has expired. Please request a new invitation." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ error: `Invitation activation failed: ${errMsg}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const inv = invData?.[0];
      return new Response(
        JSON.stringify({
          success: true,
          user_id: newUserId,
          email,
          organization: inv?.organization || "spotvault",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
