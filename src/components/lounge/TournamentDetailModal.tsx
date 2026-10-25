import { X, MapPin, Clock, DollarSign, Users, Layers, Timer, RefreshCw, Trophy, BarChart3 } from 'lucide-react';
import type { TournamentEvent } from '@/lib/loungeFramework';

interface Props {
  tournament: TournamentEvent;
  onClose: () => void;
}

export function TournamentDetailModal({ tournament: t, onClose }: Props) {
  const total = t.prizePoolContribution + t.fee;
  const effectiveFeePct = ((t.fee / total) * 100).toFixed(1);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#c0911e]/20 bg-[#0a0c0e] shadow-2xl"
        style={{ boxShadow: '0 24px 80px -20px rgba(0,0,0,0.9)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0a0c0e]/95 px-5 py-4 backdrop-blur-md">
          <div>
            <h2 className="text-base font-bold text-white">{t.name}</h2>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/40">
              <MapPin className="h-3 w-3" /> {t.venue}
              {t.operator && <span className="text-[#d4a52c]/60">· {t.operator}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Live status */}
          {t.live && (
            <div className="mb-5 rounded-xl border border-red-400/20 bg-red-400/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-red-300">Live</span>
                <span className="ml-auto text-[10px] font-mono text-white/40">Updated {t.live.lastUpdated}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <DetailRow icon={Layers} label="Level" value={`${t.live.level}`} />
                <DetailRow icon={Clock} label="Blinds" value={`${t.live.smallBlind} / ${t.live.bigBlind}`} sub={t.live.ante ? `Ante ${t.live.ante}` : undefined} />
                <DetailRow icon={Users} label="Entries" value={`${t.live.entries}`} sub={`${t.live.remaining} remaining`} />
                <DetailRow icon={BarChart3} label="Avg Stack" value={t.live.avgStack.toLocaleString()} sub={`Re-entries: ${t.live.reentries}`} />
                <DetailRow icon={Timer} label="Late Reg" value={t.live.lateRegRemaining} />
                <DetailRow icon={RefreshCw} label="Next Break" value={t.live.nextBreakIn} sub={`Elapsed: ${t.live.elapsed}`} />
              </div>
            </div>
          )}

          {/* Tournament info */}
          <div className="mb-5">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Tournament Info</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <DetailRow icon={Clock} label="Start" value={t.startTime} />
              <DetailRow icon={DollarSign} label="Buy-in" value={`$${t.buyIn}`} />
              <DetailRow icon={Trophy} label="Starting Stack" value={t.startingStack.toLocaleString()} />
              <DetailRow icon={Clock} label="Blind Levels" value={`${t.blindLevelMinutes} min`} />
              <DetailRow icon={Timer} label="Late Reg" value={t.lateRegistration} />
              {t.guarantee && <DetailRow icon={DollarSign} label="Guarantee" value={`$${t.guarantee.toLocaleString()}`} />}
            </div>
          </div>

          {/* Buy-in breakdown */}
          <div className="mb-5">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">Buy-in Breakdown</div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] text-white/50">Prize-pool contribution</span>
                <span className="text-[12px] font-semibold text-white/90">${t.prizePoolContribution}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] text-white/50">Fee / rake</span>
                <span className="text-[12px] font-semibold text-white/90">${t.fee} ({effectiveFeePct}%)</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-white/[0.06] pt-2">
                <span className="text-[11px] font-bold text-white/70">Total</span>
                <span className="text-[13px] font-bold text-[#f5e6b0]">${total}</span>
              </div>
            </div>
          </div>

          {/* Re-entry / rebuy / add-on */}
          <div className="flex flex-wrap gap-2">
            {t.reEntry && (
              <span className="rounded-md border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">
                Re-entry{t.reEntryLimit ? ` (max ${t.reEntryLimit})` : ''}
              </span>
            )}
            {t.rebuy && (
              <span className="rounded-md border border-blue-400/20 bg-blue-400/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-400/80">
                Rebuy
              </span>
            )}
            {t.addOn && (
              <span className="rounded-md border border-amber-400/20 bg-amber-400/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
                Add-on
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, sub }: { icon: typeof Clock; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#d4a52c]/50" strokeWidth={1.5} />
      <div className="min-w-0">
        <div className="text-[9px] font-mono uppercase tracking-widest text-white/30">{label}</div>
        <div className="text-[12px] font-semibold text-white/90">{value}</div>
        {sub && <div className="text-[10px] text-white/40">{sub}</div>}
      </div>
    </div>
  );
}
