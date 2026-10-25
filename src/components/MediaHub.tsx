import {
  Mic,
  Radio,
  FileText,
  Newspaper,
  Users,
  FolderOpen,
  ChevronRight,
  Clock,
  ArrowLeft,
  Video,
  ShieldCheck,
  Network as NetworkIcon,
  Menu,
  Bell,
  Contact,
} from 'lucide-react';
import type { Demo } from '@/useDemo';
import { UniversalNavSection } from '@/components/UniversalNavSection';
import type { UniversalView } from '@/components/UniversalRail';
import { FloatingChatWidget } from '@/components/shared/FloatingChatWidget';
import { useFloatingChat } from '@/hooks/useFloatingChat';
import type { ChannelDef } from '@/components/player/ChatPanel';
import { IndustryRolodex } from '@/components/professional/IndustryRolodex';
import { useState } from 'react';

interface Props {
  demo: Demo;
  onInnerCircle: () => void;
  onEnterRoom: () => void;
  onExitRoom: () => void;
  onPublish: () => void;
  onNetworkMap: () => void;
  onOpenUniversalView: (view: UniversalView) => void;
}

const MEDIA_NAV = [
  { icon: Radio, label: 'Interview Rooms', view: 'interview' },
  { icon: Contact, label: 'Rolodex', view: 'rolodex' },
  { icon: Users, label: 'Media Directory', view: 'directory' },
  { icon: FolderOpen, label: 'Drafts', view: 'drafts' },
  { icon: Newspaper, label: 'Industry News', view: 'news' },
  { icon: Mic, label: 'Collaborations', view: 'collab' },
];

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MediaHub({ demo, onInnerCircle, onEnterRoom, onExitRoom, onPublish, onNetworkMap, onOpenUniversalView }: Props) {
  const { state } = demo;
  const remaining = state.guestRemaining;
  const [mediaView, setMediaView] = useState<string>('interview');

  const MEDIA_CHANNELS: ChannelDef[] = [
    { id: 'general', label: 'General' },
    { id: 'network', label: 'Media Network' },
  ];
  const MEDIA_CHAT_CONFIG = {
    widgetId: 'media-chat',
    portalLabel: 'Media Hub',
    channels: MEDIA_CHANNELS,
    defaultPos: { x: 24, y: 70 },
    defaultSize: { width: 520, height: 460 },
  };
  const [chatState, chatActions] = useFloatingChat(demo.state.currentAccount?.id ?? null, MEDIA_CHAT_CONFIG, 15);

  if (state.inInterviewRoom) {
    return <InterviewRoom onExit={onExitRoom} onPublish={onPublish} published={state.interviewPublished} />;
  }

  return (
    <div className="relative h-full w-full bg-[#050608] p-4 lg:p-6">
      <div className="metal-frame brushed-metal clip-bevel relative flex h-full w-full flex-col overflow-hidden rounded-2xl">
        {/* Top bar */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#1a1f25] bg-[#0a0c0e]/60 px-6 py-3.5">
          <div className="flex items-center gap-4">
            <button className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#84929f] transition-all hover:border-[#38424e] hover:text-[#c7cfd8]">
              <Menu className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408]">
                <span className="text-[9px] font-bold tracking-widest text-[#d4a52c]">SV</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wide text-white">SpotVault</span>
                <span className="text-[9px] font-mono tracking-[0.2em] text-[#d4a52c]/70 uppercase">Poker Network</span>
              </div>
            </div>
            <button
              onClick={onNetworkMap}
              className="ml-2 flex items-center gap-1.5 rounded-lg border border-[#232a32] bg-[#161b21] px-2.5 py-1.5 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#38424e] hover:text-[#c7cfd8]"
            >
              <NetworkIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
              Network Map
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-[#c0911e]/40 bg-[#c0911e]/10 px-4 py-1.5">
              <Clock className="h-3.5 w-3.5 text-[#d4a52c]" strokeWidth={2} />
              <span className="text-[10px] font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase">
                Guest Access · {formatTime(remaining)}
              </span>
            </div>
            <button className="rounded-lg border border-[#232a32] bg-[#161b21] p-2 text-[#84929f] transition-all hover:border-[#38424e] hover:text-[#c7cfd8]">
              <Bell className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <div className="flex items-center gap-2.5 border-l border-[#1a1f25] pl-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-[11px] font-semibold text-[#d4a52c]">RK</div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Randy Kasper</span>
                <span className="text-[9px] font-mono tracking-[0.2em] text-[#d4a52c]/70 uppercase">Guest</span>
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex min-h-0 flex-1">
          {/* Left nav */}
          <aside className="flex w-56 shrink-0 flex-col border-r border-[#1a1f25] bg-[#0a0c0e]/40">
            <div className="px-4 py-4">
              <div className="text-[9px] font-mono tracking-[0.25em] text-[#475565] uppercase">Current Hub</div>
              <div className="mt-1 text-sm font-bold text-[#f5e6b0]">Media Hub</div>
            </div>
            <nav className="px-2.5">
              {MEDIA_NAV.map((item) => (
                <button
                  key={item.label}
                  onClick={() => setMediaView(item.view)}
                  className={`mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                    mediaView === item.view
                      ? 'border border-[#c0911e]/30 bg-gradient-to-r from-[#c0911e]/15 to-transparent text-[#f5e6b0]'
                      : 'border border-transparent text-[#84929f] hover:bg-[#161b21] hover:text-[#c7cfd8]'
                  }`}
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.5} />
                  <span className="text-xs font-medium tracking-wide">{item.label}</span>
                </button>
              ))}
            </nav>
            <UniversalNavSection onNavigate={onOpenUniversalView} />
          </aside>

          {/* Main */}
          <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
            {mediaView === 'rolodex' ? (
              <IndustryRolodex viewerRole="media-portal" />
            ) : (
            <>
            <div className="p-6 lg:p-8">
              <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight text-white">Media Hub</h1>
                <p className="mt-1 text-sm text-[#5f6e7c]">Where poker tells its story.</p>
              </div>

              <div className="grid grid-cols-12 gap-4">
                {/* Interview Rooms */}
                <div className="metal-panel col-span-12 rounded-xl p-5 lg:col-span-8">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Interview Rooms</h2>
                    <span className="text-[10px] font-mono text-[#475565]">1 live</span>
                  </div>

                  {/* Live room */}
                  <div className="metal-frame-raised rounded-xl p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
                          <span className="text-[10px] font-bold tracking-widest text-red-300 uppercase">Live</span>
                          <span className="rounded border border-[#2a323b] bg-[#11151a] px-1.5 py-0.5 text-[8px] font-mono font-medium tracking-widest text-[#aab6c2] uppercase">MEDIA</span>
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-white">Interview Room 04</h3>
                        <div className="mt-1 text-xs text-[#5f6e7c]">Hosted by Jeff Platt</div>
                      </div>
                      <div className="flex -space-x-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0a0c0e] bg-gradient-to-b from-[#1c2228] to-[#11151a] text-[10px] font-semibold text-[#c7cfd8]">JP</div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#0a0c0e] bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-[10px] font-semibold text-[#d4a52c]">KM</div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-[#1a1f25] bg-[#11151a]/50 p-3">
                        <div className="text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">Host</div>
                        <div className="mt-0.5 text-sm font-semibold text-white">Jeff Platt</div>
                      </div>
                      <div className="rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/8 p-3">
                        <div className="text-[9px] font-mono tracking-widest text-[#d4a52c]/70 uppercase">Guest</div>
                        <div className="mt-0.5 text-sm font-semibold text-[#f5e6b0]">Kevin Martin</div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Topic: The Future of Poker Content</div>
                      <button
                        onClick={onEnterRoom}
                        className="flex items-center gap-2 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 px-5 py-2.5 text-[10px] font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase transition-all hover:gold-glow"
                      >
                        Enter Room <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>

                  {/* Idle rooms */}
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-[#1a1f25] bg-[#11151a]/40 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-[#aab6c2]">Interview Room 02</div>
                        <span className="text-[9px] font-mono tracking-widest text-[#475565] uppercase">Idle</span>
                      </div>
                      <div className="mt-1 text-[10px] text-[#5f6e7c]">Scheduled · 3:00 PM</div>
                    </div>
                    <div className="rounded-lg border border-[#1a1f25] bg-[#11151a]/40 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-[#aab6c2]">Studio A</div>
                        <span className="text-[9px] font-mono tracking-widest text-[#475565] uppercase">Idle</span>
                      </div>
                      <div className="mt-1 text-[10px] text-[#5f6e7c]">Available</div>
                    </div>
                  </div>
                </div>

                {/* Drafts */}
                <div className="metal-panel col-span-12 rounded-xl p-5 lg:col-span-4">
                  <h2 className="mb-4 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Drafts</h2>
                  <div className="metal-frame-raised rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
                      <span className="text-[10px] font-mono tracking-widest text-[#d4a52c]/80 uppercase">Draft Complete</span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold leading-snug text-white">Kevin Martin: The Future of Poker Content</h3>
                    <div className="mt-2 text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Author · Jeff Platt</div>
                    <div className="mt-4">
                      {state.interviewPublished ? (
                        <div className="flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-3 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase">
                          <ShieldCheck className="h-3.5 w-3.5" /> Published
                        </div>
                      ) : (
                        <button
                          onClick={onPublish}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-2.5 text-[10px] font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase transition-all hover:gold-glow"
                        >
                          Publish to Inner Circle
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg border border-[#1a1f25] bg-[#11151a]/40 p-3">
                      <div className="text-[10px] font-mono tracking-widest text-[#475565] uppercase">In Progress</div>
                      <div className="mt-0.5 text-xs font-semibold text-[#aab6c2]">Poker Content Landscape 2027</div>
                    </div>
                    <div className="rounded-lg border border-[#1a1f25] bg-[#11151a]/40 p-3">
                      <div className="text-[10px] font-mono tracking-widest text-[#475565] uppercase">Draft</div>
                      <div className="mt-0.5 text-xs font-semibold text-[#aab6c2]">GGPoker Product Deep Dive</div>
                    </div>
                  </div>
                </div>

                {/* Industry News */}
                <div className="metal-panel col-span-12 rounded-xl p-5 lg:col-span-7">
                  <h2 className="mb-4 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Industry News</h2>
                  <div className="space-y-2.5">
                    {[
                      { src: 'WSOP', text: '2027 WSOP schedule released — 99 bracelet events', time: '2h' },
                      { src: 'GGPoker', text: 'New $100K Super High Roller announced for WSOP Online', time: '5h' },
                      { src: 'PokerGO', text: 'High Stakes Poker returns for Season 14', time: '8h' },
                      { src: 'WPT', text: 'WPT World Championship prize pool exceeds $40M', time: '1d' },
                    ].map((n, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg border border-[#1a1f25] bg-[#11151a]/40 p-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#232a32] bg-[#11151a] text-[8px] font-bold tracking-widest text-[#aab6c2]">
                          {n.src.slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-[#c7cfd8]">{n.text}</div>
                          <div className="mt-0.5 text-[10px] font-mono text-[#475565]">{n.src} · {n.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Collaborations */}
                <div className="metal-panel col-span-12 rounded-xl p-5 lg:col-span-5">
                  <h2 className="mb-4 text-[11px] font-semibold tracking-[0.25em] text-[#aab6c2] uppercase">Collaborations</h2>
                  <div className="space-y-2.5">
                    {[
                      { who: 'PokerGO', what: 'Co-produced documentary series', status: 'Active' },
                      { who: 'Stake', what: 'Sponsored content partnership', status: 'Pending' },
                      { who: 'WPT', what: 'Live event coverage', status: 'Active' },
                    ].map((c, i) => (
                      <div key={i} className="rounded-lg border border-[#1a1f25] bg-[#11151a]/50 p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-white">{c.who}</div>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase ${c.status === 'Active' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-[#c0911e]/15 text-[#d4a52c]'}`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-[#5f6e7c]">{c.what}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Inner Circle control */}
            <div className="mt-auto shrink-0 border-t border-[#1a1f25] bg-[#0a0c0e]/60 p-4">
              <button
                onClick={onInnerCircle}
                className="group flex w-full items-center justify-center gap-3 rounded-xl border border-[#c0911e]/30 bg-gradient-to-r from-[#c0911e]/10 via-[#c0911e]/5 to-transparent py-4 transition-all hover:border-[#c0911e]/50 hover:from-[#c0911e]/15"
              >
                <span className="text-sm font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase">View Inner Circle</span>
                <ChevronRight className="h-5 w-5 text-[#d4a52c] transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
              </button>
            </div>
            </>
            )}
          </main>
        </div>

        {mediaView !== 'rolodex' && (
          <FloatingChatWidget state={chatState} actions={chatActions} />
        )}
      </div>
    </div>
  );
}

function InterviewRoom({ onExit, onPublish, published }: { onExit: () => void; onPublish: () => void; published: boolean }) {
  return (
    <div className="relative h-full w-full bg-[#050608] p-4 lg:p-6">
      <div className="metal-frame brushed-metal clip-bevel relative flex h-full w-full flex-col overflow-hidden rounded-2xl">
        {/* Top bar */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#1a1f25] bg-[#0a0c0e]/60 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <button
              onClick={onExit}
              className="flex items-center gap-2 rounded-lg border border-[#232a32] bg-[#161b21] px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#84929f] uppercase transition-all hover:border-[#38424e] hover:text-[#c7cfd8]"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to Media Hub
            </button>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
              <span className="text-[10px] font-bold tracking-widest text-red-300 uppercase">Live</span>
              <span className="rounded border border-[#2a323b] bg-[#11151a] px-1.5 py-0.5 text-[8px] font-mono font-medium tracking-widest text-[#aab6c2] uppercase">MEDIA</span>
              <span className="text-xs font-semibold text-white">Interview Room 04</span>
            </div>
          </div>
          <span className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Recording · 00:24:18</span>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Video stage */}
          <div className="flex flex-1 flex-col p-6">
            <div className="grid flex-1 grid-cols-2 gap-4">
              <div className="metal-frame-raised relative overflow-hidden rounded-xl">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[#c0911e]/40 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-2xl font-bold text-[#d4a52c]">JP</div>
                </div>
                <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-[#232a32] bg-[#0a0c0e]/80 px-3 py-1.5">
                  <Mic className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2} />
                  <span className="text-xs font-semibold text-white">Jeff Platt</span>
                  <span className="text-[9px] font-mono tracking-widest text-emerald-300 uppercase">Host</span>
                </div>
                <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-900/20 px-2 py-0.5 text-[9px] font-bold tracking-widest text-emerald-300 uppercase">Speaking</div>
              </div>
              <div className="metal-panel relative overflow-hidden rounded-xl">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[#2a323b] bg-gradient-to-b from-[#1c2228] to-[#11151a] text-2xl font-bold text-[#c7cfd8]">KM</div>
                </div>
                <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg border border-[#232a32] bg-[#0a0c0e]/80 px-3 py-1.5">
                  <Mic className="h-3.5 w-3.5 text-[#5f6e7c]" strokeWidth={2} />
                  <span className="text-xs font-semibold text-white">Kevin Martin</span>
                  <span className="text-[9px] font-mono tracking-widest text-[#d4a52c]/70 uppercase">Guest</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button className="flex h-11 w-11 items-center justify-center rounded-full border border-[#232a32] bg-[#161b21] text-[#84929f] transition-all hover:border-[#38424e] hover:text-[#c7cfd8]">
                <Mic className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <button className="flex h-11 w-11 items-center justify-center rounded-full border border-[#232a32] bg-[#161b21] text-[#84929f] transition-all hover:border-[#38424e] hover:text-[#c7cfd8]">
                <Video className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <button className="flex h-11 w-11 items-center justify-center rounded-full border border-red-500/40 bg-red-900/20 text-red-300 transition-all hover:bg-red-900/30">
                <span className="text-base font-bold">●</span>
              </button>
              <button onClick={onExit} className="rounded-lg border border-[#232a32] bg-[#161b21] px-4 py-2.5 text-[10px] font-semibold tracking-widest text-[#aab6c2] uppercase transition-all hover:border-[#38424e]">Leave Room</button>
            </div>
          </div>

          {/* Side panel */}
          <aside className="flex w-80 shrink-0 flex-col border-l border-[#1a1f25] bg-[#0a0c0e]/40">
            <div className="border-b border-[#1a1f25] px-5 py-4">
              <div className="text-[10px] font-mono tracking-widest text-[#5f6e7c] uppercase">Interview Topic</div>
              <div className="mt-1 text-sm font-semibold text-white">The Future of Poker Content</div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {[
                  { who: 'Jeff Platt', text: "Kevin, thanks for joining. Let's start with where poker content is right now.", me: false },
                  { who: 'Kevin Martin', text: "Thanks Jeff. We're in a transition — streaming changed everything, and now short-form is the next wave.", me: true },
                  { who: 'Jeff Platt', text: "Do you think the platforms are keeping up with creators?", me: false },
                  { who: 'Kevin Martin', text: "Some are. But the industry needs a dedicated network — that's the gap.", me: true },
                  { who: 'Jeff Platt', text: "And that's really the SpotVault vision, isn't it?", me: false },
                ].map((m, i) => (
                  <div key={i} className={`flex ${m.me ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-lg px-3 py-2 ${m.me ? 'border border-[#c0911e]/30 bg-[#c0911e]/8' : 'border border-[#1a1f25] bg-[#11151a]'}`}>
                      <div className={`text-[9px] font-mono tracking-widest uppercase ${m.me ? 'text-[#d4a52c]/70' : 'text-[#5f6e7c]'}`}>{m.who}</div>
                      <div className="mt-0.5 text-xs text-white">{m.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-[#1a1f25] p-4">
              <div className="metal-frame-raised rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
                  <span className="text-[10px] font-mono tracking-widest text-[#d4a52c]/80 uppercase">Draft Complete</span>
                </div>
                <div className="mt-1.5 text-xs font-semibold text-white">Kevin Martin: The Future of Poker Content</div>
                {published ? (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/15 px-3 py-2 text-[10px] font-semibold tracking-widest text-[#f5e6b0] uppercase">
                    <ShieldCheck className="h-3.5 w-3.5" /> Published
                  </div>
                ) : (
                  <button
                    onClick={onPublish}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-2.5 text-[10px] font-semibold tracking-[0.2em] text-[#f5e6b0] uppercase transition-all hover:gold-glow"
                  >
                    Publish to Inner Circle
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
