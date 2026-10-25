import { useState, useEffect, useRef } from 'react';
import { Heart, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const GOLD = '#d4a52c';

interface GivebackData {
  communityGivebackPercent: number;
  lifetimeGivebackAmount: number | null;
  currentYearGivebackAmount: number | null;
  numberOfGiveaways: number | null;
  playersHelped: number | null;
  supportProgramsFunded: number | null;
  latestCommunityInitiative: string | null;
}

export function CommunityGivebackMeter() {
  const [data, setData] = useState<GivebackData | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data: row } = await supabase
        .from('community_settings')
        .select('*')
        .eq('id', 'global')
        .maybeSingle();
      if (row) {
        setData({
          communityGivebackPercent: Number(row.community_giveback_percent ?? 5),
          lifetimeGivebackAmount: row.lifetime_giveback_amount != null ? Number(row.lifetime_giveback_amount) : null,
          currentYearGivebackAmount: row.current_year_giveback_amount != null ? Number(row.current_year_giveback_amount) : null,
          numberOfGiveaways: row.number_of_giveaways ?? null,
          playersHelped: row.players_helped ?? null,
          supportProgramsFunded: row.support_programs_funded ?? null,
          latestCommunityInitiative: row.latest_community_initiative ?? null,
        });
      } else {
        setData({ communityGivebackPercent: 5, lifetimeGivebackAmount: null, currentYearGivebackAmount: null, numberOfGiveaways: null, playersHelped: null, supportProgramsFunded: null, latestCommunityInitiative: null });
      }
    })();
  }, []);

  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPopover]);

  if (!data) return null;

  return (
    <div ref={popoverRef} className="relative">
      {/* Compact meter */}
      <button
        onClick={() => setShowPopover(s => !s)}
        onMouseEnter={() => setShowPopover(true)}
        className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all"
        style={{
          borderColor: 'rgba(212,165,44,0.2)',
          background: 'rgba(8,7,6,0.85)',
          backdropFilter: 'blur(8px)',
        }}
        aria-label="Community Giveback"
      >
        <Heart className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} fill={showPopover ? GOLD : 'none'} />
        <span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Giveback</span>
        <span className="text-[11px] font-bold" style={{ color: GOLD }}>{data.communityGivebackPercent}%</span>
      </button>

      {/* Popover */}
      {showPopover && (
        <div
          className="absolute right-0 bottom-full z-[300] mb-2 w-72 rounded-xl border p-4 backdrop-blur-xl"
          style={{
            borderColor: 'rgba(212,165,44,0.15)',
            background: 'rgba(8,7,6,0.96)',
            boxShadow: '0 12px 40px -12px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Close (mobile) */}
          <button
            onClick={() => setShowPopover(false)}
            className="absolute right-3 top-3 text-white/30 transition-colors hover:text-white/60"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Header */}
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}20` }}>
              <Heart className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} fill={GOLD} />
            </div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/60">SpotVault Community Giveback</h3>
          </div>

          {/* Percentage display */}
          <div className="mb-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold" style={{ color: GOLD }}>{data.communityGivebackPercent}</span>
            <span className="text-sm font-bold" style={{ color: GOLD }}>%</span>
            <span className="ml-1 text-[10px] text-white/30">of annual profits</span>
          </div>

          {/* Description */}
          <p className="text-[11px] leading-relaxed text-white/50">
            SpotVault currently targets <span style={{ color: GOLD }}>{data.communityGivebackPercent}%</span> of annual profits for reinvestment into initiatives designed to benefit the poker community.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/50">
            These initiatives may include player giveaways, promotions, educational support, community programs, wellness resources, therapy/support access, and other programs intended to benefit poker players.
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/50">
            The allocation is reviewed periodically based on company performance, community needs, and SpotVault's long-term growth priorities.
          </p>

          {/* Future expandable data (only shown if available) */}
          {data.lifetimeGivebackAmount != null && (
            <div className="mt-3 border-t border-white/[0.04] pt-3">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-white/40">Lifetime Reinvested</span>
                <span className="font-bold" style={{ color: GOLD }}>${data.lifetimeGivebackAmount.toLocaleString()}</span>
              </div>
            </div>
          )}
          {data.playersHelped != null && (
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="text-white/40">Players Helped</span>
              <span className="font-bold text-white/60">{data.playersHelped.toLocaleString()}</span>
            </div>
          )}
          {data.latestCommunityInitiative && (
            <div className="mt-3 rounded-md border border-[#1a1f25] bg-[#0e0c0a] p-2">
              <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: GOLD }}>Latest Initiative</span>
              <p className="mt-1 text-[10px] text-white/50">{data.latestCommunityInitiative}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
