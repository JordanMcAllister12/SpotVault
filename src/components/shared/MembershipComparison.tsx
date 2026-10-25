import { Check, Clock, Minus } from 'lucide-react';
import { ENTITLEMENTS, FEATURE_FLAGS, TIER_DISPLAY, TIER_ORDER, type MembershipTier } from '@/lib/entitlements';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const DIM = 'rgba(255,255,255,0.25)';

// ─── Matrix definition ───────────────────────────────────────────────────────
//
// Each row is one of three shapes:
//   boolean-row: true | false per tier
//   value-row:   string per tier
//   soon-row:    "coming_soon" — all tiers show the Coming Soon indicator

type CellValue = boolean | string | 'coming_soon';

interface MatrixRow {
  label: string;
  tiers: Record<MembershipTier, CellValue>;
  /** Optional note shown below the label */
  note?: string;
}

const COMPARISON_FEATURES: MatrixRow[] = [
  // Community
  {
    label: 'View Community',
    tiers: { free: true, core: true, pro: true, elite: true },
  },
  {
    label: 'Post / Participate in Community',
    tiers: { free: 'View Only', core: true, pro: true, elite: true },
  },
  // Marketplace
  {
    label: 'Browse Spot Marketplace',
    tiers: { free: true, core: true, pro: true, elite: true },
  },
  {
    label: 'Purchase & View Spots',
    tiers: { free: true, core: true, pro: true, elite: true },
  },
  // Content creation
  {
    label: 'Create & Upload Content',
    tiers: { free: false, core: true, pro: true, elite: true },
  },
  {
    label: 'Edit / Organise Own Content',
    tiers: { free: false, core: true, pro: true, elite: true },
  },
  {
    label: 'Publish to Public Library',
    tiers: { free: false, core: true, pro: true, elite: true },
  },
  // Study tools
  {
    label: 'Hand History Replayer',
    tiers: { free: 'Limited', core: true, pro: true, elite: true },
  },
  {
    label: 'HH Saves',
    tiers: {
      free: `${ENTITLEMENTS.free.personalSpotsMonthly ?? 0}/mo`,
      core: ENTITLEMENTS.core.personalSpotsMonthly === null ? 'Unlimited' : `${ENTITLEMENTS.core.personalSpotsMonthly}/mo`,
      pro: ENTITLEMENTS.pro.personalSpotsMonthly === null ? 'Unlimited' : `${ENTITLEMENTS.pro.personalSpotsMonthly}/mo`,
      elite: ENTITLEMENTS.elite.personalSpotsMonthly === null ? 'Unlimited' : `${ENTITLEMENTS.elite.personalSpotsMonthly}/mo`,
    },
  },
  {
    label: 'Knowledge SyncShare',
    tiers: { free: false, core: true, pro: true, elite: true },
  },
  {
    label: 'HH SyncShare',
    tiers: { free: false, core: false, pro: true, elite: true },
  },
  {
    label: 'Full Analytics Suite',
    tiers: { free: false, core: false, pro: true, elite: true },
  },
  {
    label: 'Text Commentary',
    tiers: { free: false, core: true, pro: true, elite: true },
  },
  {
    label: 'Voice Commentary',
    tiers: { free: false, core: false, pro: true, elite: true },
  },
  // Coming Soon
  {
    label: 'AI Coach',
    tiers: { free: 'coming_soon', core: 'coming_soon', pro: 'coming_soon', elite: 'coming_soon' },
  },
  {
    label: 'Solver Access',
    tiers: { free: 'coming_soon', core: 'coming_soon', pro: 'coming_soon', elite: 'coming_soon' },
  },
  {
    label: 'Rewards',
    tiers: { free: 'coming_soon', core: 'coming_soon', pro: 'coming_soon', elite: 'coming_soon' },
  },
  {
    label: 'Mystery Vault',
    tiers: { free: 'coming_soon', core: 'coming_soon', pro: 'coming_soon', elite: 'coming_soon' },
  },
  {
    label: 'Monetize / Sell Spots',
    tiers: { free: 'coming_soon', core: 'coming_soon', pro: 'coming_soon', elite: 'coming_soon' },
  },
];

// ─── Cell renderer ───────────────────────────────────────────────────────────

function Cell({ value }: { value: CellValue }) {
  if (value === 'coming_soon') {
    return (
      <div className="flex items-center justify-center gap-0.5">
        <Clock className="h-3 w-3 shrink-0" style={{ color: GOLD }} strokeWidth={1.8} />
        <span className="hidden text-[7px] font-semibold tracking-wide sm:inline" style={{ color: GOLD_SOFT }}>Soon</span>
      </div>
    );
  }
  if (value === true) return <Check className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={2.5} />;
  if (value === false) return <Minus className="h-3 w-3" style={{ color: 'rgba(255,255,255,0.15)' }} strokeWidth={2} />;
  // String value — dim if it looks like zero/limited/view-only
  const isDim = value === '0' || value === '0/mo';
  return (
    <span
      className="text-center text-[8px] font-bold leading-tight"
      style={{ color: isDim ? DIM : GOLD_SOFT }}
    >
      {value}
    </span>
  );
}

// ─── Desktop card view ────────────────────────────────────────────────────────

export function MembershipComparison({ currentTier }: { currentTier?: MembershipTier }) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  if (isMobile) return <MobileComparison currentTier={currentTier} />;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TIER_ORDER.map((tier) => {
        const info = TIER_DISPLAY[tier];
        const isCurrent = tier === currentTier;
        return (
          <div
            key={tier}
            className="rounded-xl border p-4 transition-all"
            style={{
              borderColor: isCurrent ? 'rgba(212,165,44,0.4)' : 'rgba(212,165,44,0.10)',
              background: isCurrent ? 'rgba(212,165,44,0.06)' : 'rgba(8,10,12,0.55)',
              boxShadow: isCurrent ? '0 0 24px -8px rgba(212,165,44,0.2)' : 'none',
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-bold tracking-widest uppercase text-white">{info.name}</h3>
              {isCurrent && (
                <span
                  className="rounded-full border border-[#c0911e]/30 bg-[#c0911e]/10 px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase"
                  style={{ color: GOLD_SOFT }}
                >
                  Current
                </span>
              )}
            </div>
            <p className="mb-3 text-[14px] font-bold" style={{ color: GOLD }}>{info.price}</p>
            <ul className="space-y-1.5">
              {info.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3 w-3 shrink-0" style={{ color: GOLD }} strokeWidth={2} />
                  <span className="text-[10px] leading-relaxed text-white/60">{feature}</span>
                </li>
              ))}
            </ul>
            {!FEATURE_FLAGS.aiAssistEnabled && (
              <div className="mt-3 flex items-center gap-1 rounded-lg border border-[#d4a52c]/15 bg-[#d4a52c]/5 px-2.5 py-2">
                <Clock className="h-3 w-3 shrink-0" style={{ color: GOLD }} strokeWidth={1.8} />
                <span className="text-[9px] text-white/45">AI Coach — Coming Soon</span>
              </div>
            )}
            {!isCurrent && tier !== 'free' && (
              <button
                className="mt-3 w-full rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 py-2 text-[10px] font-bold tracking-widest uppercase transition-all hover:bg-[#c0911e]/20"
                style={{ color: GOLD_SOFT }}
              >
                Upgrade to {info.name}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Mobile comparison table ──────────────────────────────────────────────────

function MobileComparison({ currentTier }: { currentTier?: MembershipTier }) {
  return (
    <div
      className="w-full overflow-hidden rounded-xl border"
      style={{ borderColor: 'rgba(212,165,44,0.12)', background: 'rgba(8,10,12,0.6)' }}
    >
      {/* Sticky header row */}
      <div
        className="sticky top-0 z-10 grid border-b"
        style={{
          gridTemplateColumns: '1.4fr repeat(4, 1fr)',
          borderColor: 'rgba(212,165,44,0.15)',
          background: 'rgba(10,12,14,0.97)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="px-2 py-2 text-[8px] font-bold tracking-widest uppercase text-white/40">Feature</div>
        {TIER_ORDER.map((tier) => {
          const isCurrent = tier === currentTier;
          return (
            <div
              key={tier}
              className="px-1 py-2 text-center"
              style={{ background: isCurrent ? 'rgba(212,165,44,0.06)' : undefined }}
            >
              <span
                className="text-[8px] font-bold tracking-wider uppercase"
                style={{ color: isCurrent ? GOLD_SOFT : 'rgba(255,255,255,0.45)' }}
              >
                {TIER_DISPLAY[tier].name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Feature rows */}
      <div className="divide-y divide-white/[0.04]">
        {COMPARISON_FEATURES.map((feat, rowIndex) => (
          <div
            key={rowIndex}
            className="grid items-center"
            style={{ gridTemplateColumns: '1.4fr repeat(4, 1fr)' }}
          >
            <div className="px-2 py-2">
              <div className="text-[9px] font-medium leading-tight text-white/70">{feat.label}</div>
              {feat.note && <div className="mt-0.5 text-[7px] text-white/30">{feat.note}</div>}
            </div>
            {TIER_ORDER.map((tier) => {
              const isCurrent = tier === currentTier;
              return (
                <div
                  key={tier}
                  className="flex items-center justify-center px-1 py-2"
                  style={{ background: isCurrent ? 'rgba(212,165,44,0.04)' : undefined }}
                >
                  <Cell value={feat.tiers[tier]} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
