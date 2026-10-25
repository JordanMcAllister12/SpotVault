import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendOtpRequest {
  channel: "sms" | "email";
  destination: string;
  purpose: "enrollment" | "login";
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

    const body: SendOtpRequest = await req.json();
    const { channel, destination, purpose } = body;

    if (!channel || !destination || !purpose) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (channel !== "sms" && channel !== "email") {
      return new Response(JSON.stringify({ error: "Invalid channel" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (purpose !== "enrollment" && purpose !== "login") {
      return new Response(JSON.stringify({ error: "Invalid purpose" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a Supabase client with the user's JWT to run as the authenticated user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate and store the OTP via the appropriate RPC
    let code: string | null = null;
    if (channel === "sms") {
      const { data, error } = await supabase.rpc("sv_create_sms_otp", {
        p_phone: destination,
        p_purpose: purpose,
      });
      if (error) throw error;
      code = data as string;
    } else {
      const { data, error } = await supabase.rpc("sv_create_email_otp", {
        p_email: destination,
        p_purpose: purpose,
      });
      if (error) throw error;
      code = data as string;
    }

    if (!code) {
      return new Response(JSON.stringify({ error: "Failed to generate code" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send the code via the appropriate channel
    if (channel === "email") {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "SpotVault <notifications@spotvault.app>";

      if (RESEND_API_KEY) {
        const emailHtml = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;"><h2 style="color:#d4a52c;font-size:20px;">Your SpotVault Security Code</h2><p style="color:#333;font-size:15px;">Your verification code is:</p><div style="background:#f8f6f0;border-left:3px solid #d4a52c;border-radius:6px;padding:16px;margin:20px 0;text-align:center;"><span style="font-size:28px;font-weight:700;letter-spacing:6px;color:#1a1a1a;">${code}</span></div><p style="color:#999;font-size:12px;">If you didn't request this code, you can ignore this email.</p></div>`;

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: destination,
            subject: "Your SpotVault Security Code",
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errText = await emailResponse.text();
          console.error(`[send-otp] Resend API error: ${emailResponse.status} ${errText}`);
          return new Response(JSON.stringify({ error: "Failed to send email. Please try again." }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ ok: true, channel: "email" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // No Resend key configured — surface the error instead of pretending success
      console.error("[send-otp] RESEND_API_KEY not set — email OTP cannot be delivered");
      return new Response(JSON.stringify({ error: "Email delivery is not configured. Please contact support." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (channel === "sms") {
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

      if (twilioAccountSid && twilioAuthToken && twilioFromNumber) {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const smsBody = `Your SpotVault security code is: ${code}. Do not share this code with anyone.`;
        const formData = new FormData();
        formData.append("From", twilioFromNumber);
        formData.append("To", destination);
        formData.append("Body", smsBody);

        const twilioResponse = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
          },
          body: formData,
        });

        if (!twilioResponse.ok) {
          console.error("[send-otp] Twilio send failed:", await twilioResponse.text());
          return new Response(JSON.stringify({ error: "Failed to send SMS. Please try again." }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        console.error(`[send-otp] Twilio not configured — SMS OTP for ${destination} cannot be delivered`);
        return new Response(JSON.stringify({ error: "SMS delivery is not configured. Please contact support." }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true, channel: "sms" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid channel" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-otp] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
