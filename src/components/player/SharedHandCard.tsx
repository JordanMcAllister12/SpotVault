import { Play, Users, Trophy, Coins } from 'lucide-react';
import type { HandShareRef } from '@/lib/handShareStore';
import { decodeHandRef } from '@/lib/handShareStore';
import { MiniPlayingCard } from './MiniPlayingCard';

interface SharedHandCardProps {
  attachmentUrl: string;
  attachmentLabel?: string | null;
  onPlayHand?: (handRef: HandShareRef) => void;
  compact?: boolean;
}

export function SharedHandCard({ attachmentUrl, attachmentLabel, onPlayHand, compact }: SharedHandCardProps) {
  const ref = decodeHandRef(attachmentUrl);
  if (!ref) return null;

  const renderCards = (cards: string | null) => {
    if (!cards) return null;
    return cards.split(' ').map((c, i) => {
      if (c.length < 2) return null;
      return <MiniPlayingCard key={i} rank={c.slice(0, -1)} suit={c.slice(-1)} size="small" />;
    });
  };

  const formatResult = (r: number | null) => {
    if (r === null) return null;
    const v = Number(r);
    const sign = v > 0 ? '+' : '';
    return `${sign}${v.toLocaleString()}`;
  };

  const resultColor = (r: number | null) => {
    if (r === null) return '#6b7280';
    return Number(r) > 0 ? '#4ade80' : Number(r) < 0 ? '#f87171' : '#9ca3af';
  };

  return (
    <div
      className="mt-1.5 overflow-hidden rounded-lg border transition-all"
      style={{ borderColor: 'rgba(192,145,30,0.2)', background: 'linear-gradient(135deg, rgba(12,11,10,0.95), rgba(8,7,6,0.95))' }}
    >
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid rgba(192,145,30,0.1)' }}>
        <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: 'rgba(192,145,30,0.12)', border: '1px solid rgba(192,145,30,0.15)' }}>
          <Play className="h-3.5 w-3.5" style={{ color: '#d4a52c' }} strokeWidth={1.5} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#d4a52c]">Shared Hand</span>
        {ref.site && <span className="text-[9px] text-white/30 uppercase">{ref.site}</span>}
      </div>

      <div className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-white/30">Hero</span>
            <div className="flex gap-0.5">{renderCards(ref.hero_cards)}</div>
          </div>

          {ref.board && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-white/30">Board</span>
              <div className="flex gap-0.5">{renderCards(ref.board)}</div>
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
          {ref.blinds && (
            <span className="flex items-center gap-1 text-white/50">
              <Coins className="h-3 w-3" style={{ color: '#8a93a2' }} strokeWidth={1.5} />
              {ref.blinds}
            </span>
          )}
          {ref.tournament_id && (
            <span className="flex items-center gap-1 text-white/50">
              <Trophy className="h-3 w-3" style={{ color: '#8a93a2' }} strokeWidth={1.5} />
              <span className="max-w-[120px] truncate">{ref.tournament_id}</span>
            </span>
          )}
          {ref.pot_amount != null && (
            <span className="flex items-center gap-1 text-white/50">
              Pot: <span className="font-mono font-semibold text-white/70">{Number(ref.pot_amount).toLocaleString()}</span>
            </span>
          )}
          {ref.net_result != null && (
            <span className="flex items-center gap-1">
              <span className="text-white/40">Result:</span>
              <span className="font-mono font-bold" style={{ color: resultColor(ref.net_result) }}>
                {formatResult(ref.net_result)}
              </span>
            </span>
          )}
        </div>
      </div>

      {!compact && onPlayHand && (
        <div className="px-3 pb-2.5">
          <button
            onClick={() => onPlayHand(ref)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] font-bold uppercase tracking-wider transition-all hover:scale-[1.01]"
            style={{ borderColor: 'rgba(201,162,39,0.35)', background: 'rgba(201,162,39,0.1)', color: '#d4a52c' }}
          >
            <Play className="h-3.5 w-3.5" strokeWidth={2} />
            Play Hand
          </button>
        </div>
      )}

      {compact && onPlayHand && (
        <button
          onClick={() => onPlayHand(ref)}
          className="flex w-full items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-white/5"
          style={{ borderTop: '1px solid rgba(192,145,30,0.08)', color: '#d4a52c' }}
        >
          <Play className="h-3 w-3" strokeWidth={2} />
          Play Hand
        </button>
      )}
    </div>
  );
}
