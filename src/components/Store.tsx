import { useState, useEffect } from 'react';
import {
  ShoppingBag, ChevronRight, Star, Check, Gift,
  Crown, Sparkles, X, PenTool,
  FlaskConical, BriefcaseBusiness, Building2, Music, BarChart3, Clock,
  Info, type LucideIcon,
} from 'lucide-react';
import {
  SUBSCRIPTION_PRODUCTS,
  CREDIT_USES,
  ENTITLEMENT_ROWS,
} from '@/data/storeData';
import { BuyCreditsCalculator } from '@/components/BuyCreditsCalculator';
import {
  GOLD, GOLD_SOFT, CARD_BORDER as BORDER, CARD_BG, CARD_SHADOW,
  STORE_PADDING,
  HEADER_ICON_STYLE, HEADER_SUBTITLE_COLOR,
  FILTER_TAB_ACTIVE, FILTER_TAB_INACTIVE,
} from '@/components/store/storeTokens';
import { createCreditCheckout, createMembershipCheckout, openStripeCheckout } from '@/lib/stripeCheckout';
import { supabase } from '@/lib/supabase';
import { useMembershipStatus, type MembershipPhase } from '@/hooks/useMembershipStatus';
import { TIER_ORDER, TIER_DISPLAY, type MembershipTier } from '@/lib/entitlements';
import type { SpotVaultAccount } from '@/types';

type MainTab = 'memberships' | 'credits' | 'portals' | 'merch';

const TABS: readonly MainTab[] = ['memberships', 'credits', 'portals', 'merch'];
const TAB_LABELS: Record<MainTab, string> = {
  memberships: 'Memberships',
  credits: 'Credits',
  portals: 'Portals',
  merch: 'Merch',
};

const TIER_ICONS: Record<string, LucideIcon> = {
  free: Gift,
  core: BarChart3,
  pro: Sparkles,
  elite: Crown,
};

const PORTAL_ICONS: Record<string, LucideIcon> = {
  'creator-portal': PenTool,
  'coach-portal': FlaskConical,
  'stable-portal': BriefcaseBusiness,
  'business-portal': Building2,
  'media-portal': Music,
};

// All professional portals are Coming Soon at launch
const AVAILABLE_PORTAL_IDS = new Set<string>();

async function createPortalCheckout(portalId: string): Promise<{ url?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('create-checkout', {
    body: { type: 'portal', portalId },
  });
  if (error) return { error: 'Checkout is temporarily unavailable. Please try again shortly.' };
  if (data?.error) return { error: data.error };
  return { url: data?.url };
}

export function Store({ onNavigateToAdvertising, initialProviderFilter, onViewPlayer, account }: { onNavigateToAdvertising?: () => void; initialProviderFilter?: string; onViewPlayer?: (peopleProfileId: string) => void; account?: SpotVaultAccount | null }) {
  const [mainTab, setMainTab] = useState<MainTab>('memberships');

  return (
    <div className={`mx-auto max-w-5xl ${STORE_PADDING}`}> 
      <div
        className="mb-3 rounded-xl border px-3 py-2"
        style={{
          background: 'rgba(6, 8, 10, 0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          border: `1px solid ${BORDER}`,
          boxShadow: CARD_SHADOW,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={HEADER_ICON_STYLE}>
            <ShoppingBag className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD }} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold tracking-tight text-white">Store</h2>
            <span className="text-[9px] font-mono tracking-[0.2em] uppercase" style={{ color: HEADER_SUBTITLE_COLOR }}>
              Memberships, credits, merchandise and more.
            </span>
          </div>
          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setMainTab(tab)}
                className={`shrink-0 rounded-lg border px-2.5 py-1 text-[9px] font-semibold tracking-widest uppercase transition-all ${mainTab === tab ? FILTER_TAB_ACTIVE : FILTER_TAB_INACTIVE}`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto sm:hidden" style={{ scrollbarWidth: 'none' }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              className={`shrink-0 rounded-lg border px-2.5 py-1 text-[9px] font-semibold tracking-widest uppercase transition-all ${mainTab === tab ? FILTER_TAB_ACTIVE : FILTER_TAB_INACTIVE}`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      {mainTab === 'memberships' && <MembershipsTab account={account} />}
      {mainTab === 'credits' && <CreditsTab />}
      {mainTab === 'portals' && <PortalsTab />}
      {mainTab === 'merch' && <MerchTab />}
    </div>
  );
}

// ── MEMBERSHIPS ──────────────────────────────────────────────────

const TIER_ORDER_MAP: Record<MembershipTier, number> = { free: 0, core: 1, pro: 2, elite: 3 };

function MembershipsTab({ account: propAccount }: { account?: SpotVaultAccount | null }) {
  const [localAccount, setLocalAccount] = useState<SpotVaultAccount | null>(propAccount ?? null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<MembershipTier | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [pendingTier, setPendingTier] = useState<MembershipTier | null>(null);

  useEffect(() => {
    if (propAccount) { setLocalAccount(propAccount); return; }
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setLocalAccount({ id: user.id, name: user.email ?? '', email: user.email } as SpotVaultAccount);
    })();
  }, [propAccount]);

  const account = localAccount;

  const membership = useMembershipStatus(account);
  const currentTier = membership.tier;
  const currentTierIdx = TIER_ORDER_MAP[currentTier];
  const membershipUnknown = membership.phase === 'unknown' || membership.phase === 'loading';
  const membershipResolved = !!account && membership.phase === 'resolved';

  async function handleSubscribe(tier: 'core' | 'pro' | 'elite') {
    setPurchasing(tier);
    setError(null);
    const result = await createMembershipCheckout(tier);
    setPurchasing(null);
    if (result.error) setError(result.error);
    else if (result.url) openStripeCheckout(result.url);
  }

  function handleCardAction(tier: MembershipTier) {
    if (tier === 'free') return;
    if (tier === currentTier) return;
    const tierIdx = TIER_ORDER_MAP[tier];
    if (tierIdx > currentTierIdx) {
      // Upgrade — needs consent
      setPendingTier(tier);
      setConsentChecked(false);
    } else {
      // Downgrade — also needs consent
      setPendingTier(tier);
      setConsentChecked(false);
    }
  }

  function confirmCheckout() {
    if (!pendingTier || !consentChecked) return;
    void handleSubscribe(pendingTier as 'core' | 'pro' | 'elite');
    setPendingTier(null);
    setConsentChecked(false);
  }

  const memberships = SUBSCRIPTION_PRODUCTS.filter((p) => !p.portalProduct);

  function getCardAction(tier: MembershipTier): { label: string; disabled: boolean; variant: 'current' | 'subscribe' | 'upgrade' | 'downgrade' | 'info' | 'loading' } {
    if (membershipUnknown) return { label: ' ', disabled: true, variant: 'loading' };
    if (!membershipResolved) return { label: ' ', disabled: true, variant: 'loading' };
    if (tier === currentTier) return { label: 'Current Plan', disabled: true, variant: 'current' };
    if (currentTier === 'free' && tier !== 'free') return { label: 'Select', disabled: false, variant: 'subscribe' };
    const tierIdx = TIER_ORDER_MAP[tier];
    if (tierIdx > currentTierIdx) return { label: 'Select', disabled: false, variant: 'upgrade' };
    if (tier === 'free') return { label: 'Select', disabled: false, variant: 'info' };
    return { label: 'Select', disabled: false, variant: 'downgrade' };
  }

  return (
    <div>
      <div className="mb-3">
        <h3 className="text-sm font-bold text-white">SpotVault Plans</h3>
        <p className="mt-0.5 text-[10px] text-white/35">Choose the plan that fits your game. Cancel or change anytime.</p>
      </div>

      {/* Compact 2×2 grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {TIER_ORDER.map((tier) => {
          const p = memberships.find((m) => m.id === tier)!;
          const Icon = TIER_ICONS[tier] ?? BarChart3;
          const isCurrent = membershipResolved && tier === currentTier;
          const action = getCardAction(tier);
          return (
            <div
              key={tier}
              className="rounded-xl border p-3 transition-all"
              style={{
                borderColor: isCurrent ? 'rgba(212,165,44,0.4)' : BORDER,
                background: CARD_BG,
                boxShadow: isCurrent ? '0 0 16px -6px rgba(212,165,44,0.2)' : CARD_SHADOW,
              }}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}25` }}>
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-bold leading-tight text-white">{p.name}</h4>
                    {p.badge && (
                      <span className="text-[7px] font-bold tracking-widest text-[#d4a52c] uppercase">{p.badge}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowDetails(tier)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white/30 transition-colors hover:text-[#d4a52c]"
                  aria-label={`Learn about ${p.name}`}
                >
                  <Info className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </div>

              <div className="mt-2 text-[15px] font-bold leading-none" style={{ color: GOLD }}>{p.priceLabel}</div>
              <p className="mt-1 text-[9px] leading-snug text-white/40">{p.tagline}</p>

              <button
                onClick={() => handleCardAction(tier)}
                disabled={action.disabled || purchasing === tier}
                className={`mt-2.5 flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[9px] font-bold tracking-widest uppercase transition-all disabled:opacity-40 ${
                  action.variant === 'current' || action.variant === 'loading'
                    ? 'border-white/10 bg-white/5 text-white/40'
                    : 'border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 text-[#f5e6b0] hover:from-[#c0911e]/25 hover:to-[#835e17]/25'
                }`}
              >
                {purchasing === tier ? 'Loading...' : action.label}
                {action.variant !== 'current' && <ChevronRight className="h-2.5 w-2.5" strokeWidth={1.5} />}
              </button>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-[10px] text-red-400/80">{error}</div>
      )}

      {/* Comparison */}
      <div className="mt-5 rounded-xl border p-3" style={{ borderColor: BORDER, background: 'rgba(12,10,8,0.72)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: CARD_SHADOW }}>
        <h3 className="mb-2 text-sm font-bold text-white">Compare Plans</h3>
        <DesktopComparisonTable currentTier={membershipResolved ? currentTier : undefined} />
      </div>

      {/* Coming Soon section */}
      <div className="mt-5 rounded-xl border border-[#d4a52c]/15 bg-[#d4a52c]/[0.03] p-4">
        <div className="mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <h3 className="text-sm font-bold text-white">Coming Soon</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { name: 'AI Coach', desc: 'Intelligent coaching assistant' },
            { name: 'Solver', desc: 'GTO solver integration' },
            { name: 'Rewards', desc: 'Earn rewards through activity' },
            { name: 'Mystery Vault', desc: 'Randomized reward unlocks' },
          ].map((item) => (
            <div key={item.name} className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="rounded-full border border-[#d4a52c]/20 bg-[#d4a52c]/10 px-1.5 py-0.5 text-[7px] font-bold tracking-widest uppercase" style={{ color: GOLD_SOFT }}>Soon</span>
                <span className="text-[11px] font-bold text-white/70">{item.name}</span>
              </div>
              <p className="mt-1 text-[9px] leading-relaxed text-white/35">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Details modal */}
      {showDetails && (
        <TierDetailsModal
          tier={showDetails}
          product={memberships.find((m) => m.id === showDetails)!}
          onClose={() => setShowDetails(null)}
          currentTier={membershipResolved ? currentTier : 'free'}
        />
      )}

      {/* Checkout consent modal */}
      {pendingTier && (
        <CheckoutConsentModal
          tier={pendingTier}
          product={memberships.find((m) => m.id === pendingTier)!}
          isUpgrade={membershipResolved && TIER_ORDER_MAP[pendingTier] > currentTierIdx}
          currentTier={currentTier}
          consentChecked={consentChecked}
          onConsentChange={setConsentChecked}
          onConfirm={confirmCheckout}
          onCancel={() => { setPendingTier(null); setConsentChecked(false); }}
          loading={purchasing === pendingTier}
        />
      )}
    </div>
  );
}

function TierDetailsModal({ tier, product, onClose, currentTier }: {
  tier: MembershipTier;
  product: typeof SUBSCRIPTION_PRODUCTS[0];
  onClose: () => void;
  currentTier: MembershipTier;
}) {
  const Icon = TIER_ICONS[tier] ?? BarChart3;
  const info = TIER_DISPLAY[tier];
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border p-5"
        style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(10,9,8,0.96)', backdropFilter: 'blur(20px)', boxShadow: '0 24px 60px -16px rgba(0,0,0,0.9)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}>
              <Icon className="h-5 w-5" strokeWidth={1.5} style={{ color: GOLD }} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{product.name}</h3>
              <span className="text-[10px] font-mono tracking-wider text-[#d4a52c]/60 uppercase">{info.price}</span>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-white/60">{product.description}</p>
        {product.features && product.features.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {product.features.map((feat, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-white/70">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: GOLD }} strokeWidth={1.5} />
                {feat}
              </li>
            ))}
          </ul>
        )}
        {product.longDescription && (
          <p className="mt-3 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-[10px] leading-relaxed whitespace-pre-line text-white/45">{product.longDescription}</p>
        )}
      </div>
    </div>
  );
}

function CheckoutConsentModal({ tier, product, isUpgrade, currentTier, consentChecked, onConsentChange, onConfirm, onCancel, loading }: {
  tier: MembershipTier;
  product: typeof SUBSCRIPTION_PRODUCTS[0];
  isUpgrade: boolean;
  currentTier: MembershipTier;
  consentChecked: boolean;
  onConsentChange: (v: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border p-5"
        style={{ borderColor: 'rgba(212,165,44,0.25)', background: 'rgba(10,9,8,0.96)', backdropFilter: 'blur(20px)', boxShadow: '0 24px 60px -16px rgba(0,0,0,0.9)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            {isUpgrade ? 'Upgrade' : 'Switch'} to {product.name}
          </h3>
          <button onClick={onCancel} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-3 text-[11px] leading-relaxed text-white/70">
          <div className="flex justify-between">
            <span className="text-white/45">Membership</span>
            <span className="font-bold text-white">{product.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/45">Price</span>
            <span className="font-bold" style={{ color: GOLD }}>{product.priceLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/45">Billing</span>
            <span className="text-white/80">Automatic monthly renewal</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/45">First charge</span>
            <span className="text-white/80">{product.priceLabel} today</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/45">Next billing date</span>
            <span className="text-white/80">In 30 days</span>
          </div>
        </div>

        {isUpgrade ? (
          <p className="mt-3 text-[10px] leading-relaxed text-white/45">
            Your upgrade will be prorated. The prorated amount will be shown at Stripe checkout before you confirm payment.
          </p>
        ) : (
          <p className="mt-3 text-[10px] leading-relaxed text-white/45">
            This change takes effect at the end of your current billing period. Your {TIER_DISPLAY[currentTier].name} benefits remain active until then.
          </p>
        )}

        <label className="mt-4 flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => onConsentChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#d4a52c]"
          />
          <span className="text-[11px] leading-relaxed text-white/70">
            I authorize SpotVault to charge {product.priceLabel} now and automatically every month until I cancel or change my plan. I understand I can cancel anytime from My Account.
          </span>
        </label>

        <button
          onClick={onConfirm}
          disabled={!consentChecked || loading}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-4 py-2.5 text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/25 hover:to-[#835e17]/25 disabled:opacity-30"
        >
          {loading ? 'Redirecting...' : `Continue to Checkout`}
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <p className="mt-2 text-center text-[9px] text-white/30">
          You will be redirected to Stripe to complete payment securely.
        </p>
      </div>
    </div>
  );
}

function DesktopComparisonTable({ currentTier }: { currentTier?: MembershipTier }) {
  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: BORDER, background: CARD_BG }}>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="px-3 py-2 text-[9px] font-semibold tracking-widest text-white/50 uppercase">Feature</th>
            <th className="px-3 py-2 text-[9px] font-semibold tracking-widest uppercase" style={{ color: currentTier === 'free' ? GOLD : 'rgba(255,255,255,0.5)' }}>Free</th>
            <th className="px-3 py-2 text-[9px] font-semibold tracking-widest uppercase" style={{ color: currentTier === 'core' ? GOLD : 'rgba(255,255,255,0.5)' }}>Core</th>
            <th className="px-3 py-2 text-[9px] font-semibold tracking-widest uppercase" style={{ color: currentTier === 'pro' ? GOLD : 'rgba(255,255,255,0.5)' }}>Pro</th>
            <th className="px-3 py-2 text-[9px] font-semibold tracking-widest uppercase" style={{ color: currentTier === 'elite' ? GOLD : 'rgba(255,255,255,0.5)' }}>Elite</th>
          </tr>
        </thead>
        <tbody>
          {ENTITLEMENT_ROWS.map((row, i) => (
            <tr key={row.feature} className={i % 2 === 0 ? 'bg-white/[0.02]' : ''}>
              <td className="px-3 py-1.5 text-[10px] text-white/55">{row.feature}</td>
              <td className="px-3 py-1.5 text-[10px] text-white/45">{typeof row.free === 'boolean' ? (row.free ? <Check className="h-3 w-3 text-emerald-400" strokeWidth={2} /> : <X className="h-3 w-3 text-white/20" strokeWidth={2} />) : row.free}</td>
              <td className="px-3 py-1.5 text-[10px] text-white/45">{typeof row.core === 'boolean' ? (row.core ? <Check className="h-3 w-3 text-emerald-400" strokeWidth={2} /> : <X className="h-3 w-3 text-white/20" strokeWidth={2} />) : row.core}</td>
              <td className="px-3 py-1.5 text-[10px] text-white/45">{typeof row.pro === 'boolean' ? (row.pro ? <Check className="h-3 w-3 text-emerald-400" strokeWidth={2} /> : <X className="h-3 w-3 text-white/20" strokeWidth={2} />) : row.pro}</td>
              <td className="px-3 py-1.5 text-[10px] text-[#f5e6b0]">{typeof row.elite === 'boolean' ? (row.elite ? <Check className="h-3 w-3 text-emerald-400" strokeWidth={2} /> : <X className="h-3 w-3 text-white/20" strokeWidth={2} />) : row.elite}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── CREDITS ───────────────────────────────────────────────────────

function CreditsTab() {
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase(quantity: number) {
    setPurchasing(true);
    setError(null);
    const result = await createCreditCheckout(quantity);
    setPurchasing(false);
    if (result.error) setError(result.error);
    else if (result.url) openStripeCheckout(result.url);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: CARD_BG, boxShadow: CARD_SHADOW }}>
        <BuyCreditsCalculator onPurchase={handlePurchase} />
        {purchasing && <div className="mt-3 text-center text-[10px] text-white/40">Redirecting to checkout...</div>}
        {error && <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-[10px] text-red-400/80">{error}</div>}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-bold text-white">Use Credits For</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CREDIT_USES.map((use) => (
            <div key={use} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: BORDER, background: CARD_BG }}>
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={2} />
              <span className="text-[11px] text-white/55">{use}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PORTALS ───────────────────────────────────────────────────────

function PortalsTab() {
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const portalProducts = SUBSCRIPTION_PRODUCTS.filter((p) => p.portalProduct);

  async function handleGetPortal(portalId: string) {
    setPurchasing(portalId);
    setError(null);
    const result = await createPortalCheckout(portalId);
    setPurchasing(null);
    if (result.error) setError(result.error);
    else if (result.url) openStripeCheckout(result.url);
  }

  return (
    <div>
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">Professional Portals</h3>
        <p className="mt-0.5 text-[10px] text-white/35">Specialized workspaces and professional tools built for the poker industry.</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {portalProducts.map((p) => {
          const Icon = PORTAL_ICONS[p.id] ?? Building2;
          const isAvailable = AVAILABLE_PORTAL_IDS.has(p.id);
          return (
            <div
              key={p.id}
              className={`rounded-xl border p-3.5 transition-all ${isAvailable ? 'hover:border-[#c0911e]/40' : 'opacity-65'}`}
              style={{
                borderColor: isAvailable ? 'rgba(212,165,44,0.28)' : BORDER,
                background: isAvailable ? 'rgba(12,10,6,0.9)' : CARD_BG,
                boxShadow: isAvailable ? '0 0 0 1px rgba(212,165,44,0.08), 0 8px 32px rgba(0,0,0,0.4)' : CARD_SHADOW,
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: isAvailable ? `${GOLD}18` : `${GOLD}08`,
                    border: `1px solid ${isAvailable ? GOLD + '35' : GOLD + '15'}`,
                  }}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} style={{ color: isAvailable ? GOLD : GOLD + '60' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h4 className={`text-sm font-bold ${isAvailable ? 'text-white' : 'text-white/50'}`}>{p.name}</h4>
                    {isAvailable && (
                      <span className="inline-flex items-center gap-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[7px] font-bold tracking-widest text-emerald-400 uppercase">
                        Available
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] leading-relaxed text-white/30">{p.tagline}</p>
                </div>
              </div>

              {isAvailable && (
                <>
                  <div className="mt-3 break-words text-sm font-bold" style={{ color: GOLD }}>{p.priceLabel}</div>
                  {p.contactForPricing && (
                    <div className="mt-1.5 break-words rounded border border-[#c0911e]/20 bg-[#c0911e]/5 px-2 py-1 text-[9px] leading-relaxed text-[#d4a52c]">
                      Contact us about custom pricing: <a href="mailto:ceo@thespotvault.com" className="underline break-all">ceo@thespotvault.com</a>
                    </div>
                  )}
                  {p.features && p.features.length > 0 && (
                    <ul className="mt-2.5 space-y-1">
                      {p.features.map((feat, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-white/45">
                          <Check className="mt-0.5 h-3 w-3 shrink-0" style={{ color: GOLD + 'aa' }} strokeWidth={1.5} />
                          {feat}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              <div className="mt-3 flex justify-end border-t border-[#1a1f25] pt-2.5">
                {isAvailable ? (
                  <button
                    onClick={() => handleGetPortal(p.id)}
                    disabled={purchasing === p.id}
                    className="flex items-center gap-1 rounded-md border border-[#c0911e]/40 bg-gradient-to-b from-[#c0911e]/15 to-[#835e17]/15 px-3 py-1.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/25 hover:to-[#835e17]/25 disabled:opacity-50"
                  >
                    {purchasing === p.id ? 'Loading...' : 'Get Portal'} <ChevronRight className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                ) : (
                  <span className="flex cursor-default items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold tracking-widest text-white/20 uppercase">
                    <Clock className="h-3 w-3" strokeWidth={1.5} />
                    Coming Soon
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.06] px-3 py-2 text-[10px] text-red-400/80">{error}</div>
      )}
    </div>
  );
}

// ── MERCH ─────────────────────────────────────────────────────────

function MerchTab() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#c0911e]/20 bg-[#c0911e]/8">
        <Gift className="h-7 w-7" style={{ color: GOLD }} strokeWidth={1.5} />
      </div>
      <h3 className="mt-5 text-sm font-bold tracking-widest text-white/50 uppercase">Merchandise</h3>
      <p className="mt-2 text-[12px] text-white/35">SpotVault merchandise is on the way.</p>
    </div>
  );
}
