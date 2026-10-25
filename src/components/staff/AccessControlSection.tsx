import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Shield, ShieldCheck, ShieldX, Clock, FileText, Users,
  Check, X, ChevronDown, ChevronRight, Crown, Radio, BadgeCheck,
  Video, Layers, CalendarCheck, Loader2, AlertCircle, UserCircle,
  KeyRound, ScrollText, ArrowLeft, RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  searchUsersForAccessControl, getUserPermissions, getPermissionAuditLog,
  grantNetworkPostingWithAudit, revokeNetworkPostingWithAudit,
  grantStakeKingsManagerWithAudit, revokeStakeKingsManagerWithAudit,
  grantStakeKingsAccessWithAudit, revokeStakeKingsAccessWithAudit,
  type AccessControlUser, type UserPermissionMatrix, type AuditLogEntry,
  type ToolEntry,
} from '@/lib/accessControlStore';
import {
  getPendingRoleRequests, reviewRoleRequest, revokeRoleRequest,
  type RoleRequest,
} from '@/lib/authEngine';
import {
  getPendingFeedPostingRequests, approveFeedPosting, rejectFeedPosting,
  type FeedPostingRequest,
} from '@/lib/authEngine';
import {
  getPendingApplications, reviewApplication,
  type CreatorApplication,
} from '@/lib/creatorStore';
import { ROLE_LABELS } from '@/lib/authConstants';
import type { SpotVaultAccount } from '@/types';

// ── Permission definitions ────────────────────────────────────────

type PermStatus = 'granted' | 'denied' | 'pending' | 'billing' | 'system';

interface PermissionRow {
  key: string;
  label: string;
  category: string;
  status: PermStatus;
  statusLabel: string;
  source: string;
  canToggle: boolean;
}

const GOLD = '#d4a52c';

const TIER_LABELS: Record<string, string> = {
  free: 'FREE (Player)',
  core: 'CORE',
  pro: 'PRO',
  elite: 'ELITE',
};

const TIER_COLORS: Record<string, string> = {
  free: 'border-white/20 bg-white/5 text-white/60',
  core: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
  pro: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  elite: 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]',
};

// ── Main Component ─────────────────────────────────────────────────

export function AccessControlSection({ staffAccount, selectedUserId }: { staffAccount: SpotVaultAccount; selectedUserId: string | null }) {
  const [tab, setTab] = useState<'users' | 'pending' | 'audit'>('users');
  const [searchResults, setSearchResults] = useState<AccessControlUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AccessControlUser | null>(null);
  const [userPerms, setUserPerms] = useState<UserPermissionMatrix | null>(null);
  const [loadingPerms, setLoadingPerms] = useState(false);

  const staffId = staffAccount.id;
  const staffName = staffAccount.name ?? 'Staff';

  // ── Auto-load users on mount (for pending/audit context) ──
  useEffect(() => {
    (async () => {
      try {
        const results = await searchUsersForAccessControl('');
        setSearchResults(results);
      } catch (err) {
        console.error('[AccessControl] Initial load failed:', err);
      }
    })();
  }, []);

  // ── React to external selection ──
  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null);
      setUserPerms(null);
      return;
    }
    (async () => {
      setLoadingPerms(true);
      try {
        // Find user in cached results, or fetch a minimal record
        let user = searchResults.find((r) => r.user_id === selectedUserId) ?? null;
        if (!user) {
          // Fetch by ID via searchUsersForAccessControl with the UUID
          const results = await searchUsersForAccessControl(selectedUserId);
          user = results.find((r) => r.user_id === selectedUserId) ?? null;
          if (user) setSearchResults(results);
        }
        setSelectedUser(user);
        const perms = await getUserPermissions(selectedUserId);
        setUserPerms(perms);
      } catch (err) {
        console.error('[AccessControl] Failed to load permissions for selected user:', err);
        setUserPerms(null);
      } finally {
        setLoadingPerms(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  const handleRefreshUser = useCallback(async () => {
    if (!selectedUser) return;
    setLoadingPerms(true);
    try {
      const perms = await getUserPermissions(selectedUser.user_id);
      setUserPerms(perms);
      const results = await searchUsersForAccessControl(selectedUser.user_id);
      const updated = results.find((r) => r.user_id === selectedUser.user_id);
      if (updated) setSelectedUser(updated);
    } catch (err) {
      console.error('[AccessControl] Refresh failed:', err);
    } finally {
      setLoadingPerms(false);
    }
  }, [selectedUser]);

  // ── Build permission rows from matrix ──
  const permissionRows = useMemo<PermissionRow[]>(() => {
    if (!userPerms) return [];
    const rows: PermissionRow[] = [];

    // Roles
    const roleSet = new Set(userPerms.roles.map((r) => r.role));
    const staffRoles = ['staff', 'superuser', 'admin', 'owner'];
    rows.push({
      key: 'role_staff',
      label: 'Staff / Admin',
      category: 'Roles',
      status: staffRoles.some((r) => roleSet.has(r)) ? 'granted' : 'denied',
      statusLabel: staffRoles.some((r) => roleSet.has(r)) ? 'Staff' : 'Not Staff',
      source: 'sv_roles',
      canToggle: false,
    });
    rows.push({
      key: 'role_coach',
      label: 'Coach',
      category: 'Roles',
      status: roleSet.has('coach') ? 'granted' : 'denied',
      statusLabel: roleSet.has('coach') ? 'Active' : 'Not Assigned',
      source: 'sv_roles',
      canToggle: false,
    });
    rows.push({
      key: 'role_creator',
      label: 'Creator',
      category: 'Roles',
      status: roleSet.has('creator') ? 'granted' : 'denied',
      statusLabel: roleSet.has('creator') ? 'Active' : 'Not Assigned',
      source: 'sv_roles',
      canToggle: false,
    });

    // Publishing
    const hasFeedCap = userPerms.capabilities.some((c) => c.capability === 'general_feed_post' && c.status === 'active');
    rows.push({
      key: 'general_feed_post',
      label: 'General Feed Posting',
      category: 'Publishing',
      status: hasFeedCap ? 'granted' : 'denied',
      statusLabel: hasFeedCap ? 'Granted' : 'Not Granted',
      source: 'sv_user_capabilities',
      canToggle: false,
    });
    rows.push({
      key: 'network_posting',
      label: 'Info Feed Posting',
      category: 'Publishing',
      status: userPerms.network_posting.some((n) => n.status === 'active') ? 'granted' : 'denied',
      statusLabel: userPerms.network_posting.some((n) => n.status === 'active') ? 'Granted' : 'Not Granted',
      source: 'sv_network_posting_approvals',
      canToggle: true,
    });
    rows.push({
      key: 'video_spots',
      label: 'Spot Video Publishing',
      category: 'Publishing',
      status: userPerms.creator_permissions?.can_publish_video_spots ? 'granted' : 'denied',
      statusLabel: userPerms.creator_permissions?.can_publish_video_spots ? 'Granted' : 'Not Granted',
      source: 'sv_creator_permissions',
      canToggle: false,
    });
    rows.push({
      key: 'multispot',
      label: 'Multi-Spot Publishing',
      category: 'Publishing',
      status: userPerms.creator_permissions?.can_create_multispot ? 'granted' : 'denied',
      statusLabel: userPerms.creator_permissions?.can_create_multispot ? 'Granted' : 'Not Granted',
      source: 'sv_creator_permissions',
      canToggle: false,
    });

    // Community
    rows.push({
      key: 'verified',
      label: 'Community Verified',
      category: 'Community',
      status: userPerms.partner.some((p) => p.verified) ? 'granted' : 'denied',
      statusLabel: userPerms.partner.some((p) => p.verified) ? 'Verified' : 'Not Verified',
      source: 'partner_attributions',
      canToggle: false,
    });
    const isMember = userPerms.community?.is_paid_member;
    rows.push({
      key: 'community_member',
      label: 'Community Membership',
      category: 'Community',
      status: isMember ? 'billing' : 'denied',
      statusLabel: isMember ? 'Active Member' : 'Free Tier',
      source: 'community_entitlements (billing)',
      canToggle: false,
    });

    // Partners
    const sk = userPerms.partner.find((p) => p.partner_slug === 'stakekings');
    rows.push({
      key: 'stakekings_access',
      label: 'StakeKings Portal Access',
      category: 'Partners / Portals',
      status: sk?.entitlement_active ? 'granted' : 'denied',
      statusLabel: sk?.entitlement_active ? 'Active' : 'Not Granted',
      source: 'partner_attributions',
      canToggle: true,
    });
    rows.push({
      key: 'stakekings_manager',
      label: 'StakeKings Manager',
      category: 'Partners / Portals',
      status: sk?.stakekings_role === 'manager' ? 'granted' : 'denied',
      statusLabel: sk?.stakekings_role === 'manager' ? 'Manager' : 'Player',
      source: 'partner_attributions',
      canToggle: true,
    });

    // Booking
    rows.push({
      key: 'booking_provider',
      label: 'Booking Provider',
      category: 'Commerce / Services',
      status: userPerms.booking_provider.some((b) => b.status === 'active') ? 'granted' : 'denied',
      statusLabel: userPerms.booking_provider.some((b) => b.status === 'active') ? 'Approved' : 'Not Approved',
      source: 'booking_provider_approvals',
      canToggle: false,
    });

    // Entitlements
    const entitlements = userPerms.entitlements ?? [];
    rows.push({
      key: 'entitlements',
      label: 'Paid Entitlements',
      category: 'Entitlements',
      status: entitlements.length > 0 ? 'billing' : 'denied',
      statusLabel: entitlements.length > 0 ? `${entitlements.length} active` : 'None',
      source: 'sv_entitlements (billing)',
      canToggle: false,
    });

    // Tools & Products
    const tools = userPerms.tools ?? [];
    for (const tool of tools) {
      const isBilling = tool.source.includes('Subscription') || tool.source.includes('Add-on') || tool.source.includes('Billing');
      const isRole = tool.source.includes('Role');
      rows.push({
        key: `tool_${tool.key}`,
        label: tool.label,
        category: 'Tools & Products',
        status: tool.status === 'active' ? (isBilling ? 'billing' : isRole ? 'system' : 'granted') : 'denied',
        statusLabel: tool.status === 'active' ? `Active — ${tool.source}` : 'Not Included',
        source: tool.source,
        canToggle: false,
      });
    }

    // Account status
    const accountStatus = userPerms.profile?.account_status ?? 'active';
    rows.push({
      key: 'account_status',
      label: 'Account Status',
      category: 'Admin',
      status: accountStatus === 'active' ? 'system' : 'denied',
      statusLabel: accountStatus.charAt(0).toUpperCase() + accountStatus.slice(1),
      source: 'auth.users',
      canToggle: false,
    });

    return rows;
  }, [userPerms]);

  // ── Permission toggle handler ──
  const handleTogglePermission = useCallback(async (permKey: string, currentState: PermStatus) => {
    if (!selectedUser || !userPerms) return;
    const userName = userPerms.profile?.display_name ?? selectedUser.display_name;
    const isGranting = currentState === 'denied';

    try {
      switch (permKey) {
        case 'network_posting':
          if (isGranting) {
            await grantNetworkPostingWithAudit(selectedUser.user_id, userName, staffId, staffName);
          } else {
            await revokeNetworkPostingWithAudit(selectedUser.user_id, userName, staffId, staffName);
          }
          break;
        case 'stakekings_access':
          if (isGranting) {
            await grantStakeKingsAccessWithAudit(selectedUser.user_id, userName, staffId, staffName);
          } else {
            await revokeStakeKingsAccessWithAudit(selectedUser.user_id, userName, staffId, staffName);
          }
          break;
        case 'stakekings_manager':
          if (isGranting) {
            await grantStakeKingsManagerWithAudit(selectedUser.user_id, userName, staffId, staffName);
          } else {
            await revokeStakeKingsManagerWithAudit(selectedUser.user_id, userName, staffId, staffName);
          }
          break;
        default:
          return;
      }
      await handleRefreshUser();
    } catch (err) {
      console.error('[AccessControl] Toggle failed:', err);
    }
  }, [selectedUser, userPerms, staffId, staffName, handleRefreshUser]);

  // ── Render ──
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] bg-black/50 px-4 py-3 sm:px-5 sm:py-4 backdrop-blur-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-mono tracking-[0.25em] uppercase" style={{ color: GOLD }}>
              User Access Control
            </div>
            <h1 className="mt-1 text-xl font-semibold text-white">Access Control</h1>
            <p className="mt-0.5 text-[11px] text-white/40">
              Manage user permissions, publishing access, verification and portal roles.
            </p>
          </div>
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            <TabButton active={tab === 'users'} onClick={() => setTab('users')} icon={Users} label="Users" />
            <TabButton active={tab === 'pending'} onClick={() => setTab('pending')} icon={Clock} label="Pending" />
            <TabButton active={tab === 'audit'} onClick={() => setTab('audit')} icon={ScrollText} label="Audit Log" />
          </div>
        </div>
      </div>

      {/* Membership Gates — visible on users tab */}
      {tab === 'users' && selectedUser && (
        <MembershipGates userId={selectedUser.user_id} />
      )}

      {/* Content */}
      <div className="flex-1 p-3 pb-20 sm:p-5 md:overflow-y-auto md:pb-5" style={{ overscrollBehavior: 'contain' }}>
        {tab === 'users' && (
          selectedUser ? (
            <UserDetailDrawer
              user={selectedUser}
              perms={userPerms}
              loading={loadingPerms}
              permissionRows={permissionRows}
              onToggle={handleTogglePermission}
              onBack={() => { setSelectedUser(null); setUserPerms(null); }}
              onRefresh={handleRefreshUser}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <UserCircle className="h-10 w-10 text-white/15" strokeWidth={1.5} />
              <p className="mt-3 text-[12px] text-white/40">Select a user from the list on the left to view their access permissions.</p>
            </div>
          )
        )}
        {tab === 'pending' && <PendingRequestsView staffId={staffId} staffName={staffName} />}
        {tab === 'audit' && <AuditLogView />}
      </div>
    </div>
  );
}

// ── Tab Button ─────────────────────────────────────────────────────

function MembershipGates({ userId }: { userId: string }) {
  const [currentTier, setCurrentTier] = useState<string | null>(null);
  const [overrideTier, setOverrideTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingTier, setPendingTier] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('sv_get_membership_lifecycle', { p_user_id: userId });
        if (error) throw error;
        if (!cancelled) {
          const lifecycle = data as { effective_tier: string; override_tier: string | null };
          setCurrentTier(lifecycle.effective_tier ?? 'free');
          setOverrideTier(lifecycle.override_tier);
        }
      } catch {
        if (!cancelled) setCurrentTier('free');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleApply = async (tier: string) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('sv_admin_override_membership_audited', {
        p_target_user_id: userId,
        p_tier: tier,
        p_set_by: userId,
        p_reason: `Staff Console override to ${tier}`,
      });
      if (error) throw error;
      setMessage({ kind: 'success', text: `Override set to ${TIER_LABELS[tier]}` });
      setPendingTier(null);
      setCurrentTier(tier);
      setOverrideTier(tier);
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to set override' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClear = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('sv_admin_clear_override_audited', {
        p_user_id: userId,
        p_cleared_by: userId,
        p_reason: 'Manual override removal via Staff Console gates',
      });
      if (error) throw error;
      setMessage({ kind: 'success', text: 'Override cleared' });
      setOverrideTier(null);
      setPendingTier(null);
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to clear override' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="shrink-0 border-b border-white/[0.06] bg-black/40 px-4 py-3 sm:px-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[9px] font-mono tracking-[0.25em] uppercase" style={{ color: GOLD }}>
          Membership Gates
        </div>
        {overrideTier && (
          <button
            type="button"
            onClick={handleClear}
            disabled={actionLoading}
            className="flex items-center gap-1 rounded-md border border-red-400/20 bg-red-400/5 px-2 py-1 text-[8px] font-bold tracking-widest text-red-300 uppercase transition hover:bg-red-400/10 disabled:opacity-40"
          >
            <RotateCcw className="h-2.5 w-2.5" /> Clear Override
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {(['free', 'core', 'pro', 'elite'] as const).map((tier) => {
          const isActive = currentTier === tier;
          const isPending = pendingTier === tier;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => setPendingTier(tier)}
              disabled={loading || actionLoading}
              className={`relative rounded-lg border px-2 py-2.5 text-center transition-all ${
                isActive
                  ? `${TIER_COLORS[tier]} ring-1 ring-[#d4a52c]/40`
                  : 'border-white/10 bg-white/[0.02] text-white/40 hover:border-white/25 hover:text-white/70'
              }`}
            >
              <div className="text-[10px] font-bold tracking-widest uppercase">
                {tier === 'free' ? 'PLAYER' : tier.toUpperCase()}
              </div>
              {overrideTier === tier && (
                <div className="mt-0.5 text-[7px] font-bold tracking-widest text-[#d4a52c] uppercase">OVERRIDE</div>
              )}
              {isActive && !overrideTier && (
                <div className="mt-0.5 text-[7px] font-bold tracking-widest opacity-60 uppercase">CURRENT</div>
              )}
            </button>
          );
        })}
      </div>

      {pendingTier && (
        <div className="mt-2 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/5 p-2.5">
          <div className="text-[10px] font-bold text-white/80">
            Set membership to <span style={{ color: GOLD }}>{TIER_LABELS[pendingTier]}</span>?
          </div>
          <div className="mt-0.5 text-[9px] text-white/45">This will override the Stripe subscription. The user gets immediate access to the {pendingTier.toUpperCase()} tier.</div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => void handleApply(pendingTier)}
              className="flex-1 rounded-md border border-[#d4a52c]/50 bg-[#d4a52c]/20 px-3 py-1.5 text-[9px] font-bold tracking-widest text-[#f5e6b0] uppercase hover:bg-[#d4a52c]/30 disabled:opacity-40"
            >
              {actionLoading ? 'Applying...' : 'Confirm Override'}
            </button>
            <button
              type="button"
              onClick={() => setPendingTier(null)}
              className="rounded-md border border-white/15 px-3 py-1.5 text-[9px] font-bold tracking-widest text-white/55 uppercase hover:border-white/30"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className={`mt-2 rounded-lg border px-3 py-2 text-[10px] font-bold tracking-wider ${
          message.kind === 'success'
            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
            : 'border-red-400/30 bg-red-400/10 text-red-300'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all ${
        active ? 'bg-[#d4a52c]/15 text-[#f5e6b0]' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ── Status Dot ─────────────────────────────────────────────────────

function StatusDot({ status, label }: { status: PermStatus; label: string }) {
  const colors: Record<PermStatus, string> = {
    granted: 'bg-emerald-400',
    denied: 'bg-red-400',
    pending: 'bg-amber-400',
    billing: 'bg-blue-400',
    system: 'bg-white/60',
  };
  const ringColors: Record<PermStatus, string> = {
    granted: 'ring-emerald-400/30',
    denied: 'ring-red-400/30',
    pending: 'ring-amber-400/30',
    billing: 'ring-blue-400/30',
    system: 'ring-white/20',
  };
  return (
    <div className="flex items-center gap-2" title={label}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ring-2 ${colors[status]} ${ringColors[status]}`} />
      <span className="text-[10px] font-semibold text-white/60">{label}</span>
    </div>
  );
}

// ── User Detail Drawer ─────────────────────────────────────────────

function UserDetailDrawer({
  user, perms, loading, permissionRows, onToggle, onBack, onRefresh,
}: {
  user: AccessControlUser;
  perms: UserPermissionMatrix | null;
  loading: boolean;
  permissionRows: PermissionRow[];
  onToggle: (key: string, currentState: PermStatus) => void;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const categories = useMemo(() => {
    const cats = new Set(permissionRows.map((r) => r.category));
    return Array.from(cats);
  }, [permissionRows]);

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-white/40 uppercase transition hover:text-white/70">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Search
      </button>

      {/* Identity card */}
      <div className="mb-5 rounded-xl border border-[#c0911e]/20 bg-black/60 p-5 backdrop-blur-md">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#c0911e]/30 bg-[#c0911e]/10 text-lg font-bold text-[#d4a52c]">
            {user.display_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-white">{perms?.profile?.display_name ?? user.display_name}</h2>
            <p className="text-[11px] text-white/40">@{perms?.profile?.username ?? user.username ?? 'user'}</p>
            <p className="text-[10px] text-white/30">{perms?.profile?.email ?? user.email ?? 'no email'}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-bold tracking-widest text-white/50 uppercase">
                {ROLE_LABELS[user.primary_role as keyof typeof ROLE_LABELS] ?? user.primary_role ?? 'Player'}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase ${
                user.account_status === 'active'
                  ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-300'
                  : 'border-red-300/30 bg-red-300/10 text-red-300'
              }`}>
                {user.account_status}
              </span>
            </div>
          </div>
          <button onClick={onRefresh} disabled={loading} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-bold tracking-widest text-white/50 uppercase transition hover:text-white/80 disabled:opacity-40">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
            Refresh
          </button>
        </div>
      </div>

      {/* Permission groups */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tools & Products section — shown first with source labels */}
          {perms?.tools && perms.tools.length > 0 && (
            <div className="rounded-xl border border-[#c0911e]/15 bg-black/40 p-4">
              <h3 className="mb-3 text-[9px] font-mono tracking-[0.2em] uppercase" style={{ color: GOLD }}>Tools & Products</h3>
              <div className="space-y-2">
                {perms.tools.map((tool: ToolEntry) => (
                  <div key={tool.key} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-white/70">{tool.label}</p>
                      <p className="text-[9px] text-white/25">Source: {tool.source}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusDot
                        status={tool.status === 'active' ? (
                          tool.source.includes('Subscription') || tool.source.includes('Add-on') ? 'billing' :
                          tool.source.includes('Role') ? 'system' : 'granted'
                        ) : 'denied'}
                        label={tool.status === 'active' ? `Active — ${tool.source}` : 'Not Included'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Other permission categories */}
          {categories.filter((c) => c !== 'Tools & Products').map((cat) => (
            <div key={cat} className="rounded-xl border border-white/[0.06] bg-black/40 p-4">
              <h3 className="mb-3 text-[9px] font-mono tracking-[0.2em] uppercase" style={{ color: GOLD }}>{cat}</h3>
              <div className="space-y-2">
                {permissionRows.filter((r) => r.category === cat).map((row) => (
                  <div key={row.key} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-white/70">{row.label}</p>
                      <p className="text-[9px] text-white/25">{row.source}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusDot status={row.status} label={row.statusLabel} />
                      {row.canToggle && (
                        <button
                          onClick={() => onToggle(row.key, row.status)}
                          className={`rounded-md border px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase transition-all ${
                            row.status === 'granted'
                              ? 'border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20'
                              : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20'
                          }`}
                        >
                          {row.status === 'granted' ? 'Revoke' : 'Grant'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pending Requests View ──────────────────────────────────────────

function PendingRequestsView({ staffId, staffName }: { staffId: string; staffName: string }) {
  const [roleRequests, setRoleRequests] = useState<RoleRequest[]>([]);
  const [feedRequests, setFeedRequests] = useState<FeedPostingRequest[]>([]);
  const [creatorApps, setCreatorApps] = useState<CreatorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const [roles, feed, apps] = await Promise.all([
        getPendingRoleRequests().catch(() => []),
        getPendingFeedPostingRequests().catch(() => []),
        getPendingApplications().catch(() => []),
      ]);
      setRoleRequests(roles);
      setFeedRequests(feed);
      setCreatorApps(apps);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const handleReviewRole = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(`role-${id}`);
    try {
      await reviewRoleRequest(id, action);
      await loadPending();
    } catch (err) {
      console.error('[AccessControl] Role review failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReviewFeed = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(`feed-${id}`);
    try {
      if (action === 'approve') await approveFeedPosting(id);
      else await rejectFeedPosting(id);
      await loadPending();
    } catch (err) {
      console.error('[AccessControl] Feed review failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReviewApp = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(`app-${id}`);
    try {
      await reviewApplication(id, action, action === 'approve' ? 'Approved via Access Control' : 'Rejected via Access Control');
      await loadPending();
    } catch (err) {
      console.error('[AccessControl] App review failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const totalPending = roleRequests.length + feedRequests.length + creatorApps.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (totalPending === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Check className="h-10 w-10 text-emerald-400/40" strokeWidth={1.5} />
        <p className="mt-3 text-[12px] text-white/40">No pending requests.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Role Requests */}
      {roleRequests.length > 0 && (
        <PendingSection title="Role Requests" icon={KeyRound} count={roleRequests.length}>
          {roleRequests.map((req) => (
            <PendingRow
              key={req.id}
              title={`${req.display_name ?? 'Unknown User'} → ${ROLE_LABELS[req.requested_role as keyof typeof ROLE_LABELS] ?? req.requested_role}`}
              subtitle={req.reason ?? 'No reason provided'}
              date={req.created_at}
              loading={actionLoading === `role-${req.id}`}
              onApprove={() => handleReviewRole(req.id, 'approve')}
              onReject={() => handleReviewRole(req.id, 'reject')}
            />
          ))}
        </PendingSection>
      )}

      {/* Feed Posting Requests */}
      {feedRequests.length > 0 && (
        <PendingSection title="General Feed Posting Requests" icon={Radio} count={feedRequests.length}>
          {feedRequests.map((req) => (
            <PendingRow
              key={req.id}
              title={req.display_name ?? req.user_id}
              subtitle={req.reason ?? req.category ?? 'No reason provided'}
              date={req.created_at}
              loading={actionLoading === `feed-${req.id}`}
              onApprove={() => handleReviewFeed(req.id, 'approve')}
              onReject={() => handleReviewFeed(req.id, 'reject')}
            />
          ))}
        </PendingSection>
      )}

      {/* Creator Applications */}
      {creatorApps.length > 0 && (
        <PendingSection title="Creator Applications" icon={BadgeCheck} count={creatorApps.length}>
          {creatorApps.map((app) => (
            <PendingRow
              key={app.id}
              title={`${app.display_name ?? 'Unknown'} → ${app.application_type}`}
              subtitle={app.portfolio_url ?? app.bio ?? 'No details provided'}
              date={app.created_at}
              loading={actionLoading === `app-${app.id}`}
              onApprove={() => handleReviewApp(app.id, 'approve')}
              onReject={() => handleReviewApp(app.id, 'reject')}
            />
          ))}
        </PendingSection>
      )}
    </div>
  );
}

function PendingSection({ title, icon: Icon, count, children }: { title: string; icon: React.ComponentType<{ className?: string }>; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: GOLD }} />
        <h3 className="text-[11px] font-bold tracking-widest text-white/60 uppercase">{title}</h3>
        <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[9px] font-bold text-amber-300">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function PendingRow({ title, subtitle, date, loading, onApprove, onReject }: {
  title: string;
  subtitle: string;
  date: string;
  loading: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-white/70">{title}</p>
        <p className="truncate text-[9px] text-white/30">{subtitle}</p>
        <p className="text-[8px] text-white/20">{new Date(date).toLocaleDateString()}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} />
        ) : (
          <>
            <button onClick={onApprove} className="flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase text-emerald-300 transition hover:bg-emerald-400/20">
              <Check className="h-3 w-3" /> Approve
            </button>
            <button onClick={onReject} className="flex items-center gap-1 rounded-md border border-red-400/30 bg-red-400/10 px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase text-red-300 transition hover:bg-red-400/20">
              <X className="h-3 w-3" /> Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Audit Log View ─────────────────────────────────────────────────

function AuditLogView() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const log = await getPermissionAuditLog(100, 0);
        setEntries(log);
      } catch (err) {
        console.error('[AccessControl] Audit log failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ScrollText className="h-10 w-10 text-white/15" strokeWidth={1.5} />
        <p className="mt-3 text-[12px] text-white/40">No permission changes recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-lg border border-white/[0.04] bg-black/40 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-white/70">{entry.target_user_name ?? entry.target_user_id}</span>
                <span className="text-[9px] text-white/30">·</span>
                <span className="text-[10px] text-white/50">{entry.permission_label ?? entry.permission_key}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded-md border border-red-400/20 bg-red-400/5 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-red-300/70 uppercase">
                  {entry.previous_state ?? '—'}
                </span>
                <ChevronRight className="h-3 w-3 text-white/20" />
                <span className="rounded-md border border-emerald-400/20 bg-emerald-400/5 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-emerald-300/70 uppercase">
                  {entry.new_state ?? '—'}
                </span>
              </div>
              <p className="mt-1 text-[8px] text-white/20">
                Changed by {entry.actor_name ?? entry.actor_id} · {new Date(entry.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
