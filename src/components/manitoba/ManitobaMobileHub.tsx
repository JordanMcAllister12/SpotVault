import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MessageSquare, X, Send, Users, ChevronLeft, ChevronRight, Star, Info } from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import type { ManitobaTournament } from '@/data/manitobaDemoData';
import { LIVE_TOURNAMENTS, LIVE_CASH_GAMES, TONIGHT_TOURNAMENTS, calculateBestPlayerValue, getBestValueExplanation } from '@/data/manitobaDemoData';
import { ManitobaCommunityFeed } from '@/components/manitoba/ManitobaCommunityFeed';
import { TournamentDetailModal } from '@/components/manitoba/TournamentDetailModal';
import { Avatar } from '@/components/shared/Avatar';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';
const LIVE_RED = '#ef4444';

interface Props {
  account: SpotVaultAccount | null;
  onBackToHub: () => void;
  originPortalName?: string;
  onReturnToPortal?: () => void;
}

export function ManitobaMobileHub({ account, onBackToHub, originPortalName, onReturnToPortal }: Props) {
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<ManitobaTournament | null>(null);
  const [tonightIndex, setTonightIndex] = useState(0);
  const [showBestValueInfo, setShowBestValueInfo] = useState(false);

  const liveTournaments = LIVE_TOURNAMENTS.filter((t) => t.live);
  const cashGames = LIVE_CASH_GAMES;
  const tonightTournaments = TONIGHT_TOURNAMENTS;
  const bestValue = calculateBestPlayerValue(tonightTournaments);

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'rgba(5,6,8,0.95)' }}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          {onReturnToPortal && originPortalName ? (
            <button onClick={onReturnToPortal} className="flex items-center gap-1 text-white/50">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
          ) : (
            <button onClick={onBackToHub} className="flex items-center gap-1 text-white/50">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
          <span className="text-[14px] font-bold text-white">Manitoba Poker</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Create Post */}
        <div className="border-b border-white/[0.06] p-3">
          <div className="flex items-center gap-2">
            <Avatar name={account?.name ?? 'You'} size={32} />
            <button className="flex-1 rounded-full border border-white/[0.08] bg-black/30 px-3 py-2 text-left text-[11px] text-white/30">
              What's happening in Manitoba poker?
            </button>
          </div>
        </div>

        {/* LIVE IN MANITOBA — compact carousel */}
        {(liveTournaments.length > 0 || cashGames.length > 0) && (
          <div className="border-b border-white/[0.06] p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-2 w-2 items-center justify-center">
                <span className="absolute h-2 w-2 animate-ping rounded-full" style={{ background: LIVE_RED, opacity: 0.4 }} />
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIVE_RED }} />
              </span>
              <h2 className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: GOLD_SOFT }}>Live in Manitoba</h2>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {liveTournaments.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTournament(t)}
                  className="shrink-0 rounded-lg border p-2.5 text-left"
                  style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(8,7,6,0.7)', width: '240px' }}
                >
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIVE_RED }} />
                    <span className="text-[8px] font-bold tracking-widest" style={{ color: LIVE_RED }}>LIVE</span>
                    <span className="text-[8px] text-white/30">· {t.operator}</span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-white">{t.name}</p>
                  <p className="text-[9px] text-white/40">{t.venue}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[9px]">
                    <span className="text-white/60">L{t.live!.level} · {t.live!.smallBlind}/{t.live!.bigBlind}</span>
                    <span className="text-white/60">{t.live!.remaining}/{t.live!.entries} left</span>
                  </div>
                </button>
              ))}
              {cashGames.map((cg) => (
                <div key={cg.id} className="shrink-0 rounded-lg border p-2.5" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.6)', width: '180px' }}>
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: LIVE_RED }} />
                    <span className="text-[10px] font-bold" style={{ color: GOLD_SOFT }}>{cg.game}</span>
                  </div>
                  <p className="text-[9px] text-white/40">{cg.venue}</p>
                  <div className="mt-1 text-[9px] text-white/60">{cg.tables} tables · {cg.players} players</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TONIGHT IN MANITOBA — horizontal carousel */}
        <div className="border-b border-white/[0.06] p-3">
          <h2 className="mb-2 text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: GOLD_SOFT }}>Tonight in Manitoba</h2>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {tonightTournaments.map((t) => {
              const isBest = bestValue?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTournament(t)}
                  className="shrink-0 rounded-lg border p-2.5 text-left transition-all"
                  style={{
                    borderColor: isBest ? 'rgba(212,165,44,0.4)' : BORDER,
                    background: 'rgba(8,7,6,0.62)',
                    boxShadow: isBest ? '0 0 12px rgba(212,165,44,0.1)' : 'none',
                    width: '220px',
                  }}
                >
                  {isBest && (
                    <div className="mb-1 flex items-center gap-1">
                      <Star className="h-2.5 w-2.5" style={{ color: GOLD }} strokeWidth={1.5} fill={GOLD} />
                      <span className="text-[7px] font-bold tracking-widest" style={{ color: GOLD_SOFT }}>BEST VALUE</span>
                    </div>
                  )}
                  <p className="text-[11px] font-bold text-white">{t.name}</p>
                  <p className="text-[9px] text-white/40">{t.venue}</p>
                  <div className="mt-1 text-[10px]" style={{ color: GOLD_SOFT }}>${t.buyIn} · {t.startTime}</div>
                  <div className="text-[9px] text-white/40">{t.startingStack.toLocaleString()} stack · {t.blindLevelMinutes}m</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* COMMUNITY FEED — full width */}
        <div className="min-h-[400px]">
          <ManitobaCommunityFeed account={account} />
        </div>
      </div>

      {/* Floating chat button */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="absolute bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-lg transition-all hover:scale-110"
          style={{ borderColor: GOLD, background: 'rgba(8,7,6,0.95)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
        >
          <MessageSquare className="h-5 w-5" style={{ color: GOLD }} strokeWidth={1.5} />
        </button>
      )}

      {/* Chat overlay */}
      {chatOpen && <MobileChatOverlay accountName={account?.name ?? null} onClose={() => setChatOpen(false)} />}

      {selectedTournament && (
        <TournamentDetailModal tournament={selectedTournament} onClose={() => setSelectedTournament(null)} />
      )}
    </div>
  );
}

function MobileChatOverlay({ accountName, onClose }: { accountName: string | null; onClose: () => void }) {
  const [tab, setTab] = useState<'group' | 'direct'>('group');
  const [messages, setMessages] = useState<{ id: string; authorName: string; text: string; timestamp: string; isSelf?: boolean }[]>([
    { id: 'm1', authorName: 'Mike Thompson', text: 'Who\'s at McPhillips tonight?', timestamp: '5m' },
    { id: 'm2', authorName: 'Sarah K.', text: 'On my way', timestamp: '4m' },
    { id: 'm3', authorName: 'Dave D.', text: '2/5 list is 3 deep', timestamp: '3m' },
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !accountName) return;
    setMessages((prev) => [...prev, { id: `m${Date.now()}`, authorName: accountName, text: input.trim(), timestamp: 'now', isSelf: true }]);
    setInput('');
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: 'rgba(5,6,8,0.98)' }}>
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setTab('group')} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${tab === 'group' ? 'text-[#080706]' : 'text-white/40'}`} style={{ background: tab === 'group' ? GOLD : 'transparent' }}>
            <Users className="inline h-3 w-3" /> Group
          </button>
          <button onClick={() => setTab('direct')} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${tab === 'direct' ? 'text-[#080706]' : 'text-white/40'}`} style={{ background: tab === 'direct' ? GOLD : 'transparent' }}>
            Direct
          </button>
        </div>
        <button onClick={onClose} className="text-white/50">
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`mb-2 flex ${msg.isSelf ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[75%]">
              {!msg.isSelf && <span className="mb-0.5 block text-[9px] font-semibold text-white/50">{msg.authorName}</span>}
              <div className="rounded-2xl px-3 py-2" style={{ background: msg.isSelf ? GOLD : 'rgba(255,255,255,0.06)' }}>
                <p className="text-[11px]" style={{ color: msg.isSelf ? '#080706' : 'rgba(255,255,255,0.8)' }}>{msg.text}</p>
              </div>
              <span className={`block text-[8px] text-white/25 ${msg.isSelf ? 'text-right' : ''}`}>{msg.timestamp}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="shrink-0 border-t border-white/[0.06] p-2">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
            placeholder="Message..."
            className="flex-1 rounded-full border border-white/[0.08] bg-black/30 px-3 py-2 text-[11px] text-white placeholder:text-white/25 focus:border-[#c0911e]/30 focus:outline-none"
          />
          <button onClick={handleSend} disabled={!input.trim()} className="flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-30" style={{ background: GOLD }}>
            <Send className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: '#080706' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
