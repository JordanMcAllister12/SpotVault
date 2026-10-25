import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic, MicOff, PhoneOff, Radio, Loader2, AlertCircle,
  Hand, FileText, Clock, ChevronRight, X, Volume2,
} from 'lucide-react';
import {
  joinSession, updateSessionStatus, setRecordingConsent, setRecordingStatus,
  fetchParticipants, fetchNotes, upsertNote, shareNote,
  markHandForSession, logSessionEvent, fetchSessionEvents, endSession,
  formatSessionTime, formatEventTimestamp,
  type JoinSessionResponse, type CoachingParticipant, type CoachingSessionNote, type CoachingSessionEvent,
} from '@/lib/coachingSession';
import { HandSorter } from '@/components/player/HandSorter';
import { HHReplayer } from '@/features/hh-replayer/HHReplayer';
import { phase2HandToNormalized, type Phase2HandRecord } from '@/features/hh-replayer/adapter';
import { supabase } from '@/lib/supabase';
import type { NormalizedHand } from '@/features/hh-replayer/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const PANEL_BG = 'rgba(8, 10, 12, 0.92)';
const PANEL_BORDER = 'rgba(212, 165, 44, 0.12)';

interface Props {
  bookingId: string;
  userId: string;
  userRole: 'coach' | 'student';
  coachName: string;
  studentName: string;
  serviceName: string;
  onExit: () => void;
}

type RoomView = 'call' | 'hands' | 'notes' | 'timeline';

export function CoachingRoom({ bookingId, userId, userRole, coachName, studentName, serviceName, onExit }: Props) {
  const [joinState, setJoinState] = useState<'joining' | 'connected' | 'failed'>('joining');
  const [session, setSession] = useState<JoinSessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [view, setView] = useState<RoomView>('call');
  const [participants, setParticipants] = useState<CoachingParticipant[]>([]);
  const [recordingState, setRecordingState] = useState<'none' | 'pending_consent' | 'recording' | 'declined'>('none');
  const [myConsent, setMyConsent] = useState(false);
  const [otherConsent, setOtherConsent] = useState(false);
  const [coachNote, setCoachNote] = useState('');
  const [studentNote, setStudentNote] = useState('');
  const [noteShared, setNoteShared] = useState(false);
  const [markedHands, setMarkedHands] = useState<{ handId: string; timestamp: number }[]>([]);
  const [events, setEvents] = useState<CoachingSessionEvent[]>([]);
  const [reviewingHand, setReviewingHand] = useState<NormalizedHand | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const startTimeRef = useRef<number>(0);
  const noteSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Join session
  useEffect(() => {
    let cancelled = false;
    async function join() {
      try {
        const res = await joinSession(bookingId, userId, userRole);
        if (cancelled) return;
        setSession(res);
        setJoinState('connected');
        startTimeRef.current = Date.now();
        await updateSessionStatus(res.sessionId, 'live');
        await logSessionEvent(res.sessionId, 'session_started', 0);
        await loadParticipants(res.sessionId);
        await loadNotes(res.sessionId);
        await loadEvents(res.sessionId);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to join session');
          setJoinState('failed');
        }
      }
    }
    join();
    return () => { cancelled = true; };
  }, [bookingId, userId, userRole]);

  // Timer
  useEffect(() => {
    if (joinState !== 'connected') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [joinState]);

  // Mic access
  useEffect(() => {
    if (joinState !== 'connected') return;
    let active = true;
    async function requestMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setMicStream(stream);
      } catch (e) {
        setMicError(e instanceof Error ? e.message : 'Microphone access denied');
      }
    }
    requestMic();
    return () => {
      active = false;
    };
  }, [joinState]);

  // Cleanup mic on unmount
  useEffect(() => {
    return () => {
      micStream?.getTracks().forEach((t) => t.stop());
    };
  }, [micStream]);

  // Poll participants for consent updates
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => loadParticipants(session.sessionId), 5000);
    return () => clearInterval(interval);
  }, [session]);

  // Poll events
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => loadEvents(session.sessionId), 10000);
    return () => clearInterval(interval);
  }, [session]);

  const loadParticipants = useCallback(async (sessionId: string) => {
    try {
      const parts = await fetchParticipants(sessionId);
      setParticipants(parts);
      const me = parts.find((p) => p.user_id === userId);
      const other = parts.find((p) => p.user_id !== userId);
      setMyConsent(me?.recording_consent ?? false);
      setOtherConsent(other?.recording_consent ?? false);
    } catch { /* ignore poll errors */ }
  }, [userId]);

  const loadNotes = useCallback(async (sessionId: string) => {
    try {
      const notes = await fetchNotes(sessionId);
      const coach = notes.find((n) => n.note_type === 'coach');
      const student = notes.find((n) => n.note_type === 'student');
      if (coach) { setCoachNote(coach.content); setNoteShared(coach.shared); }
      if (student) setStudentNote(student.content);
    } catch { /* ignore */ }
  }, []);

  const loadEvents = useCallback(async (sessionId: string) => {
    try {
      const evts = await fetchSessionEvents(sessionId);
      setEvents(evts);
    } catch { /* ignore */ }
  }, []);

  // Mute toggle
  const toggleMute = useCallback(() => {
    if (micStream) {
      micStream.getAudioTracks().forEach((track) => {
        track.enabled = muted;
      });
    }
    setMuted((m) => !m);
  }, [micStream, muted]);

  // Recording consent
  const handleRequestRecording = useCallback(() => {
    setRecordingState('pending_consent');
  }, []);

  const handleAgreeToRecording = useCallback(async () => {
    if (!session) return;
    try {
      await setRecordingConsent(session.sessionId, userId, true);
      setMyConsent(true);
      await logSessionEvent(session.sessionId, 'recording_consent_given', elapsed, undefined, { userId });
    } catch { /* ignore */ }
  }, [session, userId, elapsed]);

  const handleDeclineRecording = useCallback(() => {
    setRecordingState('declined');
  }, []);

  // Start recording (only if both consent)
  useEffect(() => {
    if (!session || recordingState !== 'pending_consent') return;
    if (myConsent && otherConsent) {
      setRecordingState('recording');
      setRecordingStatus(session.sessionId, 'recording');
      logSessionEvent(session.sessionId, 'recording_started', elapsed);
    }
  }, [session, recordingState, myConsent, otherConsent, elapsed]);

  // Note autosave
  const scheduleNoteSave = useCallback((content: string, type: 'coach' | 'student') => {
    if (!session) return;
    if (noteSaveTimerRef.current) clearTimeout(noteSaveTimerRef.current);
    noteSaveTimerRef.current = setTimeout(() => {
      upsertNote(session.sessionId, userId, type, content).catch(() => {});
    }, 1500);
  }, [session, userId]);

  // Mark hand
  const handleMarkHand = useCallback(async (handId: string) => {
    if (!session) return;
    try {
      await markHandForSession(session.sessionId, handId, userId, elapsed);
      setMarkedHands((prev) => [...prev, { handId, timestamp: elapsed }]);
      await logSessionEvent(session.sessionId, 'hand_marked', elapsed, handId);
      await loadEvents(session.sessionId);
    } catch { /* ignore */ }
  }, [session, userId, elapsed, loadEvents]);

  // Review hand from Hand Sorter
  const handleReviewHand = useCallback(async (handId: string) => {
    if (!session) return;
    setReviewLoading(true);
    setReviewingHand(null);
    try {
      const targetUserId = userRole === 'coach' ? session.studentId : userId;
      const { data, error: fetchError } = await supabase
        .from('poker_hand_records')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('hand_id', handId)
        .maybeSingle();
      if (fetchError) throw new Error(fetchError.message);
      if (!data) throw new Error('Hand not found');
      const normalized = phase2HandToNormalized(data as unknown as Phase2HandRecord);
      if (!normalized.actions || normalized.actions.length === 0) {
        throw new Error('Unable to replay — action data incomplete');
      }
      setReviewingHand(normalized);
      await logSessionEvent(session.sessionId, 'hand_opened', elapsed, handId);
      await loadEvents(session.sessionId);
    } catch (e) {
      setMicError(e instanceof Error ? e.message : 'Failed to load hand');
    } finally {
      setReviewLoading(false);
    }
  }, [session, userRole, userId, elapsed, loadEvents]);

  // End session
  const handleEndSession = useCallback(async () => {
    if (!session) return;
    try {
      micStream?.getTracks().forEach((t) => t.stop());
      await endSession(session.sessionId);
    } catch { /* ignore */ }
    onExit();
  }, [session, micStream, onExit]);

  // ===== RENDER =====

  if (joinState === 'joining') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#050608]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-[#d4a52c]" />
          <span className="text-[13px] text-white/50">Joining coaching session...</span>
        </div>
      </div>
    );
  }

  if (joinState === 'failed') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#050608] p-6">
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400/60" strokeWidth={1.5} />
          <p className="text-[14px] font-semibold text-white/70">Unable to join session</p>
          <p className="mt-1.5 text-[12px] text-white/40">{error}</p>
          <button onClick={onExit} className="mt-4 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-semibold text-white/70 hover:bg-white/10">Back</button>
        </div>
      </div>
    );
  }

  const isRecording = recordingState === 'recording';

  return (
    <div className="fixed inset-0 z-[200] flex flex-col overflow-hidden bg-[#050608]">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,6,8,0.92) 0%, rgba(8,10,12,0.95) 100%)' }} />

      {/* Header */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3 md:px-6" style={{ background: 'rgba(8,10,12,0.88)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgba(212,165,44,0.1)', border: '1px solid rgba(212,165,44,0.15)' }}>
            <Mic className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-[14px] font-bold tracking-tight text-white">Coaching Session</h1>
            <span className="text-[9px] font-mono tracking-[0.15em] text-white/40 uppercase">{serviceName}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} />
            <span className="font-mono text-[12px] font-bold text-white/80">{formatSessionTime(elapsed)}</span>
          </div>

          {/* Recording indicator */}
          {isRecording && (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5">
              <Radio className="h-3.5 w-3.5 animate-pulse text-red-400" strokeWidth={1.5} />
              <span className="text-[10px] font-bold tracking-widest text-red-400 uppercase">Recording</span>
            </div>
          )}

          {/* End session */}
          <button
            onClick={handleEndSession}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold tracking-widest text-red-400 uppercase transition-all hover:bg-red-500/20"
          >
            <PhoneOff className="h-3.5 w-3.5" strokeWidth={1.5} /> End
          </button>
        </div>
      </header>

      {/* Participant status bar */}
      <div className="relative z-10 flex shrink-0 items-center gap-4 border-b border-white/[0.04] px-4 py-2 md:px-6" style={{ background: 'rgba(8,10,12,0.72)' }}>
        <ParticipantBadge name={coachName} role="Coach" connected={participants.some((p) => p.role === 'coach')} muted={false} speaking={false} />
        <ParticipantBadge name={studentName} role="Student" connected={participants.some((p) => p.role === 'student')} muted={false} speaking={false} />
        <div className="ml-auto flex items-center gap-2">
          {micError && (
            <span className="flex items-center gap-1 text-[9px] text-amber-400/70">
              <AlertCircle className="h-3 w-3" /> Mic: {micError}
            </span>
          )}
          <span className="text-[9px] font-mono text-white/30">
            {session?.rtcProvider === 'livekit' ? 'LiveKit connected' : 'Local audio mode'}
          </span>
        </div>
      </div>

      {/* View tabs (mobile-first) */}
      <div className="relative z-10 flex shrink-0 items-center gap-1 border-b border-white/[0.04] px-4 py-1.5 md:px-6" style={{ background: 'rgba(8,10,12,0.5)' }}>
        {([
          { id: 'call', label: 'Call', icon: Mic },
          { id: 'hands', label: 'Hands', icon: Hand },
          { id: 'notes', label: 'Notes', icon: FileText },
          { id: 'timeline', label: 'Timeline', icon: Clock },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-bold tracking-wide uppercase transition-all ${view === t.id ? 'bg-[#c0911e]/15 text-[#f5e6b0]' : 'text-white/40 hover:text-white/60'}`}
          >
            <t.icon className="h-3 w-3" strokeWidth={1.5} /> {t.label}
            {t.id === 'hands' && markedHands.length > 0 && (
              <span className="ml-0.5 rounded bg-[#c0911e]/20 px-1 text-[8px] text-[#f5e6b0]">{markedHands.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="relative z-10 min-h-0 flex-1 overflow-hidden p-3 md:p-4">
        {/* Call view */}
        {view === 'call' && (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            {/* Mic controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={toggleMute}
                className={`flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all ${muted ? 'border-red-500/40 bg-red-500/10' : 'border-[#c0911e]/40 bg-[#c0911e]/10'}`}
              >
                {muted ? <MicOff className="h-7 w-7 text-red-400" strokeWidth={1.5} /> : <Mic className="h-7 w-7" style={{ color: GOLD }} strokeWidth={1.5} />}
              </button>
            </div>
            <div className="text-center">
              <p className="text-[12px] font-semibold text-white/60">{muted ? 'Microphone muted' : 'Microphone active'}</p>
              <p className="mt-1 text-[10px] text-white/30">{micError ? 'Mic access needed — check browser permissions' : 'Speak freely — your coach can hear you'}</p>
            </div>

            {/* Recording consent */}
            {recordingState === 'none' && (
              <button
                onClick={handleRequestRecording}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[11px] font-semibold text-white/60 transition-all hover:border-white/20 hover:text-white"
              >
                <Radio className="h-4 w-4" strokeWidth={1.5} /> Record Session
              </button>
            )}

            {recordingState === 'pending_consent' && (
              <div className="max-w-md rounded-xl border p-4" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
                <p className="text-[11px] leading-relaxed text-white/60">
                  This coaching session will be recorded and stored in SpotVault. The recording may be used to generate a transcript and coaching summary.
                </p>
                <div className="mt-2 flex items-center gap-2 text-[9px]">
                  <ConsentPill label="You" consented={myConsent} />
                  <ConsentPill label="Other" consented={otherConsent} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button onClick={handleAgreeToRecording} className="flex-1 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-3 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase hover:bg-[#c0911e]/25">
                    Agree to Recording
                  </button>
                  <button onClick={handleDeclineRecording} className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:bg-white/10">
                    Continue Without Recording
                  </button>
                </div>
                {!myConsent && !otherConsent && (
                  <p className="mt-2 text-[9px] text-white/30">Recording begins after both participants consent.</p>
                )}
                {myConsent && !otherConsent && (
                  <p className="mt-2 text-[9px] text-amber-400/60">Waiting for other participant to consent...</p>
                )}
              </div>
            )}

            {recordingState === 'declined' && (
              <p className="text-[10px] text-white/35">Recording declined. Live audio continues.</p>
            )}

            {isRecording && (
              <p className="text-[10px] text-red-400/70">Recording in progress. Both participants can see the indicator.</p>
            )}
          </div>
        )}

        {/* Hands view */}
        {view === 'hands' && (
          <div className="h-full overflow-hidden">
            {reviewingHand ? (
              <div className="flex h-full flex-col">
                <div className="mb-2 flex items-center gap-2">
                  <button onClick={() => setReviewingHand(null)} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-white/60 hover:text-white">
                    <X className="h-3 w-3" /> Back to Sorter
                  </button>
                  <button
                    onClick={() => handleMarkHand(reviewingHand.handId || '')}
                    className="flex items-center gap-1.5 rounded-md border border-[#c0911e]/30 bg-[#c0911e]/10 px-2.5 py-1 text-[10px] font-bold text-[#d4a52c] hover:bg-[#c0911e]/20"
                  >
                    <Hand className="h-3 w-3" /> Mark for Session
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto rounded-lg border p-3" style={{ borderColor: PANEL_BORDER, background: 'rgba(8,10,12,0.95)' }}>
                  <HHReplayer hand={reviewingHand} variant="full" />
                </div>
              </div>
            ) : reviewLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: GOLD }} strokeWidth={1.5} />
              </div>
            ) : (
              <div className="h-full overflow-hidden">
                <HandSorter
                  userId={userRole === 'coach' ? session?.studentId || '' : userId}
                  mode={userRole}
                  title={userRole === 'coach' ? `${studentName}'s Hands` : 'My Hands'}
                />
              </div>
            )}
          </div>
        )}

        {/* Notes view */}
        {view === 'notes' && (
          <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-2xl space-y-4">
              {/* Coach notes */}
              <div className="rounded-xl border p-4" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
                    <span className="text-[10px] font-bold tracking-widest text-white/60 uppercase">Coach Notes</span>
                  </div>
                  {userRole === 'coach' && (
                    <label className="flex items-center gap-1.5 text-[9px] text-white/40">
                      <input
                        type="checkbox"
                        checked={noteShared}
                        onChange={async (e) => {
                          setNoteShared(e.target.checked);
                          if (session) await shareNote(session.sessionId, userId, e.target.checked);
                        }}
                        className="accent-[#c0911e]"
                      />
                      Share with student
                    </label>
                  )}
                </div>
                <textarea
                  value={coachNote}
                  onChange={(e) => {
                    setCoachNote(e.target.value);
                    if (userRole === 'coach') scheduleNoteSave(e.target.value, 'coach');
                  }}
                  disabled={userRole !== 'coach'}
                  rows={8}
                  placeholder={userRole === 'coach' ? 'Write session notes...' : 'Coach notes will appear here when shared'}
                  className="w-full resize-none rounded-lg border border-white/10 bg-[#0a0c0e] px-3 py-2.5 text-[12px] leading-relaxed text-white/80 outline-none focus:border-[#c0911e]/40 disabled:opacity-50"
                />
              </div>

              {/* Student notes */}
              <div className="rounded-xl border p-4" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} />
                  <span className="text-[10px] font-bold tracking-widest text-white/60 uppercase">Student Notes (Private)</span>
                </div>
                <textarea
                  value={studentNote}
                  onChange={(e) => {
                    setStudentNote(e.target.value);
                    if (userRole === 'student') scheduleNoteSave(e.target.value, 'student');
                  }}
                  disabled={userRole !== 'student'}
                  rows={6}
                  placeholder={userRole === 'student' ? 'Your private session notes...' : 'Student private notes'}
                  className="w-full resize-none rounded-lg border border-white/10 bg-[#0a0c0e] px-3 py-2.5 text-[12px] leading-relaxed text-white/80 outline-none focus:border-[#c0911e]/40 disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {/* Timeline view */}
        {view === 'timeline' && (
          <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-2xl">
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
                <span className="text-[10px] font-bold tracking-widest text-white/60 uppercase">Session Timeline</span>
              </div>
              {events.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-white/30">No events yet. Events will appear as the session progresses.</p>
              ) : (
                <div className="space-y-1">
                  {events.map((evt) => (
                    <div key={evt.id} className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                      <span className="shrink-0 font-mono text-[10px] font-bold text-[#d4a52c]/70">{formatEventTimestamp(evt.session_timestamp)}</span>
                      <span className="text-[11px] text-white/60">
                        {EVENT_LABELS[evt.event_type] || evt.event_type.replace(/_/g, ' ')}
                        {evt.hand_id && <span className="ml-1 font-mono text-white/35">— {evt.hand_id}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = {
  session_started: 'Session started',
  session_ended: 'Session ended',
  participant_joined: 'Participant joined',
  hand_sorter_opened: 'Hand Sorter opened',
  filter_applied: 'Filter applied',
  hand_opened: 'Hand opened',
  hand_marked: 'Hand marked for session',
  note_added: 'Session note added',
  recording_started: 'Recording started',
  recording_stopped: 'Recording stopped',
  recording_consent_given: 'Recording consent given',
};

function ParticipantBadge({ name, role, connected, muted, speaking }: { name: string; role: string; connected: boolean; muted: boolean; speaking: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold ${connected ? 'border-[#c0911e]/30 bg-[#c0911e]/10 text-[#d4a52c]' : 'border-white/10 bg-white/5 text-white/30'}`}>
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <div className="text-[10px] font-semibold text-white/70">{name}</div>
        <div className="flex items-center gap-1 text-[8px]">
          <span className={connected ? 'text-emerald-400' : 'text-white/30'}>
            {connected ? '● Connected' : '○ Not joined'}
          </span>
          {muted && <span className="text-red-400">· Muted</span>}
          {speaking && <span className="text-[#d4a52c]">· Speaking</span>}
        </div>
      </div>
      <span className="ml-1 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[7px] font-bold tracking-widest text-white/40 uppercase">{role}</span>
    </div>
  );
}

function ConsentPill({ label, consented }: { label: string; consented: boolean }) {
  return (
    <span className={`rounded-full px-2 py-0.5 font-bold ${consented ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/30'}`}>
      {label}: {consented ? 'Agreed' : 'Pending'}
    </span>
  );
}
