import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SecurityNotificationRequest {
  event_type: string;
  user_email: string;
  details?: string;
}

const NOTIFICATION_TEMPLATES: Record<string, { subject: string; body: (details?: string) => string }> = {
  password_changed: {
    subject: "Your SpotVault password was changed",
    body: () => "Your SpotVault password was recently changed. If you did not make this change, secure your account immediately by resetting your password.",
  },
  email_changed: {
    subject: "Your SpotVault email was changed",
    body: () => "The email address associated with your SpotVault account was recently changed. If you did not make this change, please contact support immediately.",
  },
  phone_changed: {
    subject: "Your SpotVault phone number was changed",
    body: () => "The phone number associated with your SpotVault account was recently changed. If you did not make this change, please secure your account.",
  },
  mfa_enabled: {
    subject: "Two-factor authentication enabled on SpotVault",
    body: () => "Two-factor authentication has been enabled on your SpotVault account. This adds an extra layer of security to your login.",
  },
  mfa_disabled: {
    subject: "Two-factor authentication disabled on SpotVault",
    body: () => "Two-factor authentication has been disabled on your SpotVault account. Your account is now less secure. Consider re-enabling 2FA.",
  },
  authenticator_added: {
    subject: "Authenticator app added to SpotVault",
    body: () => "An authenticator app was added to your SpotVault account for two-factor authentication.",
  },
  authenticator_removed: {
    subject: "Authenticator app removed from SpotVault",
    body: () => "An authenticator app was removed from your SpotVault account.",
  },
  recovery_codes_regenerated: {
    subject: "SpotVault recovery codes regenerated",
    body: () => "Your SpotVault recovery codes have been regenerated. Previous codes are no longer valid. Save your new codes in a secure location.",
  },
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SecurityNotificationRequest = await req.json();
    const { event_type, user_email, details } = body;

    if (!event_type || !user_email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const template = NOTIFICATION_TEMPLATES[event_type];
    if (!template) {
      return new Response(JSON.stringify({ error: "Unknown event type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send the notification email
    // In production, this would use a transactional email service (Resend, SendGrid, etc.)
    // For now, we log it and return success.
    console.log(`[Security Notification] To: ${user_email} | Subject: ${template.subject} | Body: ${template.body(details)}`);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[security-notify] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
