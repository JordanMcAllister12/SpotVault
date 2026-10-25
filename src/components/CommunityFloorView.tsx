import { ArrowLeft, MessageCircle, Users } from 'lucide-react';
import { CommunityFeed } from '@/components/CommunityFeed';
import { FeedFlipCard } from '@/components/shared/FeedFlipCard';
import { dispatchMessageUser } from '@/lib/profileEvents';
import { PLAYER_NETWORK_BACKGROUND } from '@/data/playerNetworkCommunities';
import type { SpotVaultAccount } from '@/types';

const GOLD = '#d4a52c';

interface Props {
  account: SpotVaultAccount | null;
  onBack: () => void;
}

export function CommunityFloorView({ account, onBack }: Props) {
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-cover bg-center bg-no-repeat"
      style={{
        backgroundColor: '#050302',
        backgroundImage: `url("${PLAYER_NETWORK_BACKGROUND}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(5,3,2,0.3) 0%, rgba(5,3,2,0.75) 100%)' }} />

      <header
        className="relative z-20 flex shrink-0 items-center gap-3 border-b px-4 py-3 backdrop-blur-md sm:px-6"
        style={{ borderColor: GOLD + '20', background: 'rgba(0,0,0,0.35)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 font-bold transition-all hover:scale-105"
          style={{
            borderColor: GOLD,
            background: '#000000',
            color: GOLD,
          }}
          aria-label="Back to Community"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
          <span className="text-[11px] font-bold tracking-widest uppercase">Back</span>
        </button>
        <div className="flex flex-col">
          <span className="text-[9px] font-mono tracking-[0.25em] uppercase" style={{ color: GOLD + '80' }}>
            Community Floor
          </span>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h2 className="text-sm font-bold text-white">Main Chat</h2>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[9px] text-white/35">
          <Users className="h-3 w-3" strokeWidth={1.5} />
          <span>247 online</span>
        </div>
      </header>

      <div className="relative z-10 min-h-0 flex-1 overflow-hidden">
        <FeedFlipCard
          currentUserId={account?.id ?? ''}
          onMessage={(uid) => dispatchMessageUser(uid)}
          onBack={() => {}}
        >
          <CommunityFeed account={account} />
        </FeedFlipCard>
      </div>
    </div>
  );
}
