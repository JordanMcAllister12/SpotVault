import { useEffect, useState } from 'react';
import {
  Crown, Zap, Receipt, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCreditBalance, getCreditLedger, type CreditLedgerEntry } from '@/lib/monetizationStore';
import { type MembershipTier } from '@/lib/entitlements';
import type { SpotVaultAccount } from '@/types';
import { PasswordSection } from '@/components/player/PasswordSection';
import { TwoFactorSection } from '@/components/player/TwoFactorSection';
import { BuyCreditsCalculator } from '@/components/BuyCreditsCalculator';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';
const PANEL_BG = '#0a0d10';
const PANEL_BORDER = 'rgba(212,165,44,0.12)';

interface Props {
  account: SpotVaultAccount;
  portalContext?: 'player' | 'stakekings';
}

export function AccountSecurityTab({ account, portalContext }: Props) {
  const [email, setEmail] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  const tier = deriveTier(account);
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const initials = account.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (user?.email) setEmail(user.email);
      const [bal, entries] = await Promise.all([
        getCreditBalance(account.id),
        getCreditLedger(account.id, 10),
      ]);
      if (!active) return;
      setCreditBalance(bal);
      setLedger(entries);
    })();
    return () => { active = false; };
  }, [account.id]);

  return (
    <div className="w-full px-5 py-4 sm:px-8 sm:py-3 space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Left column: Identity + Security */}
        <div className="space-y-3">
          {/* Identity card — badge stays, membership details removed */}
          <div className="rounded-2xl border p-4 sm:p-3" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
            <div className="flex items-center gap-3 sm:gap-2.5">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold text-white sm:h-11 sm:w-11 sm:text-sm"
                style={{ background: 'linear-gradient(135deg, #d4a52c, #6b4a14)' }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold text-white">{account.name}</h2>
                <p className="truncate text-[11px] text-white/50">@{account.username}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span
                    className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wide uppercase"
                    style={{ borderColor: GOLD + '30', background: GOLD + '10', color: GOLD_SOFT }}
                  >
                    {tier === 'elite' && <Crown className="h-2.5 w-2.5" strokeWidth={2} />}
                    {tierLabel} Member
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-bold tracking-wide uppercase text-white/50">
                    {account.homePortal} Portal
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Security — password + 2FA */}
          <div className="rounded-2xl border p-4 sm:p-3" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
            <div className="mb-2 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} style={{ color: GOLD }} />
              <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">Security</h3>
            </div>
            <PasswordSection email={email} />
            <TwoFactorSection email={email} />
          </div>
        </div>

        {/* Right column: Wallet + Account email */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40">Credits & Wallet</h3>
          <div className="rounded-2xl border p-4 sm:p-3" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 sm:gap-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl sm:h-8 sm:w-8"
                  style={{ background: 'linear-gradient(135deg, rgba(212,165,44,0.12), rgba(212,165,44,0.04))', border: `1px solid ${BORDER}` }}
                >
                  <Zap className="h-3.5 w-3.5 sm:h-3 sm:w-3" strokeWidth={1.5} style={{ color: GOLD }} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white">SpotVault Wallet</p>
                  <p className="text-[10px] text-white/50">{creditBalance === null ? 'Loading…' : `${creditBalance.toLocaleString()} credits`}</p>
                </div>
              </div>
              <button
                onClick={() => setLedgerOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-white/50 transition-all hover:border-white/20 hover:text-white/80"
              >
                <Receipt className="h-3 w-3" strokeWidth={1.5} />
                History
              </button>
            </div>

            {ledgerOpen && (
              <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/40 p-3">
                {ledger.length === 0 ? (
                  <p className="py-3 text-center text-[10px] text-white/35">No transactions yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {ledger.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between text-[11px]">
                        <span className="text-white/55">{entry.transaction_type.replace(/_/g, ' ')}</span>
                        <span className={entry.amount >= 0 ? 'font-semibold text-emerald-300' : 'font-semibold text-red-300/80'}>
                          {entry.amount >= 0 ? '+' : ''}{entry.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 sm:mt-2">
              <BuyCreditsCalculator compact />
            </div>
          </div>

          {/* Account email */}
          <div className="rounded-2xl border p-4 sm:p-3" style={{ borderColor: PANEL_BORDER, background: PANEL_BG }}>
            <h3 className="mb-2 text-[10px] font-bold tracking-widest text-white/40 uppercase">Account Email</h3>
            <p className="text-[12px] text-white/85">{email ?? '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function deriveTier(account: SpotVaultAccount): MembershipTier {
  if (account.role === 'developer_admin' || account.role === 'superuser') return 'elite';
  if (account.role === 'staff') return 'pro';
  return 'free';
}
