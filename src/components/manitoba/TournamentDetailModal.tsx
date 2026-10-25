import { X, MapPin, Clock, DollarSign, Users, Layers, Trophy, RefreshCw, Repeat, Plus, Calendar } from 'lucide-react';
import type { ManitobaTournament } from '@/data/manitobaDemoData';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

interface Props {
  tournament: ManitobaTournament;
  onClose: () => void;
}

export function TournamentDetailModal({ tournament: t, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border"
        style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.96)', backdropFilter: 'blur(20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/[0.06] p-5" style={{ background: 'rgba(8,7,6,0.98)' }}>
          <div>
            <div className="flex items-center gap-2">
              {t.live && (
                <span className="flex h-2 w-2 items-center justify-center">
                  <span className="absolute h-2 w-2 animate-ping rounded-full" style={{ background: '#ef4444', opacity: 0.4 }} />
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#ef4444' }} />
                </span>
              )}
              <h2 className="text-[15px] font-bold text-white">{t.name}</h2>
            </div>
            <p className="mt-0.5 text-[11px] text-white/40">{t.venue} · {t.operator}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 transition hover:text-white/80">
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 p-5">
          {/* Live status */}
          {t.live && (
            <div className="rounded-xl border p-4" style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-2 w-2 items-center justify-center">
                  <span className="absolute h-2 w-2 animate-ping rounded-full" style={{ background: '#ef4444', opacity: 0.4 }} />
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#ef4444' }} />
                </span>
                <span className="text-[10px] font-bold tracking-widest" style={{ color: '#ef4444' }}>LIVE NOW</span>
                <span className="text-[9px] text-white/30">· Updated {t.live.lastUpdated}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <DetailRow icon={Layers} label="Level" value={`${t.live.level}`} />
                <DetailRow icon={DollarSign} label="Blinds" value={`${t.live.smallBlind} / ${t.live.bigBlind}`} />
                <DetailRow icon={Users} label="Entries" value={`${t.live.entries}`} />
                <DetailRow icon={Users} label="Remaining" value={`${t.live.remaining}`} />
                <DetailRow icon={Trophy} label="Avg Stack" value={t.live.avgStack.toLocaleString()} />
                <DetailRow icon={Clock} label="Elapsed" value={t.live.elapsed} />
                <DetailRow icon={Clock} label="Late Reg" value={t.live.lateRegRemaining} />
                <DetailRow icon={Clock} label="Next Break" value={t.live.nextBreakIn} />
              </div>
              {t.live.reentries > 0 && <DetailRow icon={Repeat} label="Re-entries" value={`${t.live.reentries}`} />}
            </div>
          )}

          {/* Tournament info */}
          <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.5)' }}>
            <h3 className="mb-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>Tournament Info</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <DetailRow icon={Calendar} label="Start Time" value={t.startTime} />
              <DetailRow icon={DollarSign} label="Buy-in" value={`$${t.buyIn}`} />
              <DetailRow icon={Trophy} label="Starting Stack" value={t.startingStack.toLocaleString()} />
              <DetailRow icon={Clock} label="Blind Levels" value={`${t.blindLevelMinutes} min`} />
              <DetailRow icon={Clock} label="Late Registration" value={t.lateRegistration} />
              {t.guarantee && <DetailRow icon={Trophy} label="Guarantee" value={`$${t.guarantee.toLocaleString()}`} />}
            </div>
          </div>

          {/* Economics breakdown */}
          <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.5)' }}>
            <h3 className="mb-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>Buy-in Breakdown</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/50">Prize Pool Contribution</span>
                <span className="text-[12px] font-bold" style={{ color: GOLD_SOFT }}>${t.prizePoolContribution}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/50">Fee / Rake</span>
                <span className="text-[12px] font-bold text-red-400/80">${t.fee} ({t.feePercent}%)</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
                <span className="text-[11px] text-white/60">Total Buy-in</span>
                <span className="text-[13px] font-bold text-white">${t.buyIn}</span>
              </div>
            </div>
          </div>

          {/* Re-entry / rebuy / add-on */}
          <div className="flex flex-wrap gap-2">
            {t.reEntry && (
              <div className="flex items-center gap-1.5 rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(74,222,128,0.2)', background: 'rgba(74,222,128,0.05)' }}>
                <Repeat className="h-3.5 w-3.5 text-green-400/70" strokeWidth={1.5} />
                <span className="text-[10px] text-white/70">Re-entry{t.reEntryLimit ? ` (up to ${t.reEntryLimit})` : ''}</span>
              </div>
            )}
            {t.rebuy && (
              <div className="flex items-center gap-1.5 rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(96,165,250,0.2)', background: 'rgba(96,165,250,0.05)' }}>
                <RefreshCw className="h-3.5 w-3.5 text-blue-400/70" strokeWidth={1.5} />
                <span className="text-[10px] text-white/70">Rebuy available</span>
              </div>
            )}
            {t.addOn && (
              <div className="flex items-center gap-1.5 rounded-lg border px-3 py-2" style={{ borderColor: 'rgba(212,165,44,0.2)', background: 'rgba(212,165,44,0.05)' }}>
                <Plus className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
                <span className="text-[10px] text-white/70">Add-on available</span>
              </div>
            )}
          </div>

          {/* Venue */}
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2.5" style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.4)' }}>
            <MapPin className="h-4 w-4 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
            <span className="text-[11px] text-white/60">{t.venue}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-white/30" strokeWidth={1.5} />
      <span className="text-[10px] text-white/40">{label}:</span>
      <span className="text-[11px] font-semibold text-white/80">{value}</span>
    </div>
  );
}
