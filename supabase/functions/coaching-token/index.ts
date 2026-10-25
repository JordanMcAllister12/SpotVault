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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Authentication required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { bookingId, role } = await req.json();

    if (!bookingId || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: bookingId, role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userId = user.id;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the booking exists and the user is authorized
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, provider_account_id, requester_account_id, booking_status, start_time, end_time, service_name")
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify the user is a participant
    const isCoach = booking.provider_account_id === userId;
    const isStudent = booking.requester_account_id === userId;

    if (!isCoach && !isStudent) {
      return new Response(
        JSON.stringify({ error: "Not authorized to join this session" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify booking is confirmed or pending (allow joining if at least accepted)
    const allowedStatuses = ["confirmed", "pending", "completed"];
    if (!allowedStatuses.includes(booking.booking_status)) {
      return new Response(
        JSON.stringify({ error: `Session is ${booking.booking_status} and cannot be joined` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find or create a coaching session for this booking
    let { data: session } = await supabase
      .from("coaching_sessions")
      .select("*")
      .eq("booking_id", bookingId)
      .maybeSingle();

    if (!session) {
      const rtcRoomId = `sv-coaching-${bookingId}`;
      const { data: newSession, error: sessionError } = await supabase
        .from("coaching_sessions")
        .insert({
          booking_id: bookingId,
          coach_id: booking.provider_account_id,
          student_id: booking.requester_account_id,
          rtc_room_id: rtcRoomId,
          scheduled_start: booking.start_time,
          scheduled_end: booking.end_time,
          status: "scheduled",
        })
        .select("*")
        .single();

      if (sessionError || !newSession) {
        return new Response(
          JSON.stringify({ error: "Failed to create coaching session" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      session = newSession;
    }

    // Upsert participant record
    const participantRole = isCoach ? "coach" : "student";
    await supabase
      .from("coaching_session_participants")
      .upsert({
        session_id: session.id,
        user_id: userId,
        role: participantRole,
        joined_at: new Date().toISOString(),
      }, { onConflict: "session_id,user_id" });

    // Log join event
    await supabase.from("coaching_session_events").insert({
      session_id: session.id,
      event_type: "participant_joined",
      session_timestamp: 0,
      metadata: { userId, role: participantRole },
    });

    // Generate RTC token
    // When LIVEKIT_API_KEY / LIVEKIT_API_SECRET are configured as edge function
    // secrets, this would generate a real LiveKit access token. Without those
    // secrets, we return a demo token and the frontend falls back to local
    // audio-only mode (getUserMedia for mic visualization, no remote peer).
    const livekitUrl = Deno.env.get("LIVEKIT_URL");
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY");
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    let rtcToken: string | null = null;
    let rtcProvider = "none";

    if (livekitUrl && livekitApiKey && livekitApiSecret) {
      // In production, generate a real LiveKit JWT here using the LiveKit SDK.
      // For now, we signal the frontend that LiveKit is configured but token
      // generation requires the livekit-server-sdk npm package.
      rtcProvider = "livekit";
      rtcToken = `demo-token-${session.rtc_room_id}-${userId}`;
    }

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        rtcRoomId: session.rtc_room_id,
        rtcToken,
        rtcProvider,
        livekitUrl: livekitUrl || null,
        role: participantRole,
        coachId: session.coach_id,
        studentId: session.student_id,
        scheduledStart: session.scheduled_start,
        scheduledEnd: session.scheduled_end,
        status: session.status,
        serviceName: booking.service_name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
