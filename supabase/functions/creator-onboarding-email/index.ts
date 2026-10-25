import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUBJECT = "Creating Great Spots on SpotVault";

function emailBody(): string {
  return [
    "Creating a great Spot starts with the same mindset you would use when studying your own game.",
    "",
    "Don't just look for the answer. Try to understand why the strategy works.",
    "",
    "Research the situation yourself, use solver evidence where appropriate, and explain the reasoning in a way another player can understand.",
    "",
    "AI can help you proofread, organize, simplify, and visualize your ideas — but the underlying poker analysis should come from you.",
    "",
    "The best Spots don't just tell players what to do. They help players understand why.",
  ].join("\n");
}

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;
    if (!userEmail) {
      return new Response(JSON.stringify({ error: "User has no email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if we already sent this email (idempotency)
    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("creator_guide_email_sent_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (prefs?.creator_guide_email_sent_at) {
      return new Response(JSON.stringify({ ok: true, already_sent: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send the email
    // In production, this would use a transactional email service (Resend, SendGrid, etc.)
    // For now, we log it and mark it as sent.
    console.log(`[Creator Onboarding Email] To: ${userEmail} | Subject: ${SUBJECT}\nBody:\n${emailBody()}`);

    // Mark as sent
    const { error: upsertErr } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: userId,
        creator_guide_email_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (upsertErr) {
      console.error("[creator-onboarding-email] Failed to mark email sent:", upsertErr);
    }

    return new Response(JSON.stringify({ ok: true, sent: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[creator-onboarding-email] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
