import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search, X, RefreshCw, ChevronDown, ChevronRight, Filter,
  CheckCircle2, XCircle, AlertTriangle, Zap, Activity,
  TrendingUp, TrendingDown, Shield, Lock, Unlock, Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ── Types ───────────────────────────────────────────────────────

interface StaffAccount {
  user_id: string;
  email: string;
  display_name: string;
  username: string;
  role: string;
  status: string;
  primary_role: string;
  poker_role: string;
  membership_tier: string;
  created_at: string;
  last_sign_in_at: string | null;
  sv_user_id?: string | null;
}

interface PlanEntitlement {
  plan_code: string;
  label: string;
  allowances: Record<string, number | boolean>;
  features: string[];
}

interface ResourceEvent {
  id: string;
  event_id: string;
  user_id: string;
  feature: string;
  event_type: string;
  plan: string | null;
  usage_before: number | null;
  usage_after: number | null;
  usage_limit: number | null;
  result: string;
  failure_reason: string | null;
  estimated_cost: number | null;
  created_at: string;
}

interface UsageTotal {
  user_id: string;
  feature: string;
  period: string;
  count: number;
  failed_count: number;
  rate_limited_count: number;
  current_limit: number | null;
}

const POLL_INTERVAL = 20_000;
const PAGE_SIZE = 40;

const USAGE_FILTERS = ['ALL', 'AI', 'SOLVER', 'STORAGE', 'UPLOADS', 'GATING', 'RATE_LIMITS', 'ERRORS'] as const;
type UsageFilter = typeof USAGE_FILTERS[number];

const RESULT_STYLES: Record<string, { color: string; label: string }> = {
  success: { color: '#22c55e', label: 'SUCCESS' },
  failed: { color: '#ef4444', label: 'FAILED' },
  blocked: { color: '#f59e0b', label: 'BLOCKED' },
  rate_limited: { color: '#a855f7', label: 'RATE LIMITED' },
  timeout: { color: '#ef4444', label: 'TIMEOUT' },
};

const HEALTH_STYLES: Record<string, { color: string; label: string }> = {
  normal: { color: '#22c55e', label: 'NORMAL' },
  elevated: { color: '#f59e0b', label: 'ELEVATED' },
  high: { color: '#f97316', label: 'HIGH' },
  rate_limited: { color: '#a855f7', label: 'RATE LIMITED' },
  error_loop: { color: '#ef4444', label: 'ERROR LOOP' },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function maskUserId(uid: string): string {
  return uid.slice(0, 8).toUpperCase();
}

function getPlanLabel(tier: string): string {
  const t = (tier || 'FREE').toUpperCase();
  if (t.includes('PRO')) return 'PRO';
  if (t.includes('ELITE')) return 'ELITE';
  if (t.includes('CORE')) return 'CORE';
  return 'FREE';
}

function computeHealth(events: ResourceEvent[]): string {
  const recent = events.slice(0, 10);
  const rateLimited = recent.filter(e => e.result === 'rate_limited').length;
  const failed = recent.filter(e => e.result === 'failed' || e.result === 'timeout').length;
  if (rateLimited > 0) return 'rate_limited';
  if (failed >= 3) return 'error_loop';
  if (recent.length >= 5) return 'high';
  if (recent.length >= 2) return 'elevated';
  return 'normal';
}

// ── Freshness hook ──────────────────────────────────────────────

type FreshnessState = 'live' | 'recent' | 'stale' | 'error';

function useFreshness(lastUpdate: Date | null, hasError: boolean, intervalMs: number): FreshnessState {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  if (hasError) return 'error';
  if (!lastUpdate) return 'stale';
  const elapsed = Date.now() - lastUpdate.getTime();
  if (elapsed < intervalMs * 1.5) return 'live';
  if (elapsed < 60_000) return 'recent';
  return 'stale';
}

const FRESHNESS_STYLES: Record<FreshnessState, { color: string; label: string }> = {
  live: { color: '#22c55e', label: 'LIVE' },
  recent: { color: '#d4a52c', label: 'RECENT' },
  stale: { color: '#f59e0b', label: 'STALE' },
  error: { color: '#ef4444', label: 'CONNECTION ISSUE' },
};

// ── Main Component ──────────────────────────────────────────────

export function AccessUsageHUD() {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [plans, setPlans] = useState<PlanEntitlement[]>([]);
  const [events, setEvents] = useState<ResourceEvent[]>([]);
  const [usageTotals, setUsageTotals] = useState<UsageTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<UsageFilter>('ALL');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showEventFeed, setShowEventFeed] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchRef = useRef('');
  const filterRef = useRef<UsageFilter>('ALL');
  searchRef.current = search;
  filterRef.current = eventFilter;

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [acctRes, planRes, evtRes, usageRes] = await Promise.all([
        supabase.rpc('sv_staff_get_accounts', { p_search: searchRef.current || null, p_sort: 'newest', p_limit: PAGE_SIZE, p_offset: 0 }),
        supabase.from('sv_plan_entitlements').select('*').order('display_order'),
        supabase.from('sv_resource_events').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('sv_usage_totals').select('*').order('updated_at', { ascending: false }).limit(100),
      ]);

      if (acctRes.error) throw acctRes.error;
      setAccounts((acctRes.data as unknown as StaffAccount[]) ?? []);
      setPlans((planRes.data as unknown as PlanEntitlement[]) ?? []);
      setEvents((evtRes.data as unknown as ResourceEvent[]) ?? []);
      setUsageTotals((usageRes.data as unknown as UsageTotal[]) ?? []);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load access data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => fetchData(), POLL_INTERVAL);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [fetchData]);

  const freshness = useFreshness(lastUpdate, !!error, POLL_INTERVAL);
  const freshStyle = FRESHNESS_STYLES[freshness];

  const filteredAccounts = accounts.filter(a =>
    !search ||
    (a.username?.toLowerCase().includes(search.toLowerCase())) ||
    (a.display_name?.toLowerCase().includes(search.toLowerCase())) ||
    (a.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredEvents = events.filter(e => {
    if (eventFilter === 'ALL') return true;
    if (eventFilter === 'AI') return e.feature === 'ai_assist';
    if (eventFilter === 'SOLVER') return e.feature === 'solver';
    if (eventFilter === 'STORAGE') return e.feature === 'storage';
    if (eventFilter === 'UPLOADS') return e.feature === 'media_upload';
    if (eventFilter === 'GATING') return e.event_type.includes('GATE') || e.result === 'blocked';
    if (eventFilter === 'RATE_LIMITS') return e.result === 'rate_limited';
    if (eventFilter === 'ERRORS') return e.result === 'failed' || e.result === 'timeout';
    return true;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-[#d4a52c] uppercase">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: freshStyle.color }} />
            Access & Usage
          </span>
          {accounts.length > 0 && (
            <span className="text-[9px] text-white/30">{accounts.length} users</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold tracking-wider" style={{ color: freshStyle.color }}>
            {freshStyle.label}
          </span>
          {lastUpdate && (
            <span className="hidden text-[9px] text-white/25 sm:inline">
              {lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchData()}
            className="rounded-md border border-white/10 p-1.5 text-white/40 transition hover:text-white/70"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="shrink-0 space-y-2 border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username, name, email..."
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-8 pr-3 text-[11px] text-white/70 placeholder-white/25 outline-none focus:border-[#d4a52c]/40"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowEventFeed(!showEventFeed)}
            className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-2 text-[9px] font-bold uppercase tracking-wider transition ${
              showEventFeed
                ? 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]'
                : 'border-white/10 text-white/40 hover:text-white/70'
            }`}
          >
            <Activity className="h-3.5 w-3.5" /> Events
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 border-b border-red-500/10 bg-red-500/5 px-4 py-2 text-[10px] text-red-300">
          <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
          REFRESH FAILED — Showing data from {lastUpdate ? lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'previous load'}
        </div>
      )}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
        {showEventFeed ? (
          <EventFeedView events={filteredEvents} filter={eventFilter} onFilterChange={setEventFilter} />
        ) : loading && accounts.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="p-8 text-center text-[11px] text-white/40">No users found.</div>
        ) : (
          <div className="divide-y divide-white/[0.02]">
            {filteredAccounts.map((acct) => {
              const userEvents = events.filter(e => e.user_id === acct.user_id);
              const userUsage = usageTotals.filter(u => u.user_id === acct.user_id);
              const planCode = getPlanLabel(acct.membership_tier);
              const plan = plans.find(p => p.plan_code === planCode);
              const health = computeHealth(userEvents);
              return (
                <AccessRow
                  key={acct.user_id}
                  account={acct}
                  plan={plan}
                  planCode={planCode}
                  health={health}
                  onClick={() => setSelectedUserId(acct.user_id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedUserId && (
        <UserAccessDetailDrawer
          userId={selectedUserId}
          accounts={accounts}
          events={events}
          usageTotals={usageTotals}
          plans={plans}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}

// ── Access Row ──────────────────────────────────────────────────

function AccessRow({ account, plan, planCode, health, onClick }: {
  account: StaffAccount;
  plan: PlanEntitlement | undefined;
  planCode: string;
  health: string;
  onClick: () => void;
}) {
  const healthStyle = HEALTH_STYLES[health] ?? HEALTH_STYLES.normal;
  const isOnline = account.last_sign_in_at && (Date.now() - new Date(account.last_sign_in_at).getTime()) < 60 * 60 * 1000;
  const hasMembership = planCode !== 'FREE';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.015] sm:px-4"
    >
      {/* User identity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[11px] font-semibold text-white/70">
            {account.username || account.display_name || maskUserId(account.user_id)}
          </span>
          {account.sv_user_id && (
            <span className="shrink-0 rounded border border-[#d4a52c]/20 bg-[#d4a52c]/5 px-1.5 py-0.5 text-[8px] font-mono font-bold tracking-wider text-[#d4a52c]/80">
              {account.sv_user_id}
            </span>
          )}
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-white/20'}`} />
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[9px] text-white/30">
          <span className="font-bold" style={{ color: planCode === 'FREE' ? '#71717a' : '#d4a52c' }}>{planCode}</span>
          <span>{hasMembership ? 'Active' : 'No membership'}</span>
        </div>
      </div>

      {/* Access + usage status */}
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold tracking-wider text-white/30">ACCESS:</span>
          <span className="text-[8px] font-bold tracking-wider" style={{ color: '#22c55e' }}>NORMAL</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] font-bold tracking-wider text-white/30">USAGE:</span>
          <span className="text-[8px] font-bold tracking-wider" style={{ color: healthStyle.color }}>{healthStyle.label}</span>
        </div>
      </div>

      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/20" />
    </button>
  );
}

// ── Event Feed View ─────────────────────────────────────────────

function EventFeedView({ events, filter, onFilterChange }: {
  events: ResourceEvent[];
  filter: UsageFilter;
  onFilterChange: (f: UsageFilter) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Filter chips */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.04] px-3 py-2">
        {USAGE_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFilterChange(f)}
            className={`shrink-0 rounded-md border px-2 py-1 text-[8px] font-bold tracking-wider transition ${
              filter === f
                ? 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]'
                : 'border-white/10 text-white/40 hover:text-white/70'
            }`}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Events */}
      {events.length === 0 ? (
        <div className="p-8 text-center text-[11px] text-white/40">No resource events found.</div>
      ) : (
        <div className="divide-y divide-white/[0.02]">
          {events.map((e) => {
            const rs = RESULT_STYLES[e.result] ?? RESULT_STYLES.success;
            return (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2 sm:px-4">
                <span className="shrink-0 font-mono text-[9px] text-white/30 tabular-nums">
                  {formatTime(e.created_at)}
                </span>
                <span className="shrink-0 truncate text-[10px] font-semibold text-white/60">
                  {maskUserId(e.user_id)}
                </span>
                <span className="hidden truncate text-[9px] text-white/40 sm:inline">
                  {e.event_type.replace(/_/g, ' ')}
                </span>
                <span className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold tracking-wider"
                  style={{ background: `${rs.color}15`, color: rs.color }}>
                  {rs.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── User Access Detail Drawer ───────────────────────────────────

function UserAccessDetailDrawer({ userId, accounts, events, usageTotals, plans, onClose }: {
  userId: string;
  accounts: StaffAccount[];
  events: ResourceEvent[];
  usageTotals: UsageTotal[];
  plans: PlanEntitlement[];
  onClose: () => void;
}) {
  const account = accounts.find(a => a.user_id === userId);
  const userEvents = events.filter(e => e.user_id === userId);
  const userUsage = usageTotals.filter(u => u.user_id === userId);
  const planCode = getPlanLabel(account?.membership_tier ?? 'FREE');
  const plan = plans.find(p => p.plan_code === planCode);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-[#c0911e]/20 bg-[#0d0b09] shadow-2xl sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-[480px] sm:rounded-l-2xl sm:rounded-t-none sm:border-t-0 sm:border-l">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0d0b09]/95 px-4 py-3 backdrop-blur">
          <span className="text-[10px] font-bold tracking-widest text-[#d4a52c] uppercase">Access & Usage Detail</span>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white/70"><X className="h-4 w-4" /></button>
        </div>

        {account ? (
          <div className="space-y-4 p-4">
            {/* User info */}
            <DetailSection title="User Information">
              <DetailRow label="SV User ID" value={account.sv_user_id ?? '—'} mono valueColor="#d4a52c" />
              <DetailRow label="Username" value={account.username || '—'} />
              <DetailRow label="User ID" value={maskUserId(account.user_id)} mono />
              <DetailRow label="Email" value={account.email || '—'} />
              <DetailRow label="Created" value={formatDate(account.created_at)} />
              <DetailRow label="Last Login" value={account.last_sign_in_at ? formatDate(account.last_sign_in_at) : 'Never'} />
            </DetailSection>

            {/* Membership */}
            <DetailSection title="Membership">
              <DetailRow label="Plan" value={planCode} valueColor={planCode === 'FREE' ? '#71717a' : '#d4a52c'} />
              <DetailRow label="Status" value={account.status || 'active'} />
            </DetailSection>

            {/* Permissions / Entitlements */}
            <DetailSection title="Permissions">
              {plan ? (
                <>
                  {plan.features.map((feat) => (
                    <div key={feat} className="flex items-center justify-between text-[10px]">
                      <span className="text-white/40">{feat.replace(/_/g, ' ')}</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Unlock className="h-3 w-3" /> ENABLED
                      </span>
                    </div>
                  ))}
                  <div className="mt-2 border-t border-white/[0.04] pt-2 text-[9px] text-white/30">
                    Allowances: AI {plan.allowances.ai_assist_weekly ?? 0}/wk, Solver {plan.allowances.solver_daily ?? 0}/day, Storage {plan.allowances.storage_mb ?? 0}MB
                  </div>
                </>
              ) : (
                <span className="text-[10px] text-white/40">No plan configured.</span>
              )}
            </DetailSection>

            {/* Usage */}
            {userUsage.length > 0 && (
              <DetailSection title="Usage / Resource Activity">
                {userUsage.map((u, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span className="text-white/40">{u.feature.replace(/_/g, ' ')}</span>
                    <span className="text-white/60">
                      {u.count}{u.current_limit ? ` / ${u.current_limit}` : ''} {u.period}
                      {u.failed_count > 0 && <span className="ml-1 text-red-400">({u.failed_count} failed)</span>}
                    </span>
                  </div>
                ))}
              </DetailSection>
            )}

            {/* Feature gating audit */}
            {plan && (
              <DetailSection title="Feature Gating Audit">
                <GatingAudit plan={plan} usage={userUsage} />
              </DetailSection>
            )}

            {/* Recent resource events */}
            {userEvents.length > 0 && (
              <DetailSection title={`Recent Resource Events (${userEvents.length})`}>
                <div className="space-y-1.5">
                  {userEvents.slice(0, 15).map((e) => {
                    const rs = RESULT_STYLES[e.result] ?? RESULT_STYLES.success;
                    return (
                      <div key={e.id} className="flex items-center gap-2 text-[10px]">
                        <span className="font-mono text-white/30">{formatTime(e.created_at)}</span>
                        <span className="text-white/50">{e.event_type.replace(/_/g, ' ')}</span>
                        <span className="ml-auto rounded-full px-1.5 py-0.5 text-[8px] font-bold"
                          style={{ background: `${rs.color}15`, color: rs.color }}>
                          {rs.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </DetailSection>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-[11px] text-white/40">User not found.</div>
        )}
      </div>
    </>
  );
}

// ── Gating Audit ────────────────────────────────────────────────

function GatingAudit({ plan, usage }: { plan: PlanEntitlement; usage: UsageTotal[] }) {
  const features = [
    { name: 'AI Assist', key: 'ai_assist', allowanceKey: 'ai_assist_weekly', period: 'weekly' },
    { name: 'Solver', key: 'solver', allowanceKey: 'solver_daily', period: 'daily' },
    { name: 'Storage', key: 'storage', allowanceKey: 'storage_mb', period: 'lifetime' },
    { name: 'Lounges', key: 'lounge', allowanceKey: 'lounge_limit', period: 'lifetime' },
    { name: 'Monetization', key: 'monetization', allowanceKey: 'monetization', period: 'lifetime' },
    { name: 'Sync Share', key: 'sync_share', allowanceKey: 'sync_share', period: 'lifetime' },
  ];

  return (
    <div className="space-y-2">
      {features.map((feat) => {
        const required = plan.allowances[feat.allowanceKey];
        const isBool = typeof required === 'boolean';
        const usageRow = usage.find(u => u.feature === feat.key && u.period === feat.period);
        const currentUsage = usageRow?.count ?? 0;
        const limit = isBool ? (required ? 999 : 0) : (required as number) ?? 0;
        const isLocked = isBool ? !required : (limit > 0 && currentUsage >= limit);
        const isLimited = !isLocked && limit > 0 && currentUsage >= limit * 0.8;

        return (
          <div key={feat.key} className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-white/60">{feat.name}</span>
              <span className={`flex items-center gap-1 text-[9px] font-bold ${isLocked ? 'text-red-400' : isLimited ? 'text-amber-400' : 'text-emerald-400'}`}>
                {isLocked ? <><Lock className="h-3 w-3" /> LOCKED</> : <><Unlock className="h-3 w-3" /> ENABLED</>}
              </span>
            </div>
            <div className="mt-1 text-[9px] text-white/30">
              Required: {isBool ? (required ? 'Included' : 'Not included') : `${limit} ${feat.period}`}
              {!isBool && limit > 0 && ` | Current: ${currentUsage}`}
              {!isBool && limit > 0 && isLocked && ` | LOCKED — ${feat.period.toUpperCase()} LIMIT REACHED`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Shared UI ───────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <h3 className="mb-2.5 text-[9px] font-bold tracking-widest text-white/40 uppercase">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({ label, value, mono, valueColor }: { label: string; value: string; mono?: boolean; valueColor?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-[10px] text-white/35">{label}</span>
      <span className={`text-right text-[10px] font-semibold ${mono ? 'font-mono' : ''}`} style={{ color: valueColor ?? 'rgba(255,255,255,0.7)' }}>
        {value}
      </span>
    </div>
  );
}
