import { useEffect, useState } from 'react';
import {
  UserCircle, ShieldCheck, Trophy, CreditCard,
  Gift, History, TrendingUp, Zap, Crown,
  ChevronDown,
} from 'lucide-react';
import { ProfilePage } from '@/components/ProfilePage';
import { MysteryVaultPreview } from '@/components/player/MysteryVaultPreview';
import type { SpotVaultAccount } from '@/types';
import { AccountSecurityTab } from '@/components/player/AccountSecurityTab';
import { MembershipBillingTab } from '@/components/player/MembershipBillingTab';

const GOLD = 'var(--portal-accent, #d4a52c)';
const GOLD_SOFT = 'var(--portal-accent-soft, #f5e6b0)';
const BORDER = 'rgba(var(--portal-accent-rgb, 212,165,44), 0.18)';
const CARD_BG = 'rgba(6, 8, 10, 0.55)';
const PANEL_BG = 'rgba(6, 8, 10, 0.55)';
const PANEL_BORDER = 'rgba(var(--portal-accent-rgb, 212,165,44), 0.12)';

export type HubTab = 'profile' | 'membership' | 'account-security' | 'rewards';

const TABS: { id: HubTab; label: string; icon: typeof UserCircle }[] = [
  { id: 'profile', label: 'Profile', icon: UserCircle },
  { id: 'membership', label: 'Membership & Billing', icon: CreditCard },
  { id: 'account-security', label: 'Account & Security', icon: ShieldCheck },
  { id: 'rewards', label: 'Rewards & Progress', icon: Trophy },
];

interface Props {
  account: SpotVaultAccount;
  onBack: () => void;
  portalContext?: 'player' | 'stakekings';
  initialTab?: HubTab;
}

export function ProfileSettingsHub({ account, onBack, portalContext, initialTab = 'profile' }: Props) {
  const [tab, setTab] = useState<HubTab>(initialTab);

  useEffect(() => {
    if (initialTab && initialTab !== tab) setTab(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-8 sm:py-6">
      <div
        className="overflow-hidden rounded-2xl border backdrop-blur-md"
        style={{ borderColor: BORDER, background: CARD_BG, boxShadow: '0 24px 60px -20px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.03)' }}
      >
        <div
          className="sv-no-scrollbar flex shrink-0 items-center gap-1 overflow-x-auto border-b px-3 py-2.5 sm:px-4"
          style={{ borderColor: BORDER, background: 'rgba(4, 5, 6, 0.5)' }}
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[10px] font-semibold tracking-wide uppercase transition-all"
                style={{
                  borderColor: active ? GOLD : 'rgba(255,255,255,0.06)',
                  background: active ? 'rgba(var(--portal-accent-rgb, 212,165,44), 0.12)' : 'transparent',
                  color: active ? GOLD_SOFT : 'rgba(255,255,255,0.5)',
                }}
              >
                <Icon className="h-3 w-3" strokeWidth={1.5} />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        <div className={tab === 'profile' ? 'max-h-[calc(100vh-28px)] overflow-y-auto lg:min-h-[520px]' : 'max-h-[calc(100vh-28px)] overflow-y-auto'}>
          {tab === 'profile' && (
            <ProfilePage
              accountId={account.id}
              fallbackName={account.name}
              isOwn
              onBack={onBack}
              embedded
            />
          )}
          {tab === 'membership' && (
            <MembershipBillingTab account={account} />
          )}
          {tab === 'account-security' && (
            <AccountSecurityTab account={account} portalContext={portalContext} />
          )}
          {tab === 'rewards' && <RewardsTab account={account} />}
        </div>
      </div>
    </div>
  );
}

function RewardsTab({ account }: { account: SpotVaultAccount }) {
  return (
    <div className="w-full space-y-3 px-5 py-4 sm:px-8 sm:py-3">
      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
          <MysteryVaultPreview account={account} />
        </div>

        <div className="rounded-2xl border p-3 sm:p-4" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 shrink-0" strokeWidth={1.5} style={{ color: GOLD }} />
            <h3 className="text-sm font-bold tracking-wide text-white">Rewards Status</h3>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <StatusIndicator icon={TrendingUp} label="Current Level" value="—" />
            <StatusIndicator icon={Zap} label="Total XP" value="0" />
            <StatusIndicator icon={Gift} label="Available" value="0" />
            <StatusIndicator icon={Crown} label="Earned" value="0" />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-white/40">
            Track your level, XP, and unlockable rewards here once the rewards system launches.
          </p>
        </div>
      </div>

      <MilestonesPanel />
      <RewardHistoryPanel />
    </div>
  );
}

function MilestonesPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
          <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">Future Milestones</h3>
        </div>
        <ChevronDown
          className="h-3.5 w-3.5 text-white/30 transition-transform"
          strokeWidth={1.5}
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && (
        <div className="px-4 pb-4">
          <EmptyState
            icon={TrendingUp}
            title="No milestones yet"
            message="Upcoming milestones and unlock goals will appear here as you progress."
          />
        </div>
      )}
    </div>
  );
}

function RewardHistoryPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
          <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">Reward History</h3>
        </div>
        <ChevronDown
          className="h-3.5 w-3.5 text-white/30 transition-transform"
          strokeWidth={1.5}
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && (
        <div className="px-4 pb-4">
          <EmptyState
            icon={History}
            title="No reward history"
            message="Your past rewards and redemptions will be listed here."
          />
        </div>
      )}
    </div>
  );
}

function StatusIndicator({ icon: Icon, label, value }: { icon: typeof UserCircle; label: string; value: string }) {
  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: PANEL_BORDER, background: 'rgba(4, 5, 6, 0.4)' }}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0 text-white/30" strokeWidth={1.5} />
        <span className="text-[9px] font-bold tracking-[0.15em] uppercase text-white/40">{label}</span>
      </div>
      <div className="mt-0.5 text-base font-bold text-white">{value}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, message }: { icon: typeof UserCircle; title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-4 text-center">
      <Icon className="mb-2 h-5 w-5 text-white/15" strokeWidth={1.5} />
      <p className="text-[12px] font-semibold text-white/50">{title}</p>
      <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-white/30">{message}</p>
    </div>
  );
}
