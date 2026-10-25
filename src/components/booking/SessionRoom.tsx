import { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, ShieldCheck, Calendar, Clock, Video, Mic, MicOff,
  Camera, CameraOff, Monitor, MessageSquare, Paperclip, Fullscreen,
  PhoneOff, Send, FileText, BarChart3, Layers, BookOpen, StickyNote,
  Play, ChevronRight, X,
} from 'lucide-react';
import type { Booking, TalentProfile } from '@/data/talent';
import { SERVICE_TYPE_LABELS } from '@/data/talent';

interface Props {
  booking: Booking;
  talent: TalentProfile;
  onBack: () => void;
}

type ChatMessage = {
  id: string;
  author: 'buyer' | 'talent';
  text: string;
  time: string;
  attachment?: { type: 'image' | 'hand' | 'spot' | 'doc' | 'link'; label: string };
};

type WorkspacePanel = 'replayer' | 'saved' | 'analytics' | 'charts' | 'spots' | 'courses' | 'notes' | null;

export function SessionRoom({ booking, talent, onBack }: Props) {
  const [activeView, setActiveView] = useState<'chat' | 'video' | 'workspace'>('chat');
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [workspacePanel, setWorkspacePanel] = useState<WorkspacePanel>('replayer');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'm1', author: 'talent', text: 'Looking forward to our session! Feel free to share any hands you want to review beforehand.', time: '10:32 AM' },
    { id: 'm2', author: 'buyer', text: 'Thanks! I have a few PLO hands that I am unsure about.', time: '10:35 AM' },
    { id: 'm3', author: 'talent', text: 'Perfect, upload them here and I will take a look before we start.', time: '10:36 AM' },
  ]);
  const [input, setInput] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((m) => [...m, {
      id: `m${Date.now()}`,
      author: 'buyer',
      text: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setInput('');
  };

  const addAttachment = (type: ChatMessage['attachment']['type'], label: string) => {
    setMessages((m) => [...m, {
      id: `m${Date.now()}`,
      author: 'buyer',
      text: `Shared a ${type === 'hand' ? 'hand history' : type === 'spot' ? 'SpotVault Spot' : type === 'doc' ? 'document' : type === 'link' ? 'link' : 'file'}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment: { type, label },
    }]);
  };

  const sessionDate = new Date(`${booking.date}T${booking.timeStart}`);
  const now = new Date();
  const isUpcoming = sessionDate.getTime() > now.getTime();
  const msUntil = sessionDate.getTime() - now.getTime();
  const hoursUntil = Math.max(0, Math.floor(msUntil / (1000 * 60 * 60)));
  const minsUntil = Math.max(0, Math.floor((msUntil % (1000 * 60 * 60)) / (1000 * 60)));
  const secsUntil = Math.max(0, Math.floor((msUntil % (1000 * 60)) / 1000));
  const canJoin = msUntil <= 10 * 60 * 1000 && booking.status !== 'CANCELLED';

  return (
    <div className="flex h-full flex-col bg-[#050608]">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#1a1f25] bg-[#0a0c0e]/60 px-6 py-3">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-2 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-[0.3em] text-[#d4a52c]/70 uppercase">Private Session</span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase ${
                booking.status === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-300' :
                booking.status === 'CANCELLED' ? 'bg-red-500/15 text-red-300' :
                isUpcoming ? 'bg-[#d4a52c]/15 text-[#d4a52c]' :
                'bg-blue-500/15 text-blue-300'
              }`}>
                {booking.status}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-sm font-bold text-white">{talent.name}</span>
              <span className="text-[#5f6e7c]">↔</span>
              <span className="text-sm font-bold text-white">{booking.buyerName}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Booked</div>
            <div className="text-xs font-medium text-[#aab6c2]">{booking.serviceName}</div>
          </div>
          <div>
            <div className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Session</div>
            <div className="text-xs font-medium text-[#aab6c2]">{booking.date} · {booking.timeStart}</div>
          </div>
        </div>
      </header>

      {/* View tabs */}
      <div className="flex shrink-0 gap-1 border-b border-[#1a1f25] px-6">
        {(['chat', 'video', 'workspace'] as const).map((view) => (
          <button
            key={view}
            onClick={() => { setActiveView(view); if (view === 'workspace') setShowWorkspace(true); }}
            className={`px-4 py-2.5 text-[11px] font-semibold tracking-widest uppercase transition-all ${
              activeView === view
                ? 'border-b-2 border-[#d4a52c] text-[#d4a52c]'
                : 'text-[#5f6e7c] hover:text-[#aab6c2]'
            }`}
          >
            {view === 'chat' && <MessageSquare className="mr-1.5 inline h-3.5 w-3.5" />}
            {view === 'video' && <Video className="mr-1.5 inline h-3.5 w-3.5" />}
            {view === 'workspace' && <Layers className="mr-1.5 inline h-3.5 w-3.5" />}
            {view}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Chat View */}
        {activeView === 'chat' && (
          <div className="flex h-full flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
              <div className="mx-auto max-w-3xl space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.author === 'buyer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      msg.author === 'buyer'
                        ? 'bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/10 border border-[#c0911e]/30 text-[#f5e6b0]'
                        : 'bg-[#11151a] border border-[#232a32] text-[#c7cfd8]'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                      {msg.attachment && (
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#1a1f25] bg-[#0a0c0e]/50 px-3 py-2">
                          {msg.attachment.type === 'hand' && <Play className="h-3.5 w-3.5 text-[#d4a52c]" />}
                          {msg.attachment.type === 'image' && <Camera className="h-3.5 w-3.5 text-[#aab6c2]" />}
                          {msg.attachment.type === 'doc' && <FileText className="h-3.5 w-3.5 text-[#aab6c2]" />}
                          {msg.attachment.type === 'link' && <ChevronRight className="h-3.5 w-3.5 text-[#aab6c2]" />}
                          <span className="text-xs text-[#aab6c2]">{msg.attachment.label}</span>
                        </div>
                      )}
                      <div className={`mt-1 text-[10px] ${msg.author === 'buyer' ? 'text-[#835e17]' : 'text-[#475565]'}`}>{msg.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Input */}
            <div className="shrink-0 border-t border-[#1a1f25] bg-[#0a0c0e]/60 p-4">
              <div className="mx-auto max-w-3xl">
                <div className="flex items-center gap-2">
                  <button onClick={() => addAttachment('image', 'screenshot.png')} className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#aab6c2] transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]" title="Upload image">
                    <Camera className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <button onClick={() => addAttachment('hand', 'Hand #12345')} className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#aab6c2] transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]" title="Attach hand history">
                    <Play className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <button onClick={() => addAttachment('spot', 'Spot: BTN vs BB')} className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#aab6c2] transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]" title="Attach SpotVault Spot">
                    <Layers className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <button onClick={() => addAttachment('doc', 'document.pdf')} className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#aab6c2] transition-all hover:border-[#c0911e]/40 hover:text-[#d4a52c]" title="Attach document">
                    <Paperclip className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg border border-[#232a32] bg-[#11151a] px-4 py-2.5 text-sm text-white placeholder-[#475565] focus:border-[#c0911e]/40 focus:outline-none"
                  />
                  <button onClick={sendMessage} className="rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 p-2.5 text-[#d4a52c] transition-all hover:gold-glow">
                    <Send className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-[#475565]">Chat available before, during, and after session. Post-session chat expires {talent.postSessionChatDays} days after completion.</p>
              </div>
            </div>
          </div>
        )}

        {/* Video View */}
        {activeView === 'video' && (
          <div className="flex h-full flex-col">
            <div className="flex flex-1 items-center justify-center gap-4 p-6">
              {/* Buyer video */}
              <div className="relative flex h-full max-h-[400px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-[#232a32] bg-[#0a0c0e]">
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#232a32] bg-[#161b21] text-lg font-bold text-[#aab6c2]">
                    {booking.buyerName.charAt(0)}
                  </div>
                  <p className="mt-3 text-xs text-[#5f6e7c]">{booking.buyerName}</p>
                </div>
                <div className="absolute left-3 top-3 rounded-lg border border-[#232a32] bg-[#0a0c0e]/80 px-2.5 py-1 text-[10px] font-mono tracking-widest text-[#aab6c2] uppercase backdrop-blur">
                  You
                </div>
                {!cameraOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0a0c0e]/90">
                    <CameraOff className="h-8 w-8 text-[#5f6e7c]" />
                  </div>
                )}
              </div>

              {/* Talent video */}
              <div className="relative flex h-full max-h-[400px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-[#c0911e]/30 bg-[#0a0c0e]">
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-lg font-bold text-[#d4a52c]">
                    {talent.photoInitials}
                  </div>
                  <p className="mt-3 text-xs text-[#aab6c2]">{talent.name}</p>
                </div>
                <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#0a0c0e]/80 px-2.5 py-1 backdrop-blur">
                  <ShieldCheck className="h-3 w-3 text-[#d4a52c]" />
                  <span className="text-[10px] font-mono tracking-widest text-[#d4a52c] uppercase">Talent</span>
                </div>
              </div>
            </div>

            {/* Join / countdown */}
            {isUpcoming && !canJoin && (
              <div className="shrink-0 border-t border-[#1a1f25] bg-[#0a0c0e]/60 p-4">
                <div className="mx-auto flex max-w-2xl items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Session Opens In</div>
                    <div className="font-mono text-2xl font-bold text-[#d4a52c]">
                      {String(hoursUntil).padStart(2, '0')}:{String(minsUntil).padStart(2, '0')}:{String(secsUntil).padStart(2, '0')}
                    </div>
                  </div>
                  <button disabled className="flex items-center gap-2 rounded-lg border border-[#232a32] bg-[#161b21] px-6 py-3 text-sm font-bold tracking-widest text-[#475565] uppercase cursor-not-allowed">
                    <Video className="h-4 w-4" /> Join Video Session
                  </button>
                </div>
              </div>
            )}

            {/* Controls */}
            {canJoin && (
              <div className="shrink-0 border-t border-[#1a1f25] bg-[#0a0c0e]/60 p-4">
                <div className="mx-auto flex max-w-2xl items-center justify-center gap-2">
                  <CtrlButton icon={muted ? MicOff : Mic} label="Mute" active={muted} onClick={() => setMuted(!muted)} />
                  <CtrlButton icon={cameraOn ? Camera : CameraOff} label="Camera" active={!cameraOn} onClick={() => setCameraOn(!cameraOn)} />
                  <CtrlButton icon={Monitor} label="Share" active={screenSharing} onClick={() => setScreenSharing(!screenSharing)} />
                  <CtrlButton icon={MessageSquare} label="Chat" onClick={() => setActiveView('chat')} />
                  <CtrlButton icon={Paperclip} label="Files" onClick={() => setActiveView('chat')} />
                  <CtrlButton icon={Play} label="Open HH" onClick={() => { setActiveView('workspace'); setWorkspacePanel('replayer'); }} />
                  <CtrlButton icon={BarChart3} label="Analytics" onClick={() => { setActiveView('workspace'); setWorkspacePanel('analytics'); }} />
                  <CtrlButton icon={Fullscreen} label="Fullscreen" onClick={() => {}} />
                  <button className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-[10px] font-semibold tracking-widest text-red-300 uppercase transition-all hover:bg-red-500/25">
                    <PhoneOff className="h-4 w-4" strokeWidth={1.5} /> End
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Workspace View */}
        {activeView === 'workspace' && (
          <div className="flex h-full">
            {/* Left 35%: Video participants */}
            <div className="flex w-[35%] flex-col border-r border-[#1a1f25] bg-[#0a0c0e]">
              <div className="shrink-0 border-b border-[#1a1f25] px-4 py-3">
                <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">
                  <Video className="h-3.5 w-3.5" /> Video Participants
                </div>
              </div>
              <div className="flex-1 space-y-3 p-4">
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-[#232a32] bg-[#0a0c0e]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#232a32] bg-[#161b21] text-xs font-bold text-[#aab6c2]">
                    {booking.buyerName.charAt(0)}
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 text-[9px] font-mono text-[#aab6c2]">{booking.buyerName}</div>
                </div>
                <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-[#c0911e]/30 bg-[#0a0c0e]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-xs font-bold text-[#d4a52c]">
                    {talent.photoInitials}
                  </div>
                  <div className="absolute bottom-1.5 left-1.5 text-[9px] font-mono text-[#d4a52c]">{talent.name}</div>
                </div>
              </div>
              <div className="shrink-0 border-t border-[#1a1f25] p-3">
                <div className="flex items-center justify-center gap-1.5">
                  <button onClick={() => setMuted(!muted)} className={`rounded-lg border p-2 ${muted ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-[#232a32] bg-[#161b21] text-[#aab6c2]'}`}>
                    {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => setCameraOn(!cameraOn)} className={`rounded-lg border p-2 ${!cameraOn ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-[#232a32] bg-[#161b21] text-[#aab6c2]'}`}>
                    {cameraOn ? <Camera className="h-3.5 w-3.5" /> : <CameraOff className="h-3.5 w-3.5" />}
                  </button>
                  <button className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-300">
                    <PhoneOff className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right 65%: Shared workspace */}
            <div className="flex flex-1 flex-col">
              <div className="shrink-0 border-b border-[#1a1f25] px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">
                    <Layers className="h-3.5 w-3.5 text-[#d4a52c]" /> Shared SpotVault Workspace
                  </div>
                  <button onClick={() => setActiveView('video')} className="flex items-center gap-1 text-[10px] font-semibold tracking-widest text-[#5f6e7c] uppercase hover:text-[#aab6c2]">
                    <X className="h-3 w-3" /> Close
                  </button>
                </div>
              </div>
              {/* Workspace tabs */}
              <div className="shrink-0 flex gap-1 border-b border-[#1a1f25] px-4">
                {([
                  { id: 'replayer', label: 'HH Replayer', icon: Play },
                  { id: 'saved', label: 'Saved Hands', icon: Layers },
                  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                  { id: 'charts', label: 'Charts', icon: BarChart3 },
                  { id: 'spots', label: 'Spots', icon: Layers },
                  { id: 'courses', label: 'Courses', icon: BookOpen },
                  { id: 'notes', label: 'Notes', icon: StickyNote },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setWorkspacePanel(tab.id as WorkspacePanel)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold tracking-widest uppercase transition-all ${
                      workspacePanel === tab.id
                        ? 'border-b-2 border-[#d4a52c] text-[#d4a52c]'
                        : 'text-[#5f6e7c] hover:text-[#aab6c2]'
                    }`}
                  >
                    <tab.icon className="h-3 w-3" /> {tab.label}
                  </button>
                ))}
              </div>
              {/* Workspace content */}
              <div className="flex-1 overflow-y-auto p-6">
                <WorkspaceContent panel={workspacePanel} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CtrlButton({ icon: Icon, label, active, onClick }: { icon: typeof Mic; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-all ${
        active
          ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#d4a52c]'
          : 'border-[#232a32] bg-[#161b21] text-[#aab6c2] hover:border-[#38424e] hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
      <span className="text-[9px] font-semibold tracking-widest uppercase">{label}</span>
    </button>
  );
}

function WorkspaceContent({ panel }: { panel: WorkspacePanel }) {
  if (panel === 'replayer') {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="metal-panel rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Hand History Replayer</div>
              <div className="text-sm font-bold text-white">Hand #12345 · PLO 5/10</div>
            </div>
            <button className="rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase">
              <Play className="mr-1 inline h-3 w-3" /> Play
            </button>
          </div>
          <div className="rounded-lg border border-[#1a1f25] bg-[#0a0c0e] p-6">
            <div className="mb-4 flex items-center justify-between text-xs">
              <span className="text-[#aab6c2]">Preflop</span>
              <span className="font-mono text-[#d4a52c]">Pot: $30</span>
            </div>
            <div className="flex justify-between">
              {['BTN', 'SB', 'BB', 'UTG', 'CO'].map((pos, i) => (
                <div key={pos} className={`flex flex-col items-center gap-1 ${i === 0 ? 'opacity-100' : 'opacity-50'}`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#232a32] bg-[#161b21] text-[10px] font-bold text-[#aab6c2]">{pos}</div>
                  {i === 0 && <div className="text-[9px] font-mono text-[#d4a52c]">Raise $30</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex justify-center gap-2">
            {[1,2,3,4].map((s) => (
              <div key={s} className={`h-1.5 w-8 rounded-full ${s === 1 ? 'bg-[#d4a52c]' : 'bg-[#232a32]'}`} />
            ))}
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] text-[#475565]">Both participants can view and interact with the shared replayer</p>
      </div>
    );
  }
  if (panel === 'analytics') {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="metal-panel rounded-xl p-5">
          <div className="mb-3 text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Session Analytics</div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'VPIP', value: '24.5%' },
              { label: 'PFR', value: '18.2%' },
              { label: '3-Bet', value: '8.1%' },
              { label: 'CBet', value: '62%' },
              { label: 'WTSD', value: '28%' },
              { label: 'W/R', value: '+4.2bb/100' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-[#1a1f25] bg-[#11151a]/50 p-3">
                <div className="text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">{stat.label}</div>
                <div className="mt-1 text-lg font-bold text-white">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (panel === 'notes') {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="metal-panel rounded-xl p-5">
          <div className="mb-3 text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Shared Notes</div>
          <textarea
            placeholder="Both participants can take notes here. Changes sync in real time..."
            className="h-48 w-full resize-none rounded-lg border border-[#232a32] bg-[#0a0c0e] p-3 text-sm text-white placeholder-[#475565] focus:border-[#c0911e]/40 focus:outline-none"
          />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <Layers className="mx-auto h-12 w-12 text-[#2a323b]" strokeWidth={1} />
        <p className="mt-3 text-sm text-[#5f6e7c]">Shared {panel} workspace</p>
        <p className="text-xs text-[#475565]">Both participants can view and interact</p>
      </div>
    </div>
  );
}
