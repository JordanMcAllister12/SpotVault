import { useState, useEffect } from 'react';
import {
  CreditCard, Crown, Check, X, Loader2, RefreshCw, AlertCircle,
  Calendar, DollarSign, RefreshCcw, ExternalLink, Sparkles, Share2, Bookmark,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { TIER_DISPLAY, TIER_ORDER, ENTITLEMENTS, type MembershipTier } from '@/lib/entitlements';
import { openStripeCheckout } from '@/lib/stripeCheckout';
import type { SpotVaultAccount } from '@/types';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';
const PANEL_BG = '#0a0d10';
const PANEL_BORDER = 'rgba(212,165,44,0.12)';

interface BillingRecord {
  transaction_id: string;
  type_code: string;
  gross_amount: number;
  currency: string;
  payment_status: string;
  created_at: string;
}

export function MembershipBillingTab({ account }: { account: SpotVaultAccount }) {
  const membership = useMembershipStatus(account);
  const [billingHistory, setBillingHistory] = useState<BillingRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!account?.id) return;
      setHistoryLoading(true);
      const { data } = await supabase
        .from('sv_transactions')
        .select('transaction_id, type_code, gross_amount, currency, payment_status, created_at')
        .eq('user_id', account.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setBillingHistory((data as BillingRecord[]) ?? []);
      setHistoryLoading(false);
    })();
  }, [account?.id]);

  async function handleCancelRenewal() {
    if (!membership.stripeSubscriptionId) {
      setCancelMessage('No active subscription found to cancel.');
      return;
    }
    setCancelLoading(true);
    setCancelMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          type: 'manage-billing',
          subscriptionId: membership.stripeSubscriptionId,
        },
      });
      if (error || data?.error) {
        setCancelMessage(data?.error ?? 'Unable to open billing management. Please try again.');
      } else if (data?.url) {
        openStripeCheckout(data.url);
      }
    } catch {
      setCancelMessage('Unable to connect to billing service. Please try again.');
    }
    setCancelLoading(false);
  }

  if (membership.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  const tierInfo = TIER_DISPLAY[membership.tier];
  const ent = ENTITLEMENTS[membership.tier];
  const isActive = membership.status === 'active';
  const isCanceled = membership.status === 'canceled';
  const isPaid = membership.tier !== 'free' && membership.stripeSubscriptionId;

  return (
    <div className="w-full space-y-4 px-5 py-4 sm:px-8 sm:py-3">
      {/* Current Membership Card */}
      <div className="rounded-2xl border p-4" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 shrink-0" strokeWidth={1.5} style={{ color: GOLD }} />
          <h3 className="text-sm font-bold tracking-wide text-white">Current Membership</h3>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <InfoRow label="Plan" value={tierInfo.name} highlight />
          <InfoRow label="Monthly Price" value={membership.priceLabel ?? tierInfo.price} highlight />
          <InfoRow
            label="Status"
            value={
              <span className="flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: isActive ? '#34d399' : isCanceled ? '#f87171' : '#94a3b8' }}
                />
                {isActive ? 'Active' : isCanceled ? 'Canceled' : membership.status === 'none' ? 'Free' : membership.status}
              </span>
            }
          />
          <InfoRow
            label="Auto-Renewal"
            value={isPaid && isActive ? 'On' : isCanceled ? 'Off' : 'N/A'}
          />
          {membership.currentPeriodEnd && (
            <InfoRow
              label="Next Billing Date"
              value={new Date(membership.currentPeriodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            />
          )}
          {isPaid && membership.monthlyPriceCents && (
            <InfoRow
              label="Next Charge"
              value={`$${(membership.monthlyPriceCents / 100).toFixed(2)} USD`}
            />
          )}
        </div>

        {isCanceled && membership.currentPeriodEnd && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" strokeWidth={1.5} />
            <p className="text-[11px] leading-relaxed text-amber-300/80">
              Your membership is canceled but remains active until {new Date(membership.currentPeriodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. After that, your account will revert to Free.
            </p>
          </div>
        )}
      </div>

      {/* Membership Benefits */}
      <div className="rounded-2xl border p-4" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0" strokeWidth={1.5} style={{ color: GOLD }} />
          <h3 className="text-[11px] font-bold tracking-widest text-white/70 uppercase">Membership Benefits</h3>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <BenefitChip
            icon={<Sparkles className="h-3 w-3" strokeWidth={1.5} />}
            label="Spots / Month"
            value={ent.personalSpotsMonthly === null ? '∞' : String(ent.personalSpotsMonthly)}
          />
          <BenefitChip
            icon={<Share2 className="h-3 w-3" strokeWidth={1.5} />}
            label="SyncShares"
            value={ent.syncSharesMonthly === null ? '∞' : String(ent.syncSharesMonthly)}
          />
          <BenefitChip
            icon={<Bookmark className="h-3 w-3" strokeWidth={1.5} />}
            label="Saved Tournaments"
            value={ent.savedTournaments === null ? '∞' : String(ent.savedTournaments)}
          />
        </div>
      </div>

      {/* Subscription Actions */}
      {isPaid && (
        <div className="rounded-2xl border p-4" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
          <h3 className="mb-3 text-[11px] font-bold tracking-widest text-white/70 uppercase">Subscription Actions</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCancelRenewal}
              disabled={cancelLoading}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-bold tracking-wider uppercase text-white/60 transition-colors hover:text-white/90 disabled:opacity-40"
            >
              {cancelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              {isCanceled ? 'Reactivate Renewal' : 'Cancel Auto-Renewal'}
            </button>
            <button
              onClick={handleCancelRenewal}
              disabled={cancelLoading}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[10px] font-bold tracking-wider uppercase text-white/60 transition-colors hover:text-white/90 disabled:opacity-40"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Manage Payment Method
            </button>
          </div>
          {cancelMessage && (
            <p className="mt-2 text-[10px] text-red-400/80">{cancelMessage}</p>
          )}
          <p className="mt-2 text-[9px] leading-relaxed text-white/35">
            Canceling auto-renewal preserves your benefits until the end of the current billing period. You will not be charged again. To reactivate, use the button above before your period ends.
          </p>
        </div>
      )}

      {/* Plan Comparison Summary */}
      <div className="rounded-2xl border p-4" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
        <h3 className="mb-3 text-[11px] font-bold tracking-widest text-white/70 uppercase">Plan Tiers</h3>
        <div className="grid grid-cols-4 gap-2">
          {TIER_ORDER.map((tier) => {
            const info = TIER_DISPLAY[tier];
            const isCurrent = tier === membership.tier;
            return (
              <div
                key={tier}
                className="rounded-lg border px-2 py-2 text-center"
                style={{
                  borderColor: isCurrent ? 'rgba(212,165,44,0.35)' : 'rgba(255,255,255,0.06)',
                  background: isCurrent ? 'rgba(212,165,44,0.05)' : 'transparent',
                }}
              >
                <p className="text-[9px] font-bold tracking-wider uppercase" style={{ color: isCurrent ? GOLD_SOFT : 'rgba(255,255,255,0.5)' }}>
                  {info.name}
                </p>
                <p className="mt-0.5 text-[10px] font-bold" style={{ color: isCurrent ? GOLD : 'rgba(255,255,255,0.3)' }}>
                  {info.price}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[9px] text-white/35">
          To change your plan, visit the Store.
        </p>
      </div>

      {/* Billing History */}
      <div className="rounded-2xl border p-4" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 shrink-0" strokeWidth={1.5} style={{ color: GOLD }} />
          <h3 className="text-[11px] font-bold tracking-widest text-white/70 uppercase">Billing History</h3>
        </div>
        {historyLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} />
          </div>
        ) : billingHistory.length === 0 ? (
          <p className="mt-3 text-[11px] text-white/40">No billing history yet. Your transactions will appear here once you make a purchase.</p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {billingHistory.map((record) => (
              <div key={record.transaction_id} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-black/20 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md border" style={{ borderColor: BORDER, background: 'rgba(212,165,44,0.06)' }}>
                    <Calendar className="h-3 w-3" style={{ color: GOLD }} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-white/80">{record.transaction_id}</p>
                    <p className="text-[8px] text-white/35">{new Date(record.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold" style={{ color: GOLD }}>
                    {record.type_code === 'REF' ? '-' : ''}{record.currency === 'USD' ? '$' : ''}{Math.abs(record.gross_amount).toFixed(2)}
                  </p>
                  <p className="text-[8px]" style={{ color: record.payment_status === 'complete' ? '#34d399' : record.payment_status === 'refunded' ? '#f87171' : '#94a3b8' }}>
                    {record.payment_status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="rounded-xl border px-3 py-2" style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}>
      <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-white/40">{label}</p>
      <p className="mt-0.5 text-[13px] font-bold" style={{ color: highlight ? GOLD_SOFT : 'rgba(255,255,255,0.85)' }}>
        {value}
      </p>
    </div>
  );
}

function BenefitChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const GOLD = '#d4a52c';
  return (
    <div className="rounded-lg border border-white/[0.05] bg-black/40 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <span style={{ color: GOLD }}>{icon}</span>
        <span className="text-[8px] font-mono tracking-widest uppercase text-white/35">{label}</span>
      </div>
      <p className="mt-0.5 text-[13px] font-bold text-white">{value}</p>
    </div>
  );
}
