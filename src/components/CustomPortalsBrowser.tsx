import { useState, useEffect, useMemo } from 'react';
import { Search, KeyRound, Loader2, Sparkles, X, Crown, ArrowRight, Check } from 'lucide-react';
import { redeemPortalCode, getMyPortalMemberships, getAllCustomPortals, type CustomPortalMembership } from '@/lib/portalAccessStore';
import type { SpotVaultAccount } from '@/types';
import { isStaffOrAdmin } from '@/types';

interface PortalInfo {
  id: string;
  slug: string;
  name: string;
  base_portal: string;
  active: boolean;
  category: string;
  config: CustomPortalMembership['config'];
}

interface Props {
  open: boolean;
  onClose: () => void;
  account: SpotVaultAccount | null;
  onEnterPortal: (portal: CustomPortalMembership) => void;
  onRedeemed?: (membership: CustomPortalMembership) => void;
  existingMemberships?: CustomPortalMembership[];
}

const CATEGORY_LABELS: Record<string, string> = {
  community: 'Community Portal',
  partner: 'Partner Portal',
  staking: 'Staking Portal',
  training: 'Training Portal',
  business: 'Business Portal',
  organization: 'Organization Portal',
  event: 'Event Portal',
};

const SHELL_CLASS = 'rounded-xl border border-[#c0911e]/12 bg-[rgba(8,11,14,0.72)] p-4 backdrop-blur-md shadow-lg sm:p-5';

export function CustomPortalsBrowser({ open, onClose, account, onEnterPortal, onRedeemed, existingMemberships }: Props) {
  const [search, setSearch] = useState('');
  const [myPortals, setMyPortals] = useState<CustomPortalMembership[]>(existingMemberships ?? []);
  const [allPortals, setAllPortals] = useState<PortalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeValue, setCodeValue] = useState('');
  const [codeSubmitting, setCodeSubmitting] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [codeSuccess, setCodeSuccess] = useState('');
  const [enteredPortalSlug, setEnteredPortalSlug] = useState<string | null>(null);

  const isStaff = account ? isStaffOrAdmin(account) : false;

  useEffect(() => {
    if (!open) return;
    loadData();
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    const [memberships, portals] = await Promise.all([
      getMyPortalMemberships(),
      getAllCustomPortals(),
    ]);
    setMyPortals(memberships.length > 0 ? memberships : (existingMemberships ?? []));
    setAllPortals(portals as PortalInfo[]);
    setLoading(false);
  };

  useEffect(() => {
    if (existingMemberships && existingMemberships.length > 0 && myPortals.length === 0) {
      setMyPortals(existingMemberships);
    }
  }, [existingMemberships]);

  const myPortalSlugs = new Set(myPortals.map((m) => m.portal_slug));

  const availablePortals = useMemo(() => {
    if (!isStaff) return [];
    return allPortals.filter((p) => p.active && !myPortalSlugs.has(p.slug));
  }, [allPortals, isStaff, myPortalSlugs]);

  const filteredMyPortals = useMemo(() => {
    if (!search.trim()) return myPortals;
    const q = search.toLowerCase();
    return myPortals.filter((m) =>
      m.portal_name.toLowerCase().includes(q) ||
      m.portal_slug.toLowerCase().includes(q) ||
      (m.base_portal || '').toLowerCase().includes(q)
    );
  }, [myPortals, search]);

  const filteredAvailable = useMemo(() => {
    if (!search.trim()) return availablePortals;
    const q = search.toLowerCase();
    return availablePortals.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [availablePortals, search]);

  const handleRedeem = async () => {
    if (codeSubmitting || !codeValue.trim()) return;
    setCodeSubmitting(true);
    setCodeError('');
    setCodeSuccess('');
    const result = await redeemPortalCode(codeValue.trim());
    setCodeSubmitting(false);
    if (!result.ok) {
      setCodeError(result.error || 'Invalid code.');
      return;
    }
    const newMembership: CustomPortalMembership = {
      portal_id: result.portal_id || '',
      portal_slug: result.portal_slug || '',
      portal_name: result.portal_name || '',
      base_portal: result.base_portal || 'PLAYER',
      config: result.config || {},
      status: 'active',
      access_expires_at: result.access_expires_at || '',
      membership_tier: 'full',
      entitlement_package: {},
    };
    setMyPortals((prev) => [...prev.filter((m) => m.portal_slug !== newMembership.portal_slug), newMembership]);
    setCodeSuccess(`${result.portal_name?.toUpperCase()} UNLOCKED`);
    setCodeValue('');
    onRedeemed?.(newMembership);
    setTimeout(() => setCodeSuccess(''), 3000);
  };

  const handleEnter = (portal: CustomPortalMembership) => {
    setEnteredPortalSlug(portal.portal_slug);
    onEnterPortal(portal);
    setTimeout(() => { onClose(); setEnteredPortalSlug(null); }, 200);
  };

  if (!open) return null;

  const showStakeKings = account && (isStaff || account.partnerHubAccess?.['stakekings_hub_access'] || account.partnerHubAccess?.['stakekings_admin_access']);

  return (
    <div className="relative z-10 mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-6">
      {/* Title */}
      <div className="mb-4 text-center">
        <div className="inline-flex items-center gap-2">
          <Crown className="h-5 w-5 text-[#d4a52c]" strokeWidth={1.5} />
          <h2 className="text-base font-bold tracking-[0.2em] text-white uppercase sm:text-lg">Custom Portals</h2>
        </div>
        <p className="mt-1 text-[11px] text-[#84929f] sm:text-xs">Access your partner, community and organization portals.</p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className={`${SHELL_CLASS} flex items-center gap-2 !py-2.5`}>
          <Search className="h-4 w-4 text-[#5f6e7c] shrink-0" strokeWidth={1.5} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search portals..."
            className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-[#5f6e7c]"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-[#5f6e7c] hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#d4a52c]" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* MY PORTALS shell */}
          <div className={SHELL_CLASS}>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-[0.25em] text-[#84929f] uppercase">My Portals</span>
              <span className="text-[10px] text-[#364049]">({filteredMyPortals.length})</span>
            </div>
            {filteredMyPortals.length === 0 ? (
              <p className="py-3 text-center text-[11px] text-white/35">
                {search ? 'No portals match your search.' : 'No custom portals unlocked yet. Enter a portal code below to get started.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredMyPortals.map((portal) => (
                  <PortalCard
                    key={portal.portal_id}
                    name={portal.portal_name}
                    slug={portal.portal_slug}
                    category={portal.category}
                    status="active"
                    expiresAt={portal.access_expires_at}
                    isStaff={isStaff}
                    isEntered={enteredPortalSlug === portal.portal_slug}
                    onEnter={() => handleEnter(portal)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ALL CUSTOM PORTALS shell (staff/superuser only) */}
          {isStaff && filteredAvailable.length > 0 && (
            <div className={SHELL_CLASS}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-[0.25em] text-[#84929f] uppercase">All Custom Portals</span>
                <span className="text-[10px] text-[#364049]">({filteredAvailable.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAvailable.map((portal) => (
                  <PortalCard
                    key={portal.id}
                    name={portal.name}
                    slug={portal.slug}
                    category={portal.category}
                    status="available"
                    isStaff={isStaff}
                    onEnter={() => {
                      const membership: CustomPortalMembership = {
                        portal_id: portal.id,
                        portal_slug: portal.slug,
                        portal_name: portal.name,
                        base_portal: portal.base_portal,
                        config: portal.config,
                        status: 'active',
                        access_expires_at: '',
                        membership_tier: 'staff',
                        entitlement_package: {},
                        category: portal.category,
                      };
                      handleEnter(membership);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* PARTNER PORTALS shell */}
          {showStakeKings && (
            <div className={SHELL_CLASS}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-[0.25em] text-[#84929f] uppercase">Partner Portals</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {account?.partnerHubAccess?.['stakekings_hub_access'] && (
                  <PortalCard
                    name="StakeKings Player Development"
                    slug="stakekings-player"
                    category="partner"
                    status="active"
                    isStaff={isStaff}
                    onEnter={() => {
                      handleEnter({
                        portal_id: 'stakekings-player',
                        portal_slug: 'stakekings-player',
                        portal_name: 'StakeKings Player Development',
                        base_portal: 'STAKEKINGS_PLAYER',
                        config: {},
                        status: 'active',
                        access_expires_at: '',
                        membership_tier: 'full',
                        entitlement_package: {},
                        category: 'partner',
                      });
                    }}
                  />
                )}
                {account?.partnerHubAccess?.['stakekings_admin_access'] && (
                  <PortalCard
                    name="StakeKings Admin"
                    slug="stakekings-admin"
                    category="partner"
                    status="active"
                    isStaff={isStaff}
                    onEnter={() => {
                      handleEnter({
                        portal_id: 'stakekings-admin',
                        portal_slug: 'stakekings-admin',
                        portal_name: 'StakeKings Admin',
                        base_portal: 'STAKEKINGS_ADMIN',
                        config: {},
                        status: 'active',
                        access_expires_at: '',
                        membership_tier: 'full',
                        entitlement_package: {},
                        category: 'partner',
                      });
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Compact portal code entry */}
          <div className="flex justify-center pt-1">
            {!codeOpen ? (
              <button
                type="button"
                onClick={() => setCodeOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/[0.07] px-5 py-2 text-[11px] font-bold tracking-[0.2em] text-[#d4a52c] uppercase transition-all hover:border-[#c0911e]/50 hover:bg-[#c0911e]/[0.12] hover:shadow-[0_0_12px_rgba(192,145,30,0.15)]"
              >
                <KeyRound className="h-3.5 w-3.5" strokeWidth={1.5} />
                Have a Portal Code?
              </button>
            ) : (
              <div className="w-full max-w-xs">
                <div className="mb-1.5 text-center text-[9px] font-mono tracking-[0.25em] text-[#5f6e7c] uppercase">
                  Portal Access Code
                </div>
                <div className="flex gap-2">
                  <input
                    value={codeValue}
                    onChange={(e) => setCodeValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem(); }}
                    placeholder="Enter code..."
                    autoFocus
                    className="recessed-field flex-1 rounded-lg px-3.5 py-2.5 text-[13px] font-mono text-white outline-none placeholder:text-[#5f6e7c]"
                  />
                  <button
                    type="button"
                    onClick={handleRedeem}
                    disabled={codeSubmitting || !codeValue.trim()}
                    className="rounded-lg border border-[#c0911e]/40 bg-[#c0911e]/10 px-5 py-2.5 text-[10px] font-bold tracking-widest text-[#d4a52c] uppercase transition hover:bg-[#c0911e]/20 disabled:opacity-50"
                  >
                    {codeSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Unlock'}
                  </button>
                </div>
                {codeError && (
                  <p className="mt-2 text-center text-[10px] font-mono tracking-widest text-red-400 uppercase">{codeError}</p>
                )}
                {codeSuccess && (
                  <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-mono tracking-widest text-emerald-400 uppercase">
                    <Sparkles className="h-3 w-3" strokeWidth={1.5} />
                    {codeSuccess}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { setCodeOpen(false); setCodeError(''); setCodeValue(''); }}
                  className="mt-2 w-full text-center text-[9px] font-mono tracking-widest text-[#364049] uppercase transition-colors hover:text-[#5f6e7c]"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PortalCard({
  name,
  slug,
  category,
  status,
  expiresAt,
  isStaff,
  isEntered,
  onEnter,
}: {
  name: string;
  slug: string;
  category?: string;
  status: 'active' | 'available';
  expiresAt?: string;
  isStaff: boolean;
  isEntered?: boolean;
  onEnter: () => void;
}) {
  const categoryLabel = category ? (CATEGORY_LABELS[category] ?? `${category[0].toUpperCase()}${category.slice(1)} Portal`) : 'Custom Portal';
  const isActive = status === 'active';

  return (
    <div className="group rounded-lg border border-[#1a1f25] bg-[rgba(17,21,26,0.6)] p-3.5 transition-all hover:border-[#c0911e]/30 hover:bg-[rgba(17,21,26,0.8)]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#c0911e]/25 bg-[#c0911e]/10">
            <Crown className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-[13px] font-bold text-white">{name}</div>
            <div className="text-[9px] font-mono tracking-widest text-[#5f6e7c] uppercase">{categoryLabel}</div>
          </div>
        </div>
        {isActive && (
          <span className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[7px] font-bold tracking-widest text-emerald-400 uppercase">
            <Check className="h-2.5 w-2.5" />
            Active
          </span>
        )}
      </div>

      {expiresAt && isActive && (
        <div className="mt-2 text-[9px] text-[#5f6e7c]">
          Access until {new Date(expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
        </div>
      )}

      <button
        type="button"
        onClick={onEnter}
        disabled={isEntered}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/30 bg-[#c0911e]/10 py-2 text-[10px] font-bold tracking-[0.2em] text-[#d4a52c] uppercase transition-all hover:bg-[#c0911e]/20 disabled:opacity-50"
      >
        {isEntered ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
          <>
            Enter Portal
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
          </>
        )}
      </button>
    </div>
  );
}
