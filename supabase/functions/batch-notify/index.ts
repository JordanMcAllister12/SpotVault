import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "SpotVault <notifications@spotvault.app>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://spotvault.app";

interface BatchNotifyRequest {
  event_type: "coach_batch_submitted" | "coach_batch_returned";
  recipient_id: string;
  actor_id: string;
  submission_id: string;
  title: string;
  hand_count: number;
  exchange_count?: number;
  is_follow_up?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Auth check: verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid authentication" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: BatchNotifyRequest = await req.json();

    // Input validation
    if (!body.event_type || !body.recipient_id || !body.actor_id || !body.submission_id || !body.title) {
      return new Response(JSON.stringify({ ok: false, error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof body.hand_count !== "number" || body.hand_count < 1) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid hand_count" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The authenticated user must be the actor (the person performing the action)
    if (user.id !== body.actor_id) {
      return new Response(JSON.stringify({ ok: false, error: "Cannot send notifications on behalf of another user" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch recipient email
    const { data: recipientData } = await supabase.auth.admin.getUserById(body.recipient_id);
    const recipientEmail = recipientData?.user?.email;
    if (!recipientEmail) {
      return new Response(JSON.stringify({ ok: false, error: "Recipient email not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch actor display name
    const { data: actorData } = await supabase
      .from("user_profiles")
      .select("display_name, username")
      .eq("user_id", body.actor_id)
      .maybeSingle();

    const actorName = actorData?.display_name || actorData?.username || "A SpotVault user";

    // Fetch recipient display name for the greeting
    const { data: recipProfile } = await supabase
      .from("user_profiles")
      .select("display_name, username")
      .eq("user_id", body.recipient_id)
      .maybeSingle();

    const recipFirstName = recipProfile?.display_name?.split(" ")[0] || recipProfile?.username || "there";

    const isFollowUp = body.is_follow_up === true;
    const exchangeNum = body.exchange_count ?? 1;

    let subject: string;
    let htmlBody: string;
    let ctaText: string;
    let ctaUrl: string;

    if (body.event_type === "coach_batch_submitted") {
      subject = isFollowUp ? `Follow-Up From ${actorName}` : `New Hand Review From ${actorName}`;
      const intro = isFollowUp
        ? `${actorName} sent you a follow-up on their hand review:`
        : `${actorName} sent you a hand review batch:`;
      ctaText = "OPEN IN SPOTVAULT";
      ctaUrl = `${APP_URL}/player/hh-workspace?submission=${body.submission_id}`;
      htmlBody = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;"><h2 style="color:#d4a52c;font-size:20px;margin-bottom:16px;">${subject}</h2><p style="color:#333;font-size:15px;line-height:1.5;">Hi ${recipFirstName},</p><p style="color:#333;font-size:15px;line-height:1.5;">${intro}</p><div style="background:#f8f6f0;border-left:3px solid #d4a52c;border-radius:6px;padding:16px;margin:20px 0;"><p style="margin:0;font-size:16px;font-weight:600;color:#1a1a1a;">${body.title}</p><p style="margin:4px 0 0;font-size:14px;color:#666;">${body.hand_count} hand${body.hand_count !== 1 ? "s" : ""}</p></div><a href="${ctaUrl}" style="display:inline-block;background:#c0911e;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;margin-top:8px;">${ctaText}</a></div>`;
    } else {
      subject = `Your Hand Review Is Ready`;
      ctaText = "VIEW FEEDBACK";
      ctaUrl = `${APP_URL}/player/hh-workspace?submission=${body.submission_id}`;
      const exchangeNote = exchangeNum >= 3 ? "This is the final review — the exchange limit has been reached." : `Exchange ${exchangeNum} of 3`;
      htmlBody = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;"><h2 style="color:#d4a52c;font-size:20px;margin-bottom:16px;">${subject}</h2><p style="color:#333;font-size:15px;line-height:1.5;">Hi ${recipFirstName},</p><p style="color:#333;font-size:15px;line-height:1.5;">${actorName} has returned feedback on:</p><div style="background:#f8f6f0;border-left:3px solid #d4a52c;border-radius:6px;padding:16px;margin:20px 0;"><p style="margin:0;font-size:16px;font-weight:600;color:#1a1a1a;">${body.title}</p><p style="margin:4px 0 0;font-size:14px;color:#666;">${body.hand_count} hand${body.hand_count !== 1 ? "s" : ""}</p><p style="margin:8px 0 0;font-size:12px;color:#999;">${exchangeNote}</p></div><a href="${ctaUrl}" style="display:inline-block;background:#c0911e;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;margin-top:8px;">${ctaText}</a></div>`;
    }

    if (RESEND_API_KEY) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: RESEND_FROM, to: recipientEmail, subject, html: htmlBody }),
      });
      if (!emailResponse.ok) {
        console.error(`[batch-notify] Resend API error: ${emailResponse.status} ${await emailResponse.text()}`);
      }
    } else {
      console.log(`[batch-notify] RESEND_API_KEY not set — email not sent. To: ${recipientEmail} | Subject: ${subject}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[batch-notify] Error:`, err);
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
