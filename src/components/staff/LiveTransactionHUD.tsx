import { useEffect, useState, useCallback, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  Search, ChevronLeft, ChevronRight, X, RefreshCw,
  TrendingUp, TrendingDown, ArrowRight, Filter, Download,
  AlertTriangle, Calendar, Info, Eye, Clock,
  Wallet, Coins, CreditCard, RotateCcw, XCircle, CircleDot,
} from 'lucide-react';
import {
  fetchTransactions, fetchTransactionDetail, fetchTransactionSummary,
  TRANSACTION_TYPES, PAYMENT_STATUS,
  LEDGER_VIEWS, classifyTransaction, getCategoryLabel, viewMatchesType,
  type SvTransaction, type SvTransactionSnapshot,
  type TransactionFilter, type TransactionSummary,
  type LedgerView, type TransactionCategory,
} from '@/lib/attributionEngine';

export type FreshnessState = 'live' | 'recent' | 'stale' | 'error';

const FRESHNESS_STYLES: Record<FreshnessState, { color: string; label: string }> = {
  live: { color: '#22c55e', label: 'LIVE' },
  recent: { color: '#d4a52c', label: 'RECENT' },
  stale: { color: '#f59e0b', label: 'STALE' },
  error: { color: '#ef4444', label: 'CONNECTION ISSUE' },
};

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: '7 Days' },
  { id: 'last30', label: '30 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
] as const;

type DatePresetId = typeof DATE_PRESETS[number]['id'];

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const FRAMED_GLASS_STYLE: React.CSSProperties = {
  background: 'rgba(8,9,11,0.6)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  boxShadow: '0 4px 20px -8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)',
};

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

const POLL_INTERVAL = 15_000;

// ── Helpers ─────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + formatTime(iso);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMoney(n: number): string {
  if (n === 0) return '';
  return `$${n.toFixed(2)}`;
}

function formatCredits(n: number): string {
  if (n === 0) return '';
  return `${n.toLocaleString()} cr`;
}

function getStatusColor(status: string): string {
  return PAYMENT_STATUS[status as keyof typeof PAYMENT_STATUS]?.color ?? '#71717a';
}

function getStatusLabel(status: string): string {
  return PAYMENT_STATUS[status as keyof typeof PAYMENT_STATUS]?.label ?? status.toUpperCase();
}

function getTypeLabel(code: string): string {
  return TRANSACTION_TYPES[code as keyof typeof TRANSACTION_TYPES] ?? code;
}

function maskUserId(uid: string | null): string {
  if (!uid) return '—';
  return uid.slice(0, 8).toUpperCase();
}

function getCategoryColor(cat: TransactionCategory): string {
  const colors: Partial<Record<TransactionCategory, string>> = {
    credit_purchase: '#d4a52c',
    credit_redemption: '#f97316',
    credit_award: '#22c55e',
    credit_refund: '#3b82f6',
    credit_adjustment: '#a855f7',
    membership_purchase: '#d4a52c',
    membership_renewal: '#22c55e',
    membership_upgrade: '#06b6d4',
    membership_downgrade: '#f59e0b',
    membership_cancellation: '#ef4444',
    membership_expiration: '#71717a',
    marketplace_purchase: '#f97316',
    creator_earnings: '#22c55e',
    platform_commission: '#d4a52c',
    creator_payout: '#06b6d4',
    payment_refund: '#3b82f6',
    chargeback: '#ef4444',
    failed_payment: '#ef4444',
    partner_revenue_share: '#8b5cf6',
    administrative_adjustment: '#a855f7',
    other: '#71717a',
  };
  return colors[cat] ?? '#71717a';
}

function getDateRange(preset: DatePresetId): { from: string; to: string } | null {
  const now = new Date();
  switch (preset) {
    case 'today': {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    case 'yesterday': {
      const start = new Date(now); start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setHours(23, 59, 59, 999);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    case 'last7': {
      const start = new Date(now); start.setDate(start.getDate() - 7);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    case 'last30': {
      const start = new Date(now); start.setDate(start.getDate() - 30);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start.toISOString(), to: now.toISOString() };
    }
    default: return null;
  }
}

// ── Transaction HUD ─────────────────────────────────────────────

export interface TransactionHUDHandle {
  refresh: () => void;
}

export interface LiveTransactionHUDProps {
  reportDateFrom?: string;
  reportDateTo?: string;
  reportId?: string;
  reportLabel?: string;
  onClearReportFilter?: () => void;
}

export const LiveTransactionHUD = forwardRef<TransactionHUDHandle, LiveTransactionHUDProps>(function LiveTransactionHUD({
  reportDateFrom, reportDateTo, reportId, reportLabel, onClearReportFilter,
}, ref) {
  const [transactions, setTransactions] = useState<SvTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterGroup, setFilterGroup] = useState('all');
  const [showCreditsOnly, setShowCreditsOnly] = useState(false);
  const [showCashOnly, setShowCashOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePresetId>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [reportActive, setReportActive] = useState(false);
  const [ledgerView, setLedgerView] = useState<LedgerView>('all');
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const filterRef = useRef<TransactionFilter>({});
  const offsetRef = useRef(0);
  offsetRef.current = offset;

  // Sync report params to internal state
  useEffect(() => {
    if (reportDateFrom && reportDateTo) {
      setDatePreset('custom');
      setCustomFrom(reportDateFrom);
      setCustomTo(reportDateTo);
      setReportActive(true);
    } else {
      setReportActive(false);
    }
  }, [reportDateFrom, reportDateTo]);

  const { dateFrom, dateTo } = useMemo(() => {
    if (datePreset === 'all') return { dateFrom: undefined as string | undefined, dateTo: undefined as string | undefined };
    if (datePreset === 'custom') return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
    const range = getDateRange(datePreset);
    return { dateFrom: range?.from, dateTo: range?.to };
  }, [datePreset, customFrom, customTo]);

  filterRef.current = {
    search, typeCode: filterType, status: filterStatus, groupCode: filterGroup,
    creditsOnly: showCreditsOnly, cashOnly: showCashOnly, dateFrom, dateTo,
    view: ledgerView, limit: pageSize, offset,
  };

  const fetchData = useCallback(async (resetOffset = false) => {
    if (transactions.length === 0) setLoading(true);
    const o = resetOffset ? 0 : offsetRef.current;
    try {
      const { rows, total: totalCount } = await fetchTransactions({
        ...filterRef.current,
        limit: pageSize,
        offset: o,
      });
      setTransactions(rows);
      setTotal(totalCount);
      setLastUpdate(new Date());
      setError(null);
      if (resetOffset) setOffset(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSummaryData = useCallback(async () => {
    try {
      const s = await fetchTransactionSummary({ ...filterRef.current, limit: undefined, offset: undefined });
      setSummary(s);
    } catch { /* silent */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    refresh: () => { void fetchData(false); void fetchSummaryData(); },
  }), [fetchData, fetchSummaryData]);

  // Initial + filter change
  useEffect(() => {
    fetchData(true);
    void fetchSummaryData();
  }, [search, filterType, filterStatus, filterGroup, showCreditsOnly, showCashOnly, dateFrom, dateTo, ledgerView, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling
  useEffect(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => { void fetchData(false); }, POLL_INTERVAL);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [fetchData]);

  const hasFilters = search || filterType !== 'all' || filterStatus !== 'all' || filterGroup !== 'all' || showCreditsOnly || showCashOnly || datePreset !== 'all';
  const freshness = useFreshness(lastUpdate, !!error, POLL_INTERVAL);
  const freshStyle = FRESHNESS_STYLES[freshness];

  const clearAllFilters = () => {
    setSearch(''); setFilterType('all'); setFilterStatus('all'); setFilterGroup('all');
    setShowCreditsOnly(false); setShowCashOnly(false); setDatePreset('all');
    setCustomFrom(''); setCustomTo('');
    if (reportActive && onClearReportFilter) onClearReportFilter();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-[#d4a52c] uppercase">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: freshStyle.color }} />
            Transaction Ledger
          </span>
          {total > 0 && <span className="text-[9px] text-white/30">{total} total</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold tracking-wider" style={{ color: freshStyle.color }}>{freshStyle.label}</span>
          {lastUpdate && (
            <span className="hidden text-[9px] text-white/25 sm:inline">
              {lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button type="button" onClick={() => { void fetchData(false); void fetchSummaryData(); }}
            className="rounded-md border border-white/10 p-1.5 text-white/40 transition hover:text-white/70">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Report filter banner */}
      {reportActive && reportLabel && (
        <div className="flex shrink-0 items-center justify-between border-b border-[#d4a52c]/15 bg-[#d4a52c]/[0.06] px-4 py-2">
          <div className="flex items-center gap-2 text-[10px] text-[#f5e6b0]">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>Viewing transactions for report: <span className="font-bold">{reportLabel}</span></span>
          </div>
          <button type="button" onClick={clearAllFilters}
            className="flex items-center gap-1 rounded-md border border-[#d4a52c]/20 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/10">
            <X className="h-3 w-3" /> Exit Report View
          </button>
        </div>
      )}

      {/* Ledger view tabs */}
      <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] px-3 py-2 sm:px-4">
        {LEDGER_VIEWS.map(v => (
          <button key={v.id} type="button" onClick={() => setLedgerView(v.id)}
            className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
              ledgerView === v.id
                ? 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]'
                : 'border-white/10 text-white/40 hover:text-white/70'
            }`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="shrink-0 border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
          {ledgerView === 'credits' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryCard icon={<Coins className="h-3.5 w-3.5" />} label="Credits Issued" value={summary.creditsIssued.toLocaleString() + ' cr'} color="#22c55e" />
              <SummaryCard icon={<TrendingDown className="h-3.5 w-3.5" />} label="Credits Redeemed" value={summary.creditsRedeemed.toLocaleString() + ' cr'} color="#f97316" />
              <SummaryCard icon={<CircleDot className="h-3.5 w-3.5" />} label="Net Balance" value={summary.creditsBalance.toLocaleString() + ' cr'} color="#d4a52c" />
              <SummaryCard icon={<Wallet className="h-3.5 w-3.5" />} label="Total Count" value={total.toLocaleString()} />
            </div>
          ) : ledgerView === 'subscriptions' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <SummaryCard icon={<CreditCard className="h-3.5 w-3.5" />} label="New" value={summary.newMemberships.toString()} color="#d4a52c" />
              <SummaryCard icon={<RefreshCw className="h-3.5 w-3.5" />} label="Renewals" value={summary.renewals.toString()} color="#22c55e" />
              <SummaryCard icon={<XCircle className="h-3.5 w-3.5" />} label="Cancellations" value={summary.cancellations.toString()} color="#ef4444" />
              <SummaryCard icon={<Clock className="h-3.5 w-3.5" />} label="Expirations" value={summary.expirations.toString()} color="#71717a" />
              <SummaryCard icon={<Wallet className="h-3.5 w-3.5" />} label="Total" value={total.toLocaleString()} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <SummaryCard icon={<Wallet className="h-3.5 w-3.5" />} label="Total" value={total.toLocaleString()} />
              <SummaryCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Gross" value={formatMoney(summary.gross) || '$0'} color="#22c55e" />
              <SummaryCard icon={<RotateCcw className="h-3.5 w-3.5" />} label="Refunds" value={formatMoney(summary.refunds) || '$0'} color="#3b82f6" />
              <SummaryCard icon={<CircleDot className="h-3.5 w-3.5" />} label="Net" value={formatMoney(summary.net) || '$0'} color="#d4a52c" />
              <SummaryCard icon={<XCircle className="h-3.5 w-3.5" />} label="Failed" value={summary.failed.toString()} color="#ef4444" />
              <SummaryCard icon={<Clock className="h-3.5 w-3.5" />} label="Pending" value={summary.pending.toString()} color="#f59e0b" />
            </div>
          )}
        </div>
      )}

      {/* Search + filters */}
      <div className="shrink-0 space-y-2 border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search TXN ID, User, Attribution, GROUP, P1, P2..."
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-8 pr-3 text-[11px] text-white/70 placeholder-white/25 outline-none transition focus:border-[#d4a52c]/40" />
          </div>
          <button type="button" onClick={() => setShowFilters(!showFilters)}
            className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-2 text-[9px] font-bold uppercase tracking-wider transition ${
              showFilters || hasFilters ? 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'
            }`}>
            <Filter className="h-3.5 w-3.5" /> Filters
          </button>
        </div>

        {/* Date range pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map(preset => (
            <button key={preset.id} type="button" onClick={() => setDatePreset(preset.id)}
              className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition ${
                datePreset === preset.id ? 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'
              }`}>
              {preset.id === 'custom' && <Calendar className="h-3 w-3" />}
              {preset.label}
            </button>
          ))}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input type="datetime-local"
                value={customFrom ? new Date(customFrom).toISOString().slice(0, 16) : ''}
                onChange={(e) => setCustomFrom(e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[10px] text-white/60 outline-none [color-scheme:dark]" />
              <span className="text-[10px] text-white/30">to</span>
              <input type="datetime-local"
                value={customTo ? new Date(customTo).toISOString().slice(0, 16) : ''}
                onChange={(e) => setCustomTo(e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5 text-[10px] text-white/60 outline-none [color-scheme:dark]" />
            </div>
          )}
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-2">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-white/60 outline-none">
              <option value="all" className="bg-[#080706]">All Types</option>
              {Object.entries(TRANSACTION_TYPES).map(([code, label]) => (
                <option key={code} value={code} className="bg-[#080706]">{code} — {label}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-white/60 outline-none">
              <option value="all" className="bg-[#080706]">All Status</option>
              {Object.entries(PAYMENT_STATUS).map(([code, info]) => (
                <option key={code} value={code} className="bg-[#080706]">{info.label}</option>
              ))}
            </select>
            <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-white/60 outline-none">
              <option value="all" className="bg-[#080706]">All Groups</option>
              <option value="SK" className="bg-[#080706]">SK — StakeKings</option>
              <option value="MBPN" className="bg-[#080706]">MBPN — Manitoba Poker Network</option>
              <option value="0" className="bg-[#080706]">0 — No Attribution</option>
            </select>
            <button type="button" onClick={() => setShowCreditsOnly(!showCreditsOnly)}
              className={`rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition ${
                showCreditsOnly ? 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40'}`}>
              Credits Only
            </button>
            <button type="button" onClick={() => setShowCashOnly(!showCashOnly)}
              className={`rounded-md border px-2.5 py-1.5 text-[10px] font-semibold transition ${
                showCashOnly ? 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40'}`}>
              Cash Only
            </button>
            {hasFilters && (
              <button type="button" onClick={clearAllFilters}
                className="rounded-md border border-white/10 px-2.5 py-1.5 text-[10px] text-white/40 hover:text-white/70">
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Framed ledger table */}
      <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#c0911e]/15" style={FRAMED_GLASS_STYLE}>
          {/* Table header */}
          <div className="shrink-0 overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="text-[9px] font-bold tracking-wider text-white/30 uppercase" style={{ background: 'rgba(22,17,12,0.45)' }}>
                <tr>
                  <th className="px-3 py-2 whitespace-nowrap">Date / Time</th>
                  <th className="px-3 py-2 whitespace-nowrap">User</th>
                  <th className="hidden px-3 py-2 whitespace-nowrap sm:table-cell">Category</th>
                  <th className="hidden px-3 py-2 whitespace-nowrap md:table-cell">Description</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">Amount</th>
                  <th className="px-3 py-2 whitespace-nowrap">Status</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Table body — scrollable */}
          <div className="min-h-0 flex-1 overflow-y-auto sv-staff-scroll" style={{ overscrollBehavior: 'contain' }}>
            {error ? (
              <div className="p-6 text-[11px] text-red-300">
                <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />Failed to load transactions: {error}
              </div>
            ) : loading && transactions.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-5 w-5 animate-spin text-white/30" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.01]">
                  <Wallet className="h-5 w-5 text-white/20" />
                </div>
                <div className="text-[12px] font-semibold text-white/40">No transactions found for the selected period</div>
                <div className="text-[10px] text-white/25">{hasFilters ? 'Try adjusting your filters or date range.' : 'Transactions will appear here as platform activity occurs.'}</div>
              </div>
            ) : (
              <table className="w-full text-left text-[11px]">
                <tbody>
                  {transactions.map((txn) => {
                    const cat = classifyTransaction(txn);
                    const catColor = getCategoryColor(cat);
                    const statusColor = getStatusColor(txn.payment_status);
                    const hasCash = txn.gross_amount > 0;
                    const hasCredits = txn.credit_amount > 0;
                    return (
                      <tr key={txn.id}
                        onClick={() => setSelectedTxn(txn.transaction_id)}
                        className="cursor-pointer border-b border-white/[0.03] transition-colors hover:bg-[#c0911e]/[0.04]">
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] text-white/50 tabular-nums">
                          {formatDateTime(txn.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span className="text-[10px] font-semibold text-white/70">{maskUserId(txn.user_id)}</span>
                        </td>
                        <td className="hidden px-3 py-2.5 sm:table-cell">
                          <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase whitespace-nowrap"
                            style={{ borderColor: `${catColor}30`, background: `${catColor}08`, color: catColor }}>
                            {getCategoryLabel(cat)}
                          </span>
                        </td>
                        <td className="hidden px-3 py-2.5 md:table-cell">
                          <span className="truncate text-[10px] text-white/50">{txn.product_name ?? getTypeLabel(txn.type_code)}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          {hasCash && <span className="text-[10px] font-bold text-white/80">{formatMoney(txn.gross_amount)}</span>}
                          {hasCredits && <span className="ml-1 text-[10px] font-bold text-[#d4a52c]">{formatCredits(txn.credit_amount)}</span>}
                          {!hasCash && !hasCredits && <span className="text-[10px] text-white/20">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <span className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-wider"
                            style={{ background: `${statusColor}15`, color: statusColor }}>
                            {getStatusLabel(txn.payment_status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          <button type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedTxn(txn.transaction_id); }}
                            className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/50 transition hover:border-[#d4a52c]/30 hover:text-[#f5e6b0]">
                            <Eye className="h-3 w-3" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination footer */}
          <div className="flex shrink-0 items-center justify-between border-t border-white/[0.06] px-3 py-2 sm:px-4">
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-white/30">
                {total > 0 ? `Showing ${offset + 1}–${Math.min(offset + pageSize, total)} of ${total}` : 'No records'}
              </span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setOffset(0); }}
                className="rounded border border-white/10 bg-white/[0.02] px-1.5 py-1 text-[9px] text-white/50 outline-none">
                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n} className="bg-[#080706]">{n} / page</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - pageSize))}
                className="rounded-md border border-white/10 p-1.5 text-white/40 transition hover:text-white/70 disabled:opacity-30">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button type="button" disabled={offset + pageSize >= total}
                onClick={() => setOffset(offset + pageSize)}
                className="rounded-md border border-white/10 p-1.5 text-white/40 transition hover:text-white/70 disabled:opacity-30">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail panel — side drawer matching Users panel style */}
      {selectedTxn && (
        <TransactionDetailPanel transactionId={selectedTxn} onClose={() => setSelectedTxn(null)} />
      )}
    </div>
  );
});

// ── Summary Card ────────────────────────────────────────────────

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
      <span className="shrink-0" style={{ color: color ?? 'rgba(255,255,255,0.3)' }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-[8px] font-bold tracking-wider text-white/30 uppercase">{label}</div>
        <div className="text-[12px] font-bold tabular-nums" style={{ color: color ?? '#fff' }}>{value}</div>
      </div>
    </div>
  );
}

// ── Transaction Detail Side Panel ───────────────────────────────

function TransactionDetailPanel({ transactionId, onClose }: { transactionId: string; onClose: () => void }) {
  const [txn, setTxn] = useState<SvTransaction | null>(null);
  const [snapshot, setSnapshot] = useState<SvTransactionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { transaction, snapshot: snap } = await fetchTransactionDetail(transactionId);
        setTxn(transaction);
        setSnapshot(snap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load detail');
      } finally {
        setLoading(false);
      }
    })();
  }, [transactionId]);

  const statusColor = txn ? getStatusColor(txn.payment_status) : '#71717a';
  const category = txn ? classifyTransaction(txn) : 'other';
  const catColor = getCategoryColor(category);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Side panel — right drawer, framed glass */}
      <div className="fixed bottom-0 right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col overflow-hidden border-l border-[#c0911e]/20 bg-[#0b0d0f] shadow-2xl"
        style={{ boxShadow: '0 0 40px rgba(0,0,0,0.5), inset 1px 0 0 rgba(255,255,255,0.03)' }}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0a0c0e]/60 px-5 py-4 backdrop-blur-md">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-widest text-[#d4a52c] uppercase">Transaction Detail</span>
              {txn && (
                <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase"
                  style={{ borderColor: `${catColor}30`, background: `${catColor}08`, color: catColor }}>
                  {getCategoryLabel(category)}
                </span>
              )}
            </div>
            {txn && <div className="mt-1 font-mono text-[10px] text-white/40">{txn.transaction_id}</div>}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-white/40 transition hover:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto sv-staff-scroll" style={{ overscrollBehavior: 'contain' }}>
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <RefreshCw className="h-5 w-5 animate-spin text-white/30" />
            </div>
          ) : error ? (
            <div className="p-6 text-[11px] text-red-300">{error}</div>
          ) : !txn ? (
            <div className="p-6 text-center text-[11px] text-white/40">Transaction not found.</div>
          ) : (
            <div className="space-y-4 p-4 sm:p-5">
              {/* Core info */}
              <DetailSection title="Transaction">
                <DetailRow label="Transaction ID" value={txn.transaction_id} mono />
                <DetailRow label="Category" value={getCategoryLabel(category)} valueColor={catColor} />
                <DetailRow label="Type" value={`${txn.type_code} — ${getTypeLabel(txn.type_code)}`} />
                <DetailRow label="Status" value={getStatusLabel(txn.payment_status)} valueColor={statusColor} />
                <DetailRow label="Date / Time" value={formatDate(txn.created_at) + ' ' + formatTime(txn.created_at)} />
                <DetailRow label="User ID" value={maskUserId(txn.user_id)} mono />
              </DetailSection>

              {/* Amounts */}
              <DetailSection title="Amounts">
                {txn.gross_amount > 0 && <DetailRow label="Gross Amount" value={`${txn.currency} ${formatMoney(txn.gross_amount)}`} />}
                {txn.credit_amount > 0 && <DetailRow label="Credit Amount" value={formatCredits(txn.credit_amount)} />}
                {txn.gross_amount === 0 && txn.credit_amount === 0 && <DetailRow label="Amount" value="Non-financial event" />}
                <DetailRow label="Currency" value={txn.currency} />
                {txn.product_name && <DetailRow label="Product" value={txn.product_name} />}
                {txn.product_id && <DetailRow label="Product ID" value={txn.product_id} mono />}
                {txn.destination && <DetailRow label="Destination" value={txn.destination} />}
                {txn.recipient && <DetailRow label="Recipient" value={txn.recipient} />}
              </DetailSection>

              {/* Payment */}
              <DetailSection title="Payment">
                {txn.payment_provider_ref && <DetailRow label="Provider Ref" value={txn.payment_provider_ref} mono />}
                {txn.original_transaction_id && <DetailRow label="Original TXN" value={txn.original_transaction_id} mono />}
                {txn.refund_for_transaction_id && <DetailRow label="Refund For" value={txn.refund_for_transaction_id} mono />}
                {txn.refund_reason && <DetailRow label="Refund Reason" value={txn.refund_reason} />}
                {txn.refund_stripe_id && <DetailRow label="Stripe Refund ID" value={txn.refund_stripe_id} mono />}
                {!txn.payment_provider_ref && !txn.original_transaction_id && !txn.refund_for_transaction_id && (
                  <DetailRow label="Payment" value="No payment provider reference" />
                )}
              </DetailSection>

              {/* Attribution */}
              {(txn.attribution_id || txn.group_code || txn.p1_code || txn.deal_id) && (
                <DetailSection title="Attribution">
                  {txn.attribution_id && <DetailRow label="Attribution ID" value={txn.attribution_id} mono />}
                  {txn.group_code && <DetailRow label="GROUP" value={txn.group_code} />}
                  {txn.p1_code && <DetailRow label="P1" value={txn.p1_code} />}
                  {txn.p2_code && <DetailRow label="P2" value={txn.p2_code} />}
                  {txn.deal_id && <DetailRow label="Deal ID" value={txn.deal_id} mono />}
                </DetailSection>
              )}

              {/* Economic Snapshot */}
              {snapshot && (
                <DetailSection title="Revenue Allocation (Frozen)">
                  <DetailRow label="Deal Code" value={snapshot.deal_code ?? '—'} />
                  {snapshot.gross_amount > 0 && <DetailRow label="Gross" value={formatMoney(snapshot.gross_amount)} />}
                  {snapshot.partner_amount > 0 && <DetailRow label="Partner Revenue" value={formatMoney(snapshot.partner_amount)} />}
                  {snapshot.p1_amount > 0 && <DetailRow label="P1 Revenue" value={formatMoney(snapshot.p1_amount)} />}
                  {snapshot.p2_amount > 0 && <DetailRow label="P2 Revenue" value={formatMoney(snapshot.p2_amount)} />}
                  {snapshot.creator_amount > 0 && <DetailRow label="Creator Revenue" value={formatMoney(snapshot.creator_amount)} />}
                  {snapshot.spotvault_amount > 0 && <DetailRow label="SpotVault" value={formatMoney(snapshot.spotvault_amount)} />}
                  {snapshot.platform_fee > 0 && <DetailRow label="Platform Fee" value={formatMoney(snapshot.platform_fee)} />}
                  <DetailRow label="Snapshot Time" value={formatDate(snapshot.snapshot_timestamp) + ' ' + formatTime(snapshot.snapshot_timestamp)} />
                </DetailSection>
              )}

              {/* Notes */}
              {txn.notes && (
                <DetailSection title="Notes">
                  <p className="text-[11px] leading-relaxed text-white/50">{txn.notes}</p>
                </DetailSection>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Shared UI helpers ───────────────────────────────────────────

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
      <span className={`text-right text-[10px] font-semibold ${mono ? 'font-mono' : ''}`}
        style={{ color: valueColor ?? 'rgba(255,255,255,0.7)' }}>
        {value}
      </span>
    </div>
  );
}
