import { supabase } from './supabase';

export type SessionStatus = 'scheduled' | 'ready' | 'live' | 'processing' | 'completed' | 'cancelled';
export type RecordingStatus = 'none' | 'pending_consent' | 'consented' | 'recording' | 'recorded' | 'failed';

export interface CoachingSession {
  id: string;
  booking_id: string;
  coach_id: string;
  student_id: string;
  rtc_room_id: string;
  scheduled_start: string;
  scheduled_end: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  status: SessionStatus;
  recording_status: RecordingStatus;
  created_at: string;
  updated_at: string;
}

export interface CoachingParticipant {
  id: string;
  session_id: string;
  user_id: string;
  role: 'coach' | 'student';
  joined_at: string | null;
  left_at: string | null;
  recording_consent: boolean;
  consent_timestamp: string | null;
}

export interface CoachingSessionNote {
  id: string;
  session_id: string;
  author_id: string;
  note_type: 'coach' | 'student';
  content: string;
  shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface CoachingSessionHand {
  id: string;
  session_id: string;
  hand_id: string;
  marked_by: string;
  session_timestamp: number;
  note: string | null;
  created_at: string;
}

export interface CoachingSessionEvent {
  id: string;
  session_id: string;
  event_type: string;
  session_timestamp: number;
  hand_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface JoinSessionResponse {
  sessionId: string;
  rtcRoomId: string;
  rtcToken: string | null;
  rtcProvider: string;
  livekitUrl: string | null;
  role: 'coach' | 'student';
  coachId: string;
  studentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: SessionStatus;
  serviceName: string;
}

export async function joinSession(bookingId: string, _userId: string, role: 'coach' | 'student'): Promise<JoinSessionResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Authentication required to join coaching session');
  }
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coaching-token`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ bookingId, role }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorBody.error || `Failed to join session (${response.status})`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data as JoinSessionResponse;
}

export async function fetchSessionByBooking(bookingId: string): Promise<CoachingSession | null> {
  const { data, error } = await supabase
    .from('coaching_sessions')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CoachingSession | null;
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === 'live' || status === 'ready') {
    patch.started_at = new Date().toISOString();
  }
  if (status === 'completed' || status === 'cancelled') {
    patch.ended_at = new Date().toISOString();
  }
  const { error } = await supabase.from('coaching_sessions').update(patch).eq('id', sessionId);
  if (error) throw new Error(error.message);
}

export async function setRecordingStatus(sessionId: string, status: RecordingStatus): Promise<void> {
  const { error } = await supabase.from('coaching_sessions').update({ recording_status: status }).eq('id', sessionId);
  if (error) throw new Error(error.message);
}

export async function setRecordingConsent(sessionId: string, userId: string, consent: boolean): Promise<void> {
  const { error } = await supabase
    .from('coaching_session_participants')
    .update({ recording_consent: consent, consent_timestamp: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function fetchParticipants(sessionId: string): Promise<CoachingParticipant[]> {
  const { data, error } = await supabase
    .from('coaching_session_participants')
    .select('*')
    .eq('session_id', sessionId);
  if (error) throw new Error(error.message);
  return (data || []) as CoachingParticipant[];
}

export async function fetchNotes(sessionId: string): Promise<CoachingSessionNote[]> {
  const { data, error } = await supabase
    .from('coaching_session_notes')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as CoachingSessionNote[];
}

export async function upsertNote(sessionId: string, authorId: string, noteType: 'coach' | 'student', content: string): Promise<void> {
  const { data: existing } = await supabase
    .from('coaching_session_notes')
    .select('id')
    .eq('session_id', sessionId)
    .eq('author_id', authorId)
    .eq('note_type', noteType)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('coaching_session_notes')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('coaching_session_notes')
      .insert({ session_id: sessionId, author_id: authorId, note_type: noteType, content });
    if (error) throw new Error(error.message);
  }
}

export async function shareNote(sessionId: string, authorId: string, shared: boolean): Promise<void> {
  const { error } = await supabase
    .from('coaching_session_notes')
    .update({ shared, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('author_id', authorId)
    .eq('note_type', 'coach');
  if (error) throw new Error(error.message);
}

export async function fetchMarkedHands(sessionId: string): Promise<CoachingSessionHand[]> {
  const { data, error } = await supabase
    .from('coaching_session_hands')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as CoachingSessionHand[];
}

export async function markHandForSession(sessionId: string, handId: string, markedBy: string, sessionTimestamp: number, note?: string): Promise<void> {
  const { error } = await supabase
    .from('coaching_session_hands')
    .insert({ session_id: sessionId, hand_id: handId, marked_by: markedBy, session_timestamp: sessionTimestamp, note: note || null });
  if (error) throw new Error(error.message);
}

export async function logSessionEvent(sessionId: string, eventType: string, sessionTimestamp: number, handId?: string, metadata?: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('coaching_session_events')
    .insert({ session_id: sessionId, event_type: eventType, session_timestamp: sessionTimestamp, hand_id: handId || null, metadata: metadata || null });
  if (error) throw new Error(error.message);
}

export async function fetchSessionEvents(sessionId: string): Promise<CoachingSessionEvent[]> {
  const { data, error } = await supabase
    .from('coaching_session_events')
    .select('*')
    .eq('session_id', sessionId)
    .order('session_timestamp', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as CoachingSessionEvent[];
}

export async function endSession(sessionId: string): Promise<void> {
  const now = new Date().toISOString();
  const { data: session } = await supabase
    .from('coaching_sessions')
    .select('started_at')
    .eq('id', sessionId)
    .maybeSingle();

  let durationSeconds: number | null = null;
  if (session?.started_at) {
    const start = new Date(session.started_at).getTime();
    const end = Date.now();
    durationSeconds = Math.round((end - start) / 1000);
  }

  const { error } = await supabase
    .from('coaching_sessions')
    .update({ status: 'completed', ended_at: now, duration_seconds: durationSeconds })
    .eq('id', sessionId);
  if (error) throw new Error(error.message);

  await logSessionEvent(sessionId, 'session_ended', durationSeconds || 0);
}

export function formatSessionTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatEventTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
