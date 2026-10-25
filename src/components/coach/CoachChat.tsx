import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import {
  Send, Paperclip, ArrowLeft, Info, Users, Search,
  Circle, Clock, FileText, TrendingUp, Calendar,
  type LucideIcon,
} from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { COACH_STUDENTS, type CoachStudent } from '@/data/coach';
import { usePersistentState } from '@/hooks/usePersistentState';
import { supabase } from '@/lib/supabase';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

interface InboxMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read: boolean;
  created_at: string;
}

interface StudentRow {
  student_id: string;
  student_name: string | null;
  student_username: string | null;
  student_email: string | null;
  status: string;
  created_at: string;
}

interface DemoConversation {
  messages: DemoMessage[];
  unread: number;
}

interface DemoMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

type MobileView = 'list' | 'chat' | 'details';

export function CoachChat({ coachId, demoMode }: { coachId: string; demoMode: boolean }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<MobileView>('list');
  const [realStudents, setRealStudents] = useState<StudentRow[]>([]);
  const [realLoading, setRealLoading] = useState(true);
  const [realMessages, setRealMessages] = useState<InboxMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [demoConversations, setDemoConversations] = usePersistentState<Record<string, DemoConversation>>('coach-chat-demo', {});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const demo = demoMode;

  useEffect(() => {
    if (demo) {
      setRealLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setRealLoading(true);
      try {
        const { data, error } = await supabase.rpc('sv_get_coach_students');
        if (error) throw error;
        if (!cancelled) setRealStudents((data as StudentRow[]) ?? []);
      } catch {
        if (!cancelled) setRealStudents([]);
      } finally {
        if (!cancelled) setRealLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [demo]);

  const students = demo
    ? COACH_STUDENTS.map((s) => ({
        student_id: s.id,
        student_name: s.name,
        student_username: s.username,
        student_email: null,
        status: s.status === 'active' ? 'active' : 'pending',
        created_at: new Date().toISOString(),
      }))
    : realStudents;

  const filteredStudents = students.filter((s) => {
    if (!searchQuery) return true;
    const name = (s.student_name ?? '').toLowerCase();
    const username = (s.student_username ?? '').toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || username.includes(searchQuery.toLowerCase());
  });

  const activeStudent = students.find((s) => s.student_id === activeStudentId) ?? null;
  const activeStudentProfile: CoachStudent | null = demo
    ? COACH_STUDENTS.find((s) => s.id === activeStudentId) ?? null
    : null;

  // Load real messages when a real student is selected
  useEffect(() => {
    if (demo || !activeStudentId) return;
    let cancelled = false;
    setRealMessages([]);
    setConversationId(null);

    (async () => {
      try {
        const { data: convId, error: convError } = await supabase.rpc('get_or_create_conversation', {
          other_user_id: activeStudentId,
        });
        if (convError) throw convError;
        if (cancelled || !convId) return;
        setConversationId(convId as string);

        const { data: msgs, error: msgError } = await supabase
          .from('user_inbox_messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true })
          .limit(100);
        if (msgError) throw msgError;
        if (!cancelled) setRealMessages((msgs as InboxMessage[]) ?? []);
      } catch {
        // silently fail — empty state will show
      }
    })();

    return () => { cancelled = true; };
  }, [demo, activeStudentId]);

  // Realtime subscription for real messages
  useEffect(() => {
    if (demo || !conversationId) return;
    const channel = supabase
      .channel(`coach-chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_inbox_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setRealMessages((prev) => [...prev, payload.new as InboxMessage]);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [demo, conversationId]);

  const messages: DemoMessage[] = demo && activeStudentId
    ? (demoConversations[activeStudentId]?.messages ?? [])
    : !demo
      ? realMessages.map((m) => ({
          id: m.id,
          sender_id: m.sender_id,
          body: m.body,
          created_at: m.created_at,
        }))
      : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const body = messageText.trim();
    if (!body || !activeStudentId) return;

    if (demo) {
      const msg: DemoMessage = {
        id: `dm-${Date.now()}`,
        sender_id: coachId,
        body,
        created_at: new Date().toISOString(),
      };
      setDemoConversations((prev) => ({
        ...prev,
        [activeStudentId]: {
          messages: [...(prev[activeStudentId]?.messages ?? []), msg],
          unread: 0,
        },
      }));
    } else if (conversationId) {
      supabase
        .from('user_inbox_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: coachId,
          body,
          read: false,
        })
        .then(() => {});
    }
    setMessageText('');
  }, [messageText, activeStudentId, coachId, demo, conversationId, setDemoConversations]);

  const handleSelectStudent = (studentId: string) => {
    setActiveStudentId(studentId);
    setMobileView('chat');
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ── EMPTY STATE (no students) ──────────────────────────────
  if (!realLoading && students.length === 0) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl border border-[#c0911e]/15 bg-black/50 p-8 text-center backdrop-blur-md">
          <Users className="mx-auto h-8 w-8 text-[#d4a52c]/60" strokeWidth={1.5} />
          <h3 className="mt-3 text-sm font-bold text-white">No students connected yet</h3>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">
            Students you coach will appear here once their coaching relationship is active.
            Use Coach Center to review applications and connect with new students.
          </p>
        </div>
      </div>
    );
  }

  // ── STUDENT LIST (left column / mobile list view) ──────────
  const studentList = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/[0.06] bg-black/40 px-4 py-3 backdrop-blur-md">
        <div className="mb-2 flex items-center gap-2">
          <Users className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
          <span className="text-[10px] font-bold tracking-widest text-white/70 uppercase">Students</span>
          <span className="ml-auto rounded-full bg-[#d4a52c]/15 px-2 py-0.5 text-[9px] font-bold text-[#d4a52c]">{students.length}</span>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
          <Search className="h-3 w-3 text-white/35" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full bg-transparent text-[10px] text-white outline-none placeholder:text-white/25"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {realLoading ? (
          <div className="p-6 text-center text-[10px] text-white/30">Loading...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-6 text-center text-[10px] text-white/30">No students match.</div>
        ) : (
          filteredStudents.map((s) => {
            const lastMsg = demo
              ? (demoConversations[s.student_id]?.messages ?? []).slice(-1)[0]
              : realMessages.filter((m) => m.conversation_id === conversationId).slice(-1)[0];
            const isActive = s.student_id === activeStudentId;
            return (
              <button
                key={s.student_id}
                onClick={() => handleSelectStudent(s.student_id)}
                className={`flex w-full items-center gap-3 border-b border-white/[0.04] px-4 py-3 text-left transition ${isActive ? 'bg-[#d4a52c]/10' : 'hover:bg-white/[0.03]'}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#c0911e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-[10px] font-bold text-[#d4a52c]">
                  {(s.student_name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold text-white">{s.student_name ?? 'Unknown'}</div>
                  <div className="truncate text-[9px] text-white/40">
                    {lastMsg ? lastMsg.body : `@${s.student_username ?? 'unknown'}`}
                  </div>
                </div>
                {s.status === 'active' && <Circle className="h-2 w-2 shrink-0 fill-emerald-400 text-emerald-400" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // ── CHAT (center column / mobile chat view) ─────────────────
  const chatPanel = (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-white/[0.06] bg-black/40 px-4 py-3 backdrop-blur-md">
        {!isDesktop && mobileView === 'chat' && (
          <button onClick={() => setMobileView('list')} className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#c0911e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-[10px] font-bold text-[#d4a52c]">
          {(activeStudent?.student_name ?? '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-bold text-white">{activeStudent?.student_name ?? 'Select a student'}</div>
          <div className="truncate text-[9px] text-white/40">
            {activeStudent?.status === 'active' ? 'Connected' : 'Pending'}
          </div>
        </div>
        {!isDesktop && mobileView === 'chat' && activeStudent && (
          <button onClick={() => setMobileView('details')} className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white">
            <Info className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {!activeStudent ? (
          <div className="flex h-full items-center justify-center text-[10px] text-white/30">
            Select a student to start chatting
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[10px] text-white/30">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === coachId;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                    isMine
                      ? 'bg-[#d4a52c]/20 text-[#f5e6b0]'
                      : 'border border-white/[0.06] bg-white/[0.04] text-white/80'
                  }`}
                >
                  <p>{msg.body}</p>
                  <div className={`mt-0.5 text-[8px] ${isMine ? 'text-[#d4a52c]/60' : 'text-white/30'}`}>
                    {formatTime(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-white/[0.06] bg-black/40 p-3 backdrop-blur-md">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <button className="text-white/30 hover:text-white/60" disabled>
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={activeStudent ? 'Message your student...' : 'Select a student first'}
            disabled={!activeStudent}
            className="w-full bg-transparent text-[11px] text-white outline-none placeholder:text-white/25 disabled:opacity-40"
          />
          <button
            onClick={handleSend}
            disabled={!activeStudent || !messageText.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/15 px-3 py-1.5 text-[9px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#d4a52c]/25 disabled:opacity-30"
          >
            <Send className="h-3 w-3" />Send
          </button>
        </div>
      </div>
    </div>
  );

  // ── STUDENT CONTEXT (right column / mobile details view) ───
  const detailsPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/[0.06] bg-black/40 px-4 py-3 backdrop-blur-md">
        {!isDesktop && mobileView === 'details' && (
          <button onClick={() => setMobileView('chat')} className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <span className="text-[10px] font-bold tracking-widest text-white/70 uppercase">Student Context</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!activeStudent ? (
          <div className="text-center text-[10px] text-white/30">Select a student to view context</div>
        ) : (
          <div className="space-y-4">
            {/* Profile summary */}
            <div className="rounded-xl border border-white/[0.06] bg-black/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#c0911e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-sm font-bold text-[#d4a52c]">
                  {(activeStudent.student_name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-[12px] font-bold text-white">{activeStudent.student_name ?? 'Unknown'}</div>
                  <div className="text-[10px] text-white/40">@{activeStudent.student_username ?? 'unknown'}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Circle className={`h-2 w-2 ${activeStudent.status === 'active' ? 'fill-emerald-400 text-emerald-400' : 'fill-amber-400 text-amber-400'}`} />
                    <span className="text-[9px] text-white/50">{activeStudent.status === 'active' ? 'Active' : 'Pending'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Demo student context (rich data from mock dataset) */}
            {demo && activeStudentProfile ? (
              <>
                <ContextSection icon={TrendingUp} label="Recent Performance">
                  <StatRow label="ROI" value={`${activeStudentProfile.roi}%`} accent />
                  <StatRow label="Game" value={activeStudentProfile.gameType} />
                  <StatRow label="Stakes" value={activeStudentProfile.stakes} />
                  <StatRow label="Trend" value={activeStudentProfile.trend} />
                </ContextSection>

                <ContextSection icon={Calendar} label="Upcoming Sessions">
                  {activeStudentProfile.sessions.filter((s) => s.status === 'upcoming').length === 0 ? (
                    <p className="text-[10px] text-white/30">No upcoming sessions.</p>
                  ) : (
                    activeStudentProfile.sessions.filter((s) => s.status === 'upcoming').slice(0, 3).map((s) => (
                      <div key={s.id} className="border-b border-white/[0.04] py-1.5 last:border-0">
                        <div className="text-[10px] font-semibold text-white/80">{s.topic}</div>
                        <div className="text-[9px] text-white/40">{s.date} · {s.timeStart} · {s.durationMinutes}min</div>
                      </div>
                    ))
                  )}
                </ContextSection>

                <ContextSection icon={FileText} label="Recent Hands">
                  {activeStudentProfile.hands.length === 0 ? (
                    <p className="text-[10px] text-white/30">No hands submitted.</p>
                  ) : (
                    activeStudentProfile.hands.slice(0, 3).map((h) => (
                      <div key={h.id} className="flex items-center justify-between border-b border-white/[0.04] py-1.5 last:border-0">
                        <div className="text-[10px] text-white/70">{h.title}</div>
                        <span className={`text-[8px] font-bold uppercase ${h.markedAs === 'needs_review' ? 'text-amber-300' : 'text-emerald-300'}`}>
                          {h.markedAs === 'needs_review' ? 'Review' : 'Reviewed'}
                        </span>
                      </div>
                    ))
                  )}
                </ContextSection>

                <ContextSection icon={Clock} label="Coaching Notes">
                  {activeStudentProfile.notes.length === 0 ? (
                    <p className="text-[10px] text-white/30">No notes yet.</p>
                  ) : (
                    activeStudentProfile.notes.slice(0, 2).map((n) => (
                      <div key={n.id} className="border-b border-white/[0.04] py-1.5 last:border-0">
                        <div className="text-[10px] text-white/70">{n.text}</div>
                        <div className="text-[8px] text-white/30">{n.visibility} · {formatDate(n.createdAt)}</div>
                      </div>
                    ))
                  )}
                </ContextSection>
              </>
            ) : (
              <ContextSection icon={Info} label="Account Info">
                <StatRow label="Student ID" value={activeStudent.student_id} />
                <StatRow label="Email" value={activeStudent.student_email ?? 'Not available'} />
                <StatRow label="Connected" value={formatDate(activeStudent.created_at)} />
              </ContextSection>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ── Layout ──────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div className="grid h-full min-h-[500px] grid-cols-[260px_1fr_280px] overflow-hidden rounded-xl border border-white/[0.06] bg-black/40 backdrop-blur-md">
        {studentList}
        <div className="border-x border-white/[0.06]">{chatPanel}</div>
        {detailsPanel}
      </div>
    );
  }

  // Mobile: sequential views
  return (
    <div className="h-full min-h-[500px] overflow-hidden rounded-xl border border-white/[0.06] bg-black/40 backdrop-blur-md">
      {mobileView === 'list' && studentList}
      {mobileView === 'chat' && chatPanel}
      {mobileView === 'details' && detailsPanel}
    </div>
  );
}

function ContextSection({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-[#d4a52c]" strokeWidth={1.5} />
        <span className="text-[9px] font-bold tracking-widest text-white/50 uppercase">{label}</span>
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-1.5 last:border-0">
      <span className="text-[9px] text-white/40">{label}</span>
      <span className={`text-[10px] font-semibold ${accent ? 'text-[#d4a52c]' : 'text-white/80'}`}>{value}</span>
    </div>
  );
}
