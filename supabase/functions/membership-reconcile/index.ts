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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    // Authorize: accept requests with the service role key or a cron secret
    const authHeader = req.headers.get("Authorization");
    const expectedKey = `Bearer ${supabaseServiceKey}`;
    const cronSecret = Deno.env.get("RECONCILE_CRON_SECRET");
    const providedSecret = req.headers.get("X-Cron-Secret");

    if (authHeader !== expectedKey && (!cronSecret || providedSecret !== cronSecret)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Run the reconciliation function
    const { data, error } = await supabase.rpc("sv_reconcile_memberships");

    if (error) {
      console.error("Reconciliation failed:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const result = data as {
      downgrades_applied: number;
      expired: number;
      past_due_expired: number;
    };

    console.log("Reconciliation complete:", result);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        reconciled_at: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err) {
    console.error("Reconciliation edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Reconciliation failed" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
});
