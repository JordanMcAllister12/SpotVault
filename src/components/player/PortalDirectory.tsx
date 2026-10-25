import { useEffect, useState, useCallback } from 'react';
import { Crown, ArrowLeft, Check, Lock, Sparkles, Users, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { isStaffOrAdmin, canAccessPortal, getPortalStatus, type SpotVaultAccount, type HubId } from '@/types';

interface PortalCatalogEntry {
  id: string;
  portal_type: string;
  hub_id: string | null;
  name: string;
  operator: string;
  logo_url: string | null;
  cover_url: string | null;
  description: string;
  monthly_price_cents: number | null;
  annual_price_cents: number | null;
  features: string[];
  status: string;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
  sort_order: number;
}

interface PortalMembership {
  id: string;
  portal_id: string;
  status: string;
  membership_type: string;
}

interface Props {
  account: SpotVaultAccount;
  onSwitchPortal: (portal: HubId) => void;
}

export function PortalDirectory({ account, onSwitchPortal }: Props) {
  const [portals, setPortals] = useState<PortalCatalogEntry[]>([]);
  const [memberships, setMemberships] = useState<Record<string, PortalMembership>>({});
  const [loading, setLoading] = useState(true);
  const [selectedPortal, setSelectedPortal] = useState<PortalCatalogEntry | null>(null);

  const loadPortals = useCallback(async () => {
    const { data, error } = await supabase
      .from('portal_catalog')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) { console.error('Portal catalog error:', error); return; }
    setPortals((data as unknown as PortalCatalogEntry[]) ?? []);
  }, []);

  const loadMemberships = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase
      .from('portal_memberships')
      .select('id, portal_id, status, membership_type')
      .eq('user_id', userData.user.id);
    if (error) { console.error('Memberships error:', error); return; }
    const map: Record<string, PortalMembership> = {};
    for (const row of (data as unknown as PortalMembership[]) ?? []) {
      map[row.portal_id] = row;
    }
    setMemberships(map);
  }, []);

  useEffect(() => {
    Promise.all([loadPortals(), loadMemberships()]).finally(() => setLoading(false));
  }, [loadPortals, loadMemberships]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d4a52c]/30 border-t-[#d4a52c]" />
      </div>
    );
  }

  if (selectedPortal) {
    return (
      <PortalDetailPage
        portal={selectedPortal}
        account={account}
        membership={memberships[selectedPortal.id] ?? null}
        onBack={() => setSelectedPortal(null)}
        onSwitchPortal={onSwitchPortal}
        onJoined={() => { void loadMemberships(); }}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-6">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <Crown className="h-5 w-5" style={{ color: '#d4a52c' }} strokeWidth={1.5} />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Portal Directory</h1>
            <p className="text-[11px] text-white/40">Discover and join premium portals powered by SpotVault</p>
          </div>
        </div>

        {/* Portal cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          {portals.map((p) => (
            <PortalCard
              key={p.id}
              portal={p}
              account={account}
              membership={memberships[p.id] ?? null}
              onClick={() => setSelectedPortal(p)}
              onEnter={() => {
                if (p.hub_id) onSwitchPortal(p.hub_id as HubId);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Portal Card ──────────────────────────────────────────────────

function PortalCard({
  portal, account, membership, onClick, onEnter,
}: {
  portal: PortalCatalogEntry;
  account: SpotVaultAccount;
  membership: PortalMembership | null;
  onClick: () => void;
  onEnter: () => void;
}) {
  const isStaff = isStaffOrAdmin(account);
  const canEnter = isStaff || (portal.hub_id ? canAccessPortal(account, portal.hub_id as HubId) : false);
  const isMember = membership?.status === 'subscribed' || membership?.status === 'staff_access';
  const priceLabel = portal.monthly_price_cents === null || portal.monthly_price_cents === 0
    ? 'Free'
    : `${(portal.monthly_price_cents / 100).toFixed(2)}/mo`;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-white/[0.06] bg-black/70 transition-all hover:border-[#c0911e]/20 hover:bg-black/80"
    >
      {/* Cover area */}
      <div className="relative h-20 overflow-hidden bg-gradient-to-br from-[#1a1d20] to-[#0a0c0e]">
        {portal.cover_url && (
          <img src={portal.cover_url} alt="" className="h-full w-full object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute bottom-2 left-3 flex items-center gap-2">
          {portal.logo_url ? (
            <img src={portal.logo_url} alt="" className="h-8 w-8 rounded-lg" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10">
              {portal.portal_type === 'partner' ? (
                <Crown className="h-4 w-4" style={{ color: '#d4a52c' }} strokeWidth={1.5} />
              ) : (
                <Building2 className="h-4 w-4 text-white/40" strokeWidth={1.5} />
              )}
            </div>
          )}
          <div>
            <div className="text-[12px] font-bold text-white">{portal.name}</div>
            <div className="text-[9px] text-white/40">{portal.operator}</div>
          </div>
        </div>
        {isMember && (
          <div className="absolute right-2 top-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-300">
            Joined
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        <p className="mb-2 line-clamp-2 text-[10px] leading-relaxed text-white/50">{portal.description}</p>
        <div className="mb-3 flex flex-wrap gap-1">
          {portal.features.slice(0, 3).map((f) => (
            <span key={f} className="rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-0.5 text-[8px] font-medium text-white/40">
              {f}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-white">{priceLabel}</span>
          {canEnter ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEnter(); }}
              className="flex items-center gap-1 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#f5e6b0] hover:bg-[#c0911e]/20"
            >
              <Lock className="h-2.5 w-2.5" /> Enter
            </button>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#d4a52c]">View Details</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Portal Detail Page ───────────────────────────────────────────

function PortalDetailPage({
  portal, account, membership, onBack, onSwitchPortal, onJoined,
}: {
  portal: PortalCatalogEntry;
  account: SpotVaultAccount;
  membership: PortalMembership | null;
  onBack: () => void;
  onSwitchPortal: (portal: HubId) => void;
  onJoined: () => void;
}) {
  const isStaff = isStaffOrAdmin(account);
  const canEnter = isStaff || (portal.hub_id ? canAccessPortal(account, portal.hub_id as HubId) : false);
  const isMember = membership?.status === 'subscribed' || membership?.status === 'staff_access';
  const hasStripe = !!(portal.stripe_price_id_monthly || portal.stripe_price_id_annual);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (hasStripe) {
      setJoinError('Paid checkout is not yet available for this portal. Stripe configuration is pending.');
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setJoinError('Please sign in to join.'); return; }
      const { error } = await supabase
        .from('portal_memberships')
        .insert({
          user_id: userData.user.id,
          portal_id: portal.id,
          status: 'subscribed',
          membership_type: 'free',
        });
      if (error) {
        if (error.code === '23505') {
          setJoinError('You are already a member of this portal.');
        } else {
          setJoinError(error.message);
        }
      } else {
        onJoined();
      }
    } catch {
      setJoinError('Failed to join portal.');
    } finally {
      setJoining(false);
    }
  };

  const sections = [
    { id: 'overview', label: 'Overview', icon: Sparkles },
    { id: 'included', label: "What's Included", icon: Check },
    { id: 'membership', label: 'Membership', icon: Crown },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 lg:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white/70"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Portals
        </button>

        {/* Header */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-black/70">
          <div className="relative h-28 overflow-hidden bg-gradient-to-br from-[#1a1d20] to-[#0a0c0e]">
            {portal.cover_url && <img src={portal.cover_url} alt="" className="h-full w-full object-cover opacity-30" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
            <div className="absolute bottom-3 left-4 flex items-center gap-3">
              {portal.logo_url ? (
                <img src={portal.logo_url} alt="" className="h-12 w-12 rounded-xl" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#c0911e]/30 bg-[#c0911e]/10">
                  {portal.portal_type === 'partner' ? (
                    <Crown className="h-6 w-6" style={{ color: '#d4a52c' }} strokeWidth={1.5} />
                  ) : (
                    <Building2 className="h-6 w-6 text-white/40" strokeWidth={1.5} />
                  )}
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-white">{portal.name}</h1>
                <p className="text-[11px] text-white/40">by {portal.operator}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Overview */}
        <div className="rounded-2xl border border-white/[0.06] bg-black/70 p-5">
          <h2 className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-white/60">
            <Sparkles className="h-3.5 w-3.5" style={{ color: '#d4a52c' }} /> Overview
          </h2>
          <p className="text-[12px] leading-relaxed text-white/60">{portal.description}</p>
        </div>

        {/* What's Included */}
        <div className="rounded-2xl border border-white/[0.06] bg-black/70 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-white/60">
            <Check className="h-3.5 w-3.5" style={{ color: '#d4a52c' }} /> What's Included
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {portal.features.map((f) => (
              <div key={f} className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                <Check className="h-3 w-3 shrink-0 text-emerald-400" strokeWidth={2} />
                <span className="text-[11px] text-white/60">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Membership */}
        <div className="rounded-2xl border border-white/[0.06] bg-black/70 p-5">
          <h2 className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-white/60">
            <Crown className="h-3.5 w-3.5" style={{ color: '#d4a52c' }} /> Membership
          </h2>
          <div className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-4 py-3">
            <div>
              <div className="text-[14px] font-bold text-white">
                {portal.monthly_price_cents === null || portal.monthly_price_cents === 0
                  ? 'Free'
                  : `$${(portal.monthly_price_cents / 100).toFixed(2)}/month`}
              </div>
              {portal.annual_price_cents && (
                <div className="text-[10px] text-white/40">
                  or $${(portal.annual_price_cents / 100).toFixed(2)}/year
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isMember ? (
                <button
                  type="button"
                  onClick={() => portal.hub_id && onSwitchPortal(portal.hub_id as HubId)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/15 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] hover:bg-[#c0911e]/25"
                >
                  <Lock className="h-3 w-3" /> Enter Portal
                </button>
              ) : canEnter ? (
                <button
                  type="button"
                  onClick={() => portal.hub_id && onSwitchPortal(portal.hub_id as HubId)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/15 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] hover:bg-[#c0911e]/25"
                >
                  <Lock className="h-3 w-3" /> Enter Portal
                </button>
              ) : hasStripe ? (
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={joining}
                  className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/20 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] hover:bg-[#c0911e]/30 disabled:opacity-50"
                >
                  {joining ? 'Processing...' : 'Subscribe'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={joining}
                  className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/20 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] hover:bg-[#c0911e]/30 disabled:opacity-50"
                >
                  {joining ? 'Joining...' : 'Join Portal'}
                </button>
              )}
            </div>
          </div>
          {joinError && (
            <p className="mt-2 text-[10px] text-red-300">{joinError}</p>
          )}

        </div>
      </div>
    </div>
  );
}
