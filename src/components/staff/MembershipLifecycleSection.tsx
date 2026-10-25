import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Crown, Shield, ShieldX, Check, X, Clock, FileText,
  RotateCcw, ChevronRight, AlertCircle, RefreshCw, Copy,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { promoteStaff, demoteStaff } from '@/lib/staffMetadataStore';
import { getUserPermissions } from '@/lib/accessControlStore';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';

interface LifecycleData {
  effective_tier: string | null;
  override_tier: string | null;
  purchased_tier: string | null;
  membership_status: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  canceled_at: string | null;
  renewal_count: number | null;
  previous_tier_id: string | null;
  scheduled_change: {
    action: string;
    from_tier: string;
    to_tier: string;
    effective_at: string;
    status: string;
  } | null;
  audit_log: Array<{
    action: string;
    old_tier: string | null;
    new_tier: string | null;
    source: string;
    reason: string | null;
    created_at: string;
  }>;
}

interface AccountInfo {
  user_id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
  sv_user_id: string | null;
  role: string;
  status: string;
  membership_tier: string | null;
  primary_role: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
}

const TIER_LABELS: Record<string, string> = {
  free: 'Free', core: 'Core', pro: 'Pro', elite: 'Elite',
};

const TIER_BADGE: Record<string, string> = {
  free: 'border-white/15 text-white/50',
  core: 'border-blue-400/30 text-blue-300',
  pro: 'border-emerald-400/30 text-emerald-300',
  elite: 'border-[#d4a52c]/40 text-[#f5e6b0]',
};

function fmt(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-1.5">
      <span className="text-[10px] text-white/40">{label}</span>
      <span className={`text-[10px] font-semibold text-white/80 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export function MembershipLifecycleSection({ staffAccountId, selectedUserId }: { staffAccountId: string; selectedUserId: string | null }) {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [lifecycle, setLifecycle] = useState<LifecycleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Membership change
  const [quickTier, setQuickTier] = useState('elite');
  const [quickExpiry, setQuickExpiry] = useState('');
  const [quickReason, setQuickReason] = useState('');

  // Staff actions
  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
  const [showDemoteConfirm, setShowDemoteConfirm] = useState(false);
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permSaved, setPermSaved] = useState(false);
  const [permDraft, setPermDraft] = useState({ solver: false, analytics: false, chat: false, mainBoard: false });

  // Collapsible sections
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPerms, setShowPerms] = useState(false);

  const STAFF_ROLES = new Set(['staff', 'moderator', 'developer_admin']);
  const isStaffUser = account && STAFF_ROLES.has(account.role);
  const isSuperuser = account?.role === 'superuser';

  const loadAccount = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase.rpc('sv_staff_get_accounts', {
        p_search: userId, p_sort: 'newest', p_limit: 1, p_offset: 0,
      });
      const acct = (data as unknown as AccountInfo[])?.find((r) => r.user_id === userId);
      if (acct) setAccount(acct);
      else setAccount({ user_id: userId, display_name: null, username: null, email: null, sv_user_id: null, role: 'user', status: 'active', membership_tier: null, primary_role: null, created_at: null, last_sign_in_at: null });
    } catch {
      setAccount({ user_id: userId, display_name: null, username: null, email: null, sv_user_id: null, role: 'user', status: 'active', membership_tier: null, primary_role: null, created_at: null, last_sign_in_at: null });
    }
  }, []);

  const loadLifecycle = useCallback(async (userId: string) => {
    setLoading(true);
    setActionMsg(null);
    try {
      const { data, error } = await supabase.rpc('sv_get_membership_lifecycle', { p_user_id: userId });
      if (error) throw error;
      setLifecycle(data as unknown as LifecycleData);
      const ld = data as unknown as LifecycleData;
      if (ld?.effective_tier) setQuickTier(ld.effective_tier);
    } catch {
      setLifecycle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStaffPerms = useCallback(async (userId: string) => {
    setPermLoading(true);
    setPermDraft({ solver: false, analytics: false, chat: false, mainBoard: false });
    try {
      const perms = await getUserPermissions(userId);
      if (perms) {
        const tools = perms.tools ?? [];
        setPermDraft({
          solver: tools.some(t => t.key === 'solver' && t.status === 'active'),
          analytics: tools.some(t => t.key === 'analytics' && t.status === 'active'),
          chat: tools.some(t => t.key === 'chat' && t.status === 'active'),
          mainBoard: tools.some(t => t.key === 'main_board' && t.status === 'active'),
        });
      }
    } catch {
      // ignore
    } finally {
      setPermLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setAccount(null); setLifecycle(null); setActionMsg(null);
      return;
    }
    void loadAccount(selectedUserId);
    void loadLifecycle(selectedUserId);
  }, [selectedUserId, loadAccount, loadLifecycle]);

  useEffect(() => {
    if (isStaffUser && selectedUserId) {
      void loadStaffPerms(selectedUserId);
    }
  }, [isStaffUser, selectedUserId, loadStaffPerms]);

  const handleApplyMembership = async () => {
    if (!selectedUserId) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      const { error } = await supabase.rpc('sv_admin_override_membership_audited', {
        p_target_user_id: selectedUserId,
        p_tier: quickTier,
        p_set_by: staffAccountId,
        p_reason: quickReason || `Staff console change to ${quickTier}`,
      });
      if (error) throw error;
      setActionMsg({ kind: 'success', text: `Membership set to ${TIER_LABELS[quickTier] ?? quickTier}` });
      setQuickReason('');
      void loadLifecycle(selectedUserId);
    } catch (err) {
      setActionMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to apply membership change' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearOverride = async () => {
    if (!selectedUserId) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      const { error } = await supabase.rpc('sv_admin_clear_override_audited', {
        p_user_id: selectedUserId, p_cleared_by: staffAccountId, p_reason: 'Manual removal via Staff Console',
      });
      if (error) throw error;
      setActionMsg({ kind: 'success', text: 'Staff grant cleared.' });
      void loadLifecycle(selectedUserId);
    } catch (err) {
      setActionMsg({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to clear override' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromote = async () => {
    if (!selectedUserId) return;
    setActionLoading(true);
    try {
      const { error } = await promoteStaff(selectedUserId, 'Staff');
      if (error) { setActionMsg({ kind: 'error', text: error }); return; }
      setShowPromoteConfirm(false);
      await loadAccount(selectedUserId);
      setActionMsg({ kind: 'success', text: 'User promoted to Staff.' });
    } catch {
      setActionMsg({ kind: 'error', text: 'Failed to promote user.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDemote = async () => {
    if (!selectedUserId) return;
    setActionLoading(true);
    try {
      const { error } = await demoteStaff(selectedUserId);
      if (error) { setActionMsg({ kind: 'error', text: error }); return; }
      setShowDemoteConfirm(false);
      await loadAccount(selectedUserId);
      setActionMsg({ kind: 'success', text: 'Staff access removed.' });
    } catch {
      setActionMsg({ kind: 'error', text: 'Failed to demote staff.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSavePerms = async () => {
    if (!selectedUserId) return;
    setPermSaving(true);
    setPermSaved(false);
    try {
      const entries = [
        { key: 'solver', granted: permDraft.solver },
        { key: 'analytics', granted: permDraft.analytics },
        { key: 'chat', granted: permDraft.chat },
        { key: 'main_board', granted: permDraft.mainBoard },
      ];
      for (const e of entries) {
        await supabase.rpc('sv_set_tool_entitlement', { p_target_id: selectedUserId, p_tool_key: e.key, p_granted: e.granted });
      }
      setPermSaved(true);
      setTimeout(() => setPermSaved(false), 2000);
    } finally {
      setPermSaving(false);
    }
  };

  const copyText = (text: string) => {
    if (navigator.clipboard) navigator.clipboard.writeText(text);
  };

  if (!selectedUserId || !account) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Crown className="h-8 w-8 text-white/15" strokeWidth={1.5} />
        <p className="mt-2 text-[11px] text-white/40">Select a user from the left to view their account and membership.</p>
      </div>
    );
  }

  const eff = lifecycle?.effective_tier ?? 'free';
  const purch = lifecycle?.purchased_tier ?? 'free';
  const subStatus = lifecycle?.subscription_status ?? lifecycle?.membership_status ?? 'none';
  const hasSub = lifecycle?.stripe_subscription_id || lifecycle?.purchased_tier !== 'free';
  const autoRenew = hasSub && !lifecycle?.cancel_at_period_end;
  const hasOverride = !!lifecycle?.override_tier;

  return (
    <div className="p-4 space-y-3">
      {/* A. Identity header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-white">{account.display_name ?? 'Unknown'}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/45">
            {account.username && <span>@{account.username}</span>}
            {account.sv_user_id && <span className="font-mono text-[#d4a52c]/70">{account.sv_user_id}</span>}
          </div>
          {account.email && <div className="mt-0.5 text-[10px] text-white/45">{account.email}</div>}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="rounded border border-[#d4a52c]/25 bg-[#d4a52c]/10 px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase text-[#d4a52c]">{account.role}</span>
            <span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase ${account.status === 'active' ? 'border-emerald-400/25 text-emerald-300' : 'border-amber-400/25 text-amber-300'}`}>{account.status}</span>
            {account.primary_role && <span className="text-[9px] text-white/35">{account.primary_role}</span>}
          </div>
        </div>
        <button onClick={() => void loadLifecycle(selectedUserId)} disabled={loading} className="flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[8px] font-bold tracking-widest uppercase text-white/40 transition hover:text-white/70 disabled:opacity-40">
          {loading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
        </button>
      </div>

      {actionMsg && (
        <div className={`rounded border px-2.5 py-1.5 text-[10px] font-bold tracking-wide ${actionMsg.kind === 'success' ? 'border-emerald-400/25 bg-emerald-400/5 text-emerald-300' : 'border-red-400/25 bg-red-400/5 text-red-300'}`}>
          {actionMsg.text}
        </div>
      )}

      {loading && !lifecycle ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" style={{ color: GOLD }} /></div>
      ) : (
        <>
          {/* B. Membership & billing summary */}
          <div className="rounded border border-white/[0.06] bg-black/30 px-3 py-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
              <span className="text-white/35">Effective: <span className={`font-bold uppercase ${TIER_BADGE[eff] ?? TIER_BADGE.free}`}>{TIER_LABELS[eff] ?? eff}</span></span>
              <span className="text-white/35">Purchased: <span className="font-semibold text-white/70 uppercase">{TIER_LABELS[purch] ?? purch}</span></span>
              <span className="text-white/35">Sub: <span className="font-semibold text-white/70 uppercase">{subStatus}</span></span>
              <span className="text-white/35">Auto-Renew: <span className="font-semibold text-white/70">{autoRenew ? 'Yes' : 'N/A'}</span></span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[9px] text-white/35">
              <span>Period: {fmt(lifecycle?.current_period_start)} → {fmt(lifecycle?.current_period_end)}</span>
              <span>Next Charge: {autoRenew ? fmt(lifecycle?.current_period_end) : '—'}</span>
              <span>Renewals: {lifecycle?.renewal_count ?? 0}</span>
            </div>
            {hasOverride && (
              <div className="mt-1 flex items-center gap-1.5 text-[9px] text-amber-300">
                <Shield className="h-2.5 w-2.5" /> Staff grant active: {TIER_LABELS[lifecycle.override_tier] ?? lifecycle.override_tier}
                <button onClick={handleClearOverride} disabled={actionLoading} className="ml-1 text-red-400/70 underline hover:text-red-400 disabled:opacity-40">Clear</button>
              </div>
            )}
            {lifecycle?.cancel_at_period_end && lifecycle?.canceled_at && (
              <div className="mt-1 text-[9px] text-amber-300/70">Canceled {fmt(lifecycle.canceled_at)} — access until {fmt(lifecycle.current_period_end)}</div>
            )}
          </div>

          {/* C. Membership management */}
          <div className="rounded border border-white/[0.06] bg-black/30 px-3 py-2.5">
            <div className="text-[8px] font-bold tracking-widest text-white/30 uppercase mb-2">Membership Management</div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-[8px] text-white/30 uppercase tracking-wider">Tier</label>
                <select value={quickTier} onChange={(e) => setQuickTier(e.target.value)} className="mt-0.5 rounded border border-white/10 bg-black/50 px-2 py-1 text-[10px] font-semibold text-white focus:border-[#d4a52c]/40 focus:outline-none">
                  <option value="free">Free</option>
                  <option value="core">Core</option>
                  <option value="pro">Pro</option>
                  <option value="elite">Elite</option>
                </select>
              </div>
              <div>
                <label className="text-[8px] text-white/30 uppercase tracking-wider">Valid Until</label>
                <input type="datetime-local" value={quickExpiry} onChange={(e) => setQuickExpiry(e.target.value)} className="mt-0.5 rounded border border-white/10 bg-black/50 px-2 py-1 text-[10px] text-white/70 focus:border-[#d4a52c]/40 focus:outline-none" />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-[8px] text-white/30 uppercase tracking-wider">Reason (optional)</label>
                <input type="text" value={quickReason} onChange={(e) => setQuickReason(e.target.value)} placeholder="Administrative reason…" className="mt-0.5 w-full rounded border border-white/10 bg-black/50 px-2 py-1 text-[10px] text-white placeholder:text-white/20 focus:border-[#d4a52c]/40 focus:outline-none" />
              </div>
              <button onClick={handleApplyMembership} disabled={actionLoading} className="flex items-center gap-1 rounded border px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase transition hover:opacity-90 disabled:opacity-50" style={{ borderColor: 'rgba(212,165,44,0.4)', background: 'rgba(212,165,44,0.15)', color: GOLD_SOFT }}>
                {actionLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />} Apply
              </button>
            </div>
          </div>

          {/* D. Account details */}
          <div className="rounded border border-white/[0.06] bg-black/30 px-3 py-2">
            <Row label="Created" value={fmtTime(account.created_at)} />
            <Row label="Last Login" value={fmtTime(account.last_sign_in_at)} />
            <Row label="Portal" value={account.primary_role ?? '—'} />
            <div className="flex items-center justify-between border-b border-white/[0.04] py-1.5">
              <span className="text-[10px] text-white/40">SV ID</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono font-semibold text-[#d4a52c]/80">{account.sv_user_id ?? '—'}</span>
                {account.sv_user_id && <button onClick={() => copyText(account.sv_user_id)} className="text-white/20 hover:text-white/50"><Copy className="h-2.5 w-2.5" /></button>}
              </div>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[10px] text-white/40">Auth UUID</span>
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono text-white/40 truncate max-w-[180px]">{account.user_id}</span>
                <button onClick={() => copyText(account.user_id)} className="text-white/20 hover:text-white/50"><Copy className="h-2.5 w-2.5" /></button>
              </div>
            </div>
          </div>

          {/* Account Actions: Promote / Demote / Permissions */}
          <div className="rounded border border-white/[0.06] bg-black/30 px-3 py-2">
            <div className="text-[8px] font-bold tracking-widest text-white/30 uppercase mb-2">Account Actions</div>

            {!isStaffUser && !isSuperuser && (
              !showPromoteConfirm ? (
                <button onClick={() => setShowPromoteConfirm(true)} disabled={actionLoading} className="flex w-full items-center justify-center gap-1.5 rounded border border-[#d4a52c]/30 bg-[#d4a52c]/8 px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase text-[#f5e6b0] transition hover:bg-[#d4a52c]/15 disabled:opacity-40">
                  <Shield className="h-3 w-3" /> Promote to Staff
                </button>
              ) : (
                <div className="rounded border border-[#d4a52c]/25 bg-[#d4a52c]/5 p-2">
                  <p className="text-[9px] text-white/70">Promote {account.display_name ?? 'this user'} to Staff?</p>
                  <div className="mt-2 flex gap-1.5">
                    <button onClick={handlePromote} disabled={actionLoading} className="flex-1 rounded border border-[#d4a52c]/40 bg-[#d4a52c]/15 px-2 py-1 text-[8px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40">{actionLoading ? '...' : 'Confirm'}</button>
                    <button onClick={() => setShowPromoteConfirm(false)} className="flex-1 rounded border border-white/15 px-2 py-1 text-[8px] font-bold uppercase text-white/50">Cancel</button>
                  </div>
                </div>
              )
            )}

            {isStaffUser && !isSuperuser && (
              <>
                <button onClick={() => setShowPerms(!showPerms)} className="flex w-full items-center justify-between text-[9px] font-bold tracking-widest uppercase text-white/50 transition hover:text-white/80">
                  <span>Staff Permissions</span>
                  <ChevronRight className={`h-3 w-3 transition-transform ${showPerms ? 'rotate-90' : ''}`} />
                </button>
                {showPerms && (
                  <div className="mt-2 space-y-1">
                    {permLoading ? <div className="text-[9px] text-white/30">Loading...</div> : (
                      <>
                        {([['solver', 'Solver'], ['analytics', 'Analytics'], ['chat', 'Chat'], ['mainBoard', 'Main Board']] as const).map(([key, label]) => (
                          <label key={key} className="flex items-center justify-between text-[10px] text-white/70">
                            <span>{label}</span>
                            <input type="checkbox" checked={permDraft[key]} onChange={(e) => setPermDraft(p => ({ ...p, [key]: e.target.checked }))} className="accent-[#d4a52c]" />
                          </label>
                        ))}
                        <button onClick={handleSavePerms} disabled={permSaving} className="mt-1 w-full rounded border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2 py-1 text-[8px] font-bold uppercase text-[#f5e6b0] disabled:opacity-40">
                          {permSaving ? 'Saving...' : permSaved ? 'Saved' : 'Save Permissions'}
                        </button>
                      </>
                    )}
                  </div>
                )}
                <div className="mt-2 border-t border-white/[0.04] pt-2">
                  {!showDemoteConfirm ? (
                    <button onClick={() => setShowDemoteConfirm(true)} disabled={actionLoading} className="flex w-full items-center justify-center gap-1.5 rounded border border-red-400/20 bg-red-400/5 px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase text-red-300 transition hover:bg-red-400/10 disabled:opacity-40">
                      <ShieldX className="h-3 w-3" /> Remove Staff Access
                    </button>
                  ) : (
                    <div className="rounded border border-red-400/25 bg-red-400/5 p-2">
                      <p className="text-[9px] text-white/70">Remove staff access for {account.display_name ?? 'this user'}?</p>
                      <div className="mt-2 flex gap-1.5">
                        <button onClick={handleDemote} disabled={actionLoading} className="flex-1 rounded border border-red-400/40 bg-red-400/15 px-2 py-1 text-[8px] font-bold uppercase text-red-200 disabled:opacity-40">{actionLoading ? '...' : 'Confirm'}</button>
                        <button onClick={() => setShowDemoteConfirm(false)} className="flex-1 rounded border border-white/15 px-2 py-1 text-[8px] font-bold uppercase text-white/50">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {isSuperuser && (
              <p className="text-[9px] text-amber-300/60">Founder/Superuser is protected. Role and permissions cannot be modified.</p>
            )}
          </div>

          {/* E. Advanced: subscription details + audit history */}
          <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex w-full items-center justify-between text-[9px] font-bold tracking-widest uppercase text-white/40 transition hover:text-white/70">
            <span>Subscription Details</span>
            <ChevronRight className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
          </button>
          {showAdvanced && (
            <div className="rounded border border-white/[0.06] bg-black/30 px-3 py-2">
              <Row label="Subscription ID" value={lifecycle?.stripe_subscription_id ?? '—'} mono />
              <Row label="Price ID" value={lifecycle?.stripe_price_id ?? '—'} mono />
              {lifecycle?.scheduled_change && (
                <div className="mt-2 border-t border-white/[0.04] pt-2">
                  <div className="text-[8px] font-bold tracking-widest text-white/30 uppercase mb-1">Scheduled Change</div>
                  <div className="text-[10px] text-white/60">
                    {TIER_LABELS[lifecycle.scheduled_change.from_tier] ?? lifecycle.scheduled_change.from_tier} → {TIER_LABELS[lifecycle.scheduled_change.to_tier] ?? lifecycle.scheduled_change.to_tier}
                  </div>
                  <div className="text-[9px] text-white/35">Effective {fmt(lifecycle.scheduled_change.effective_at)}</div>
                </div>
              )}
              <button onClick={async () => {
                const { data, error } = await supabase.rpc('sv_reconcile_memberships');
                if (!error && data) setActionMsg({ kind: 'success', text: 'Reconciliation completed.' });
              }} className="mt-2 flex items-center gap-1 text-[8px] font-bold uppercase text-white/30 hover:text-white/60">
                <RotateCcw className="h-2.5 w-2.5" /> Run Reconciliation
              </button>
            </div>
          )}

          <button onClick={() => setShowHistory(!showHistory)} className="flex w-full items-center justify-between text-[9px] font-bold tracking-widest uppercase text-white/40 transition hover:text-white/70">
            <span>Membership History</span>
            <ChevronRight className={`h-3 w-3 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
          </button>
          {showHistory && (
            <div className="rounded border border-white/[0.06] bg-black/30 px-3 py-2">
              {!lifecycle?.audit_log || lifecycle.audit_log.length === 0 ? (
                <p className="text-[10px] text-white/30">No membership events recorded.</p>
              ) : (
                <div className="space-y-1.5">
                  {lifecycle.audit_log.slice(0, 10).map((entry, i) => (
                    <div key={i} className="flex items-start gap-2 text-[9px]">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-white/60">{entry.action.replace(/_/g, ' ')}</span>
                        <span className="ml-1.5 text-white/25">{new Date(entry.created_at).toLocaleDateString()}</span>
                        {entry.old_tier && entry.new_tier && entry.new_tier !== entry.old_tier && (
                          <span className="ml-1.5 text-white/35">{entry.old_tier} → {entry.new_tier}</span>
                        )}
                        <span className="ml-1.5 rounded border border-white/10 px-1 text-[7px] font-bold uppercase text-white/30">{entry.source}</span>
                        {entry.reason && <div className="text-white/30 text-[8px] mt-0.5">{entry.reason}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
