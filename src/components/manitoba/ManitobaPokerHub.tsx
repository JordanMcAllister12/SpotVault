import { useState } from 'react';
import { ArrowLeft, Home, Menu } from 'lucide-react';
import type { SpotVaultAccount } from '@/types';
import type { UniversalView } from '@/components/UniversalRail';
import { LiveInManitoba } from '@/components/manitoba/LiveInManitoba';
import { ManitobaCommunityFeed } from '@/components/manitoba/ManitobaCommunityFeed';
import { ManitobaChat } from '@/components/manitoba/ManitobaChat';
import { TonightInManitoba } from '@/components/manitoba/TonightInManitoba';
import { TournamentDetailModal } from '@/components/manitoba/TournamentDetailModal';
import type { ManitobaTournament } from '@/data/manitobaDemoData';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';

interface Props {
  account: SpotVaultAccount | null;
  onBackToHub: () => void;
  onOpenUniversalView?: (view: UniversalView | string) => void;
  originPortalName?: string;
  onReturnToPortal?: () => void;
}

export function ManitobaPokerHub({ account, onBackToHub, originPortalName, onReturnToPortal }: Props) {
  const [selectedTournament, setSelectedTournament] = useState<ManitobaTournament | null>(null);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        backgroundImage: 'url("/assets/portals/manitoba/image.webp")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-20 flex h-12 items-center justify-between border-b px-4"
        style={{ borderColor: BORDER, background: 'rgba(8,7,6,0.82)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-center gap-3">
          <button onClick={onBackToHub} className="flex items-center gap-2 text-white/50 transition hover:text-white/80">
            <Home className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold tracking-wide text-white">Manitoba Poker</span>
            <span className="text-[8px] font-mono tracking-[0.25em] uppercase" style={{ color: GOLD + '80' }}>Community</span>
          </div>
        </div>
        {onReturnToPortal && originPortalName && (
          <button
            onClick={onReturnToPortal}
            className="flex items-center gap-2 rounded-lg border border-[#d4a52c]/25 bg-[#d4a52c]/8 px-3 py-1.5 text-[10px] font-semibold tracking-wide transition hover:bg-[#d4a52c]/15"
            style={{ color: GOLD_SOFT }}
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Return to {originPortalName}
          </button>
        )}
      </div>

      {/* 3-column layout */}
      <div className="absolute inset-0 top-12 flex gap-3 p-3">
        {/* LEFT RAIL — Live in Manitoba */}
        <div
          className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl border"
          style={{
            borderColor: BORDER,
            background: 'rgba(8,7,6,0.42)',
            backdropFilter: 'blur(18px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 40px -12px rgba(0,0,0,0.6)',
          }}
        >
          <LiveInManitoba onTournamentClick={setSelectedTournament} />
        </div>

        {/* CENTER — Community Feed */}
        <div
          className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border"
          style={{
            borderColor: BORDER,
            background: 'rgba(8,7,6,0.42)',
            backdropFilter: 'blur(18px)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 40px -12px rgba(0,0,0,0.6)',
          }}
        >
          <ManitobaCommunityFeed account={account} />
        </div>

        {/* RIGHT RAIL — Chat (top) + Tonight (bottom) */}
        <div
          className="flex w-[300px] shrink-0 flex-col gap-3 overflow-hidden"
        >
          {/* Chat — upper half */}
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border"
            style={{
              borderColor: BORDER,
              background: 'rgba(8,7,6,0.42)',
              backdropFilter: 'blur(18px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 40px -12px rgba(0,0,0,0.6)',
            }}
          >
            <ManitobaChat accountName={account?.name ?? null} />
          </div>

          {/* Tonight in Manitoba — lower half */}
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border"
            style={{
              borderColor: BORDER,
              background: 'rgba(8,7,6,0.42)',
              backdropFilter: 'blur(18px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 40px -12px rgba(0,0,0,0.6)',
            }}
          >
            <TonightInManitoba onTournamentClick={setSelectedTournament} />
          </div>
        </div>
      </div>

      {selectedTournament && (
        <TournamentDetailModal tournament={selectedTournament} onClose={() => setSelectedTournament(null)} />
      )}
    </div>
  );
}
