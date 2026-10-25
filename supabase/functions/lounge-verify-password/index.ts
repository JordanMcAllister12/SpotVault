import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Simple in-memory rate limiter per IP+slug
// Allows max 10 attempts per 5 minutes
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;
const attemptMap = new Map<string, { count: number; firstAttempt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attemptMap.get(key);
  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
    attemptMap.set(key, { count: 1, firstAttempt: now });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX_ATTEMPTS;
}

// Periodically clean old entries to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attemptMap) {
    if (now - entry.firstAttempt > RATE_LIMIT_WINDOW_MS) {
      attemptMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ valid: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Auth check: verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ valid: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ valid: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { loungeSlug, password } = await req.json();

    // Input validation
    if (!loungeSlug || typeof loungeSlug !== "string" || loungeSlug.length > 200) {
      return new Response(JSON.stringify({ valid: false, error: "Missing or invalid lounge slug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!password || typeof password !== "string" || password.length > 1000) {
      return new Response(JSON.stringify({ valid: false, error: "Missing or invalid password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting: per user + lounge slug
    const rateLimitKey = `${user.id}:${loungeSlug}`;
    if (!checkRateLimit(rateLimitKey)) {
      return new Response(JSON.stringify({ valid: false, error: "Too many attempts. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "300" },
      });
    }

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { data, error } = await sb
      .from("lounge_configs")
      .select("password_hash")
      .eq("slug", loungeSlug)
      .maybeSingle();

    if (error || !data) {
      // Use a constant-time-ish response to avoid leaking which lounges exist
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 100));
      return new Response(JSON.stringify({ valid: false, error: "Invalid lounge or password" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data.password_hash) {
      return new Response(JSON.stringify({ valid: false, error: "No password required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compare plaintext password against stored bcrypt hash
    const { compare } = await import("https://deno.land/x/bcrypt@v1.2.3/mod.ts");
    const valid = await compare(password, data.password_hash);

    // Add a small delay on failure to slow down brute-force
    if (!valid) {
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 100));
    }

    return new Response(JSON.stringify({ valid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ valid: false, error: "Verification failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
