import { useState, useEffect, useCallback } from 'react';
import {
  Database, FileSpreadsheet, CheckCircle2, AlertCircle,
  Clock, Download, RefreshCw, Archive, ShieldCheck, XCircle,
  Sliders, ChevronDown, ChevronRight, ArrowRight, Scale,
  Wallet, Users, Activity, Ticket, ShieldAlert,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { STAFF_GLASS_PANEL, STAFF_GLASS_CARD, STAFF_GOLD, STAFF_GOLD_SOFT, STAFF_BORDER } from '@/components/staff/staffGlass';

interface ReportPeriod {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  report_filename: string | null;
  report_checksum: string | null;
  report_size_bytes: number | null;
  sealed_at: string | null;
  error_message: string | null;
  registered_users: number | null;
  new_registrations: number | null;
  active_users: number | null;
  verified_revenue: number | null;
  refunds: number | null;
  transaction_count: number | null;
  significant_events: number | null;
  categories_included: string[] | null;
  category_counts: Record<string, number> | null;
  reconciliation_status: string | null;
  reconciliation_data: Record<string, unknown> | null;
  generation_notes: string | null;
}

interface BackupStatus {
  id: string;
  backup_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  size_bytes: number | null;
  checksum: string | null;
  error_message: string | null;
  last_restoration_test: string | null;
  restoration_test_result: string | null;
}

interface ReportConfig {
  id: string;
  frequency_hours: number;
  enabled_categories: string[];
  last_run_at: string | null;
  next_run_at: string | null;
  last_error: string | null;
  updated_by: string | null;
  updated_at: string;
}

const FREQUENCY_OPTIONS = [
  { value: 1, label: 'Every 1 Hour' },
  { value: 2, label: 'Every 2 Hours' },
  { value: 4, label: 'Every 4 Hours' },
  { value: 8, label: 'Every 8 Hours' },
  { value: 12, label: 'Every 12 Hours' },
  { value: 24, label: 'Every 24 Hours' },
];

const REPORT_CATEGORIES: Record<string, { label: string; description: string; icon: typeof Wallet }> = {
  financial: { label: 'Financial Activity', description: 'Revenue, refunds, payouts, transaction totals', icon: Wallet },
  users: { label: 'Users & Accounts', description: 'Registrations, active users, verification status', icon: Users },
  platform: { label: 'Platform Activity', description: 'Content usage, solver runs, booking activity', icon: Activity },
  support: { label: 'Support & Moderation', description: 'Tickets, moderation actions, resolution times', icon: Ticket },
  security: { label: 'System & Security', description: 'Access logs, security events, backup integrity', icon: ShieldAlert },
};

const CATEGORY_ORDER = ['financial', 'users', 'platform', 'support', 'security'];
const WINNIPEG_TZ = 'America/Winnipeg';

function formatWinnipegTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: WINNIPEG_TZ,
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(iso)) + ' CDT';
  } catch {
    return new Date(iso).toLocaleString();
  }
}

function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: WINNIPEG_TZ, month: 'short', day: 'numeric', hour: '2-digit', hour12: false,
  });
  return `${fmt.format(s)}–${fmt.format(e)}`;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RecordsBackupsSection({ onViewTransactions }: {
  onViewTransactions?: (dateFrom: string, dateTo: string, reportId: string) => void;
}) {
  const [reports, setReports] = useState<ReportPeriod[]>([]);
  const [backups, setBackups] = useState<BackupStatus[]>([]);
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [reconciling, setReconciling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [editFreq, setEditFreq] = useState(8);
  const [editCats, setEditCats] = useState<string[]>(CATEGORY_ORDER);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportsRes, backupsRes, configRes] = await Promise.all([
        supabase.from('system_report_periods').select('*').order('period_start', { ascending: false }).limit(20),
        supabase.from('system_backup_status').select('*').order('started_at', { ascending: false }).limit(10),
        supabase.from('system_report_config').select('*').limit(1).maybeSingle(),
      ]);
      if (reportsRes.error) throw reportsRes.error;
      if (backupsRes.error) throw backupsRes.error;
      if (configRes.error) throw configRes.error;
      setReports(reportsRes.data as unknown as ReportPeriod[] ?? []);
      setBackups(backupsRes.data as unknown as BackupStatus[] ?? []);
      const cfg = configRes.data as unknown as ReportConfig | null;
      if (cfg) {
        setConfig(cfg);
        setEditFreq(cfg.frequency_hours);
        const cats = Array.isArray(cfg.enabled_categories) ? cfg.enabled_categories : CATEGORY_ORDER;
        setEditCats(cats);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load records';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleSaveConfig = useCallback(async () => {
    setSavingConfig(true);
    setError(null);
    try {
      if (config) {
        const { error: updErr } = await supabase
          .from('system_report_config')
          .update({ frequency_hours: editFreq, enabled_categories: editCats, updated_at: new Date().toISOString() })
          .eq('id', config.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('system_report_config')
          .insert({ frequency_hours: editFreq, enabled_categories: editCats });
        if (insErr) throw insErr;
      }
      await loadData();
      setShowConfig(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  }, [config, editFreq, editCats, loadData]);

  const handleGenerateNow = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const now = new Date();
      const hours = config?.frequency_hours ?? 8;
      const periodStart = new Date(now);
      periodStart.setHours(Math.floor(now.getHours() / hours) * hours, 0, 0, 0);
      const periodEnd = new Date(periodStart.getTime() + hours * 60 * 60 * 1000);

      const cats = config?.enabled_categories ?? CATEGORY_ORDER;

      const { error: insertError } = await supabase
        .from('system_report_periods')
        .insert({
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          status: 'open',
          categories_included: cats,
        });
      if (insertError) throw insertError;
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }, [config, loadData]);

  const handleReconcile = useCallback(async (report: ReportPeriod) => {
    setReconciling(report.id);
    try {
      const { data, error: qErr } = await supabase
        .from('sv_transactions')
        .select('gross_amount, payment_status')
        .gte('created_at', report.period_start)
        .lte('created_at', report.period_end)
        .limit(50000);
      if (qErr) throw qErr;

      const rows = (data as { gross_amount: number; payment_status: string }[]) ?? [];
      const liveCount = rows.length;
      const liveRevenue = rows.reduce((s, r) => s + (r.gross_amount || 0), 0);
      const reportRevenue = report.verified_revenue ?? 0;
      const reportCount = report.transaction_count ?? 0;

      const matched = liveCount === reportCount && Math.abs(liveRevenue - reportRevenue) < 0.01;

      const reconData = {
        report_revenue: reportRevenue,
        live_revenue: liveRevenue,
        revenue_difference: +(liveRevenue - reportRevenue).toFixed(2),
        report_txn_count: reportCount,
        live_txn_count: liveCount,
        count_difference: liveCount - reportCount,
        reconciled_at: new Date().toISOString(),
      };

      const { error: updErr } = await supabase
        .from('system_report_periods')
        .update({ reconciliation_status: matched ? 'matched' : 'difference', reconciliation_data: reconData })
        .eq('id', report.id);
      if (updErr) throw updErr;
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reconciliation failed');
    } finally {
      setReconciling(null);
    }
  }, [loadData]);

  const handleViewTransactions = useCallback((report: ReportPeriod) => {
    onViewTransactions?.(report.period_start, report.period_end, report.id);
  }, [onViewTransactions]);

  const currentReport = reports.find(r => r.status === 'open' || r.status === 'processing');
  const latestSealed = reports.find(r => r.status === 'sealed');
  const latestBackup = backups[0];
  const freqLabel = FREQUENCY_OPTIONS.find(f => f.value === (config?.frequency_hours ?? 8))?.label ?? 'Every 8 Hours';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4" style={{ overscrollBehavior: 'contain' }}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border" style={{ borderColor: STAFF_BORDER, background: 'rgba(212,165,44,0.08)' }}>
            <Archive className="h-4 w-4" style={{ color: STAFF_GOLD }} />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wider text-white uppercase">System Records & Backups</h2>
            <p className="text-[10px] font-mono tracking-widest text-white/30 uppercase">{freqLabel} Recording Cycle</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowConfig(s => !s)}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[9px] font-bold uppercase tracking-wider transition ${
            showConfig ? 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/50 hover:text-white/80'
          }`}
        >
          <Sliders className="h-3.5 w-3.5" /> Configure
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Configure Report Panel */}
      {showConfig && (
        <div className="mb-4 rounded-xl p-4" style={STAFF_GLASS_PANEL}>
          <div className="mb-3 flex items-center gap-2">
            <Sliders className="h-4 w-4" style={{ color: STAFF_GOLD }} />
            <h3 className="text-[11px] font-bold tracking-wider text-white/70 uppercase">Report Configuration</h3>
          </div>

          {/* Frequency */}
          <div className="mb-4">
            <label className="mb-1.5 block text-[10px] font-bold tracking-wider text-white/40 uppercase">Recording Frequency</label>
            <div className="flex flex-wrap gap-1.5">
              {FREQUENCY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEditFreq(opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                    editFreq === opt.value
                      ? 'border-[#d4a52c]/50 bg-[#d4a52c]/15 text-[#f5e6b0]'
                      : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/70'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="mb-4">
            <label className="mb-1.5 block text-[10px] font-bold tracking-wider text-white/40 uppercase">Report Content Categories</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CATEGORY_ORDER.map(catKey => {
                const cat = REPORT_CATEGORIES[catKey];
                if (!cat) return null;
                const Icon = cat.icon;
                const enabled = editCats.includes(catKey);
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setEditCats(prev => prev.includes(catKey) ? prev.filter(c => c !== catKey) : [...prev, catKey])}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition ${
                      enabled
                        ? 'border-[#d4a52c]/30 bg-[#d4a52c]/[0.06]'
                        : 'border-white/[0.06] bg-white/[0.01] opacity-50'
                    }`}
                  >
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${enabled ? 'text-[#d4a52c]' : 'text-white/30'}`} />
                    <div className="min-w-0 flex-1">
                      <div className={`text-[11px] font-bold ${enabled ? 'text-white/80' : 'text-white/40'}`}>{cat.label}</div>
                      <div className="text-[9px] leading-relaxed text-white/30">{cat.description}</div>
                    </div>
                    <div className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${enabled ? 'border-[#d4a52c]/50 bg-[#d4a52c]/20' : 'border-white/15'}`}>
                      {enabled && <CheckCircle2 className="h-3.5 w-3.5 text-[#d4a52c]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="flex items-center gap-2 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/20 disabled:opacity-50"
            >
              {savingConfig ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save Configuration
            </button>
            <button
              type="button"
              onClick={() => { setShowConfig(false); if (config) { setEditFreq(config.frequency_hours); setEditCats(config.enabled_categories); } }}
              className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status cards */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatusCard
          icon={<Clock className="h-4 w-4" />}
          label="Recording"
          value={currentReport ? 'Active' : 'Idle'}
          subtext={currentReport ? formatPeriod(currentReport.period_start, currentReport.period_end) : 'No active period'}
          positive={!!currentReport}
        />
        <StatusCard
          icon={<RefreshCw className="h-4 w-4" />}
          label="Frequency"
          value={freqLabel.replace('Every ', '').replace(' Hours', 'h')}
          subtext={config ? 'Configured' : 'Default (8h)'}
          positive={!!config}
        />
        <StatusCard
          icon={<FileSpreadsheet className="h-4 w-4" />}
          label="Last Report"
          value={latestSealed ? 'Sealed' : 'None'}
          subtext={latestSealed ? formatWinnipegTime(latestSealed.sealed_at) : '—'}
          positive={!!latestSealed}
        />
        <StatusCard
          icon={<Database className="h-4 w-4" />}
          label="Last Backup"
          value={latestBackup ? (latestBackup.status === 'verified' ? 'Verified' : latestBackup.status === 'failed' ? 'Failed' : 'Pending') : 'None'}
          subtext={latestBackup ? formatWinnipegTime(latestBackup.completed_at ?? latestBackup.started_at) : '—'}
          positive={latestBackup?.status === 'verified'}
          negative={latestBackup?.status === 'failed'}
        />
      </div>

      {/* Actions */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleGenerateNow}
          disabled={generating}
          className="flex items-center gap-2 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/20 disabled:opacity-50"
        >
          {generating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
          Generate Report Now
        </button>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50 transition hover:text-white/80 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary cards for latest sealed report */}
      {latestSealed && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <SummaryStat label="Registered Users" value={latestSealed.registered_users?.toLocaleString() ?? '—'} />
          <SummaryStat label="New Signups" value={latestSealed.new_registrations?.toLocaleString() ?? '—'} />
          <SummaryStat label="Active Users" value={latestSealed.active_users?.toLocaleString() ?? '—'} />
          <SummaryStat label="Revenue" value={latestSealed.verified_revenue != null ? `$${latestSealed.verified_revenue.toFixed(2)}` : '—'} gold />
          <SummaryStat label="Transactions" value={latestSealed.transaction_count?.toLocaleString() ?? '—'} />
          <SummaryStat label="Refunds" value={latestSealed.refunds != null ? `$${latestSealed.refunds.toFixed(2)}` : '—'} />
        </div>
      )}

      {/* Recent reports table with expandable rows */}
      <div className="mb-4" style={STAFF_GLASS_PANEL}>
        <div className="border-b border-white/[0.06] px-3 py-2.5">
          <h3 className="text-[11px] font-bold tracking-wider text-white/70 uppercase">Recent Reports</h3>
        </div>
        {loading && reports.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-white/30">Loading…</div>
        ) : reports.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-white/30">No reports generated yet</div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {reports.map((r) => {
              const expanded = expandedReport === r.id;
              return (
                <div key={r.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedReport(expanded ? null : r.id)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[#c0911e]/[0.04]"
                  >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/40" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/40" />}
                    <span className="shrink-0 font-mono text-[10px] text-white/60">{formatPeriod(r.period_start, r.period_end)}</span>
                    <StatusBadge status={r.status} />
                    {r.reconciliation_status && r.reconciliation_status !== 'pending' && (
                      <ReconBadge status={r.reconciliation_status} />
                    )}
                    <span className="ml-auto flex items-center gap-3">
                      {r.verified_revenue != null && <span className="text-[10px] text-white/40">${r.verified_revenue.toFixed(2)}</span>}
                      {r.transaction_count != null && <span className="text-[10px] text-white/30">{r.transaction_count} txns</span>}
                    </span>
                  </button>

                  {expanded && (
                    <div className="bg-black/20 px-3 py-3 sm:px-5">
                      {/* Category breakdown */}
                      <div className="mb-3">
                        <div className="mb-1.5 text-[9px] font-bold tracking-widest text-white/30 uppercase">Categories Included</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(r.categories_included ?? CATEGORY_ORDER).map(catKey => {
                            const cat = REPORT_CATEGORIES[catKey];
                            if (!cat) return null;
                            const count = r.category_counts?.[catKey];
                            return (
                              <span key={catKey} className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[9px] text-white/50">
                                {cat.label}
                                {count != null && <span className="font-bold text-[#d4a52c]">{count}</span>}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Reconciliation */}
                      <div className="mb-3">
                        <div className="mb-1.5 flex items-center justify-between">
                          <div className="text-[9px] font-bold tracking-widest text-white/30 uppercase">Reconciliation</div>
                          <button
                            type="button"
                            onClick={() => void handleReconcile(r)}
                            disabled={reconciling === r.id}
                            className="flex items-center gap-1 rounded border border-[#d4a52c]/20 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/10 disabled:opacity-50"
                          >
                            {reconciling === r.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Scale className="h-3 w-3" />}
                            Run Reconciliation
                          </button>
                        </div>
                        {r.reconciliation_data ? (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <ReconStat label="Report Revenue" value={`$${(r.reconciliation_data.report_revenue as number ?? 0).toFixed(2)}`} />
                            <ReconStat label="Live Revenue" value={`$${(r.reconciliation_data.live_revenue as number ?? 0).toFixed(2)}`} />
                            <ReconStat label="Difference" value={`$${(r.reconciliation_data.revenue_difference as number ?? 0).toFixed(2)}`} positive={Math.abs(r.reconciliation_data.revenue_difference as number ?? 0) < 0.01} />
                            <ReconStat label="Txn Count Diff" value={`${r.reconciliation_data.count_difference as number ?? 0}`} positive={r.reconciliation_data.count_difference === 0} />
                          </div>
                        ) : (
                          <div className="text-[10px] text-white/25">Not yet reconciled. Click "Run Reconciliation" to compare report totals with live transaction data.</div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {r.status === 'sealed' && r.report_filename && (
                          <button className="flex items-center gap-1 rounded border border-[#d4a52c]/20 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/10">
                            <Download className="h-3 w-3" /> Download Report
                          </button>
                        )}
                        {onViewTransactions && (
                          <button
                            type="button"
                            onClick={() => handleViewTransactions(r)}
                            className="flex items-center gap-1 rounded border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/20"
                          >
                            <ArrowRight className="h-3 w-3" /> View Transactions for This Report
                          </button>
                        )}
                        {r.report_size_bytes && <span className="text-[9px] text-white/20">{formatBytes(r.report_size_bytes)}</span>}
                        {r.report_checksum && <span className="font-mono text-[9px] text-white/15">SHA-256: {r.report_checksum.slice(0, 16)}…</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Backup health */}
      <div className="mb-4" style={STAFF_GLASS_PANEL}>
        <div className="border-b border-white/[0.06] px-3 py-2.5">
          <h3 className="text-[11px] font-bold tracking-wider text-white/70 uppercase">Backup Health</h3>
        </div>
        {backups.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-white/30">No backup records available</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {backups.slice(0, 5).map((b) => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  {b.status === 'verified' ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400/70" />
                  ) : b.status === 'failed' ? (
                    <XCircle className="h-4 w-4 text-red-400/70" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-400/70" />
                  )}
                  <div>
                    <div className="text-[11px] font-medium text-white/70">{b.backup_type.replace(/_/g, ' ')}</div>
                    <div className="text-[9px] text-white/30">{formatWinnipegTime(b.started_at)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {b.size_bytes && <span className="text-[9px] text-white/30">{formatBytes(b.size_bytes)}</span>}
                  {b.last_restoration_test && (
                    <span className="flex items-center gap-1 text-[9px] text-green-400/60">
                      <ShieldCheck className="h-3 w-3" /> Tested {formatWinnipegTime(b.last_restoration_test)}
                    </span>
                  )}
                  {b.error_message && <span className="text-[9px] text-red-400/60">{b.error_message}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2.5 text-[10px] leading-relaxed text-white/30">
        Reports are generated automatically {freqLabel.toLowerCase()} based on your configuration.
        Each report is sealed with a SHA-256 checksum and stored securely. Database backups
        run independently and are verified for integrity. Manual generation does not interrupt
        the scheduled recording cycle.
      </div>
    </div>
  );
}

function StatusCard({
  icon, label, value, subtext, positive, negative,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-lg p-3" style={STAFF_GLASS_CARD}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-white/30" style={{ color: positive ? STAFF_GOLD : negative ? '#f87171' : undefined }}>{icon}</span>
        <span className="text-[9px] font-bold tracking-wider text-white/40 uppercase">{label}</span>
      </div>
      <div className="text-sm font-bold" style={{ color: positive ? STAFF_GOLD_SOFT : negative ? '#f87171' : '#fff' }}>
        {value}
      </div>
      <div className="mt-0.5 text-[9px] font-mono text-white/25">{subtext}</div>
    </div>
  );
}

function SummaryStat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-lg p-2.5" style={STAFF_GLASS_CARD}>
      <div className="text-[9px] font-bold tracking-wider text-white/30 uppercase">{label}</div>
      <div className="mt-1 text-sm font-bold" style={{ color: gold ? STAFF_GOLD_SOFT : '#fff' }}>{value}</div>
    </div>
  );
}

function ReconStat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
      <div className="text-[8px] font-bold tracking-wider text-white/30 uppercase">{label}</div>
      <div className="mt-0.5 text-[11px] font-bold" style={{ color: positive ? '#22c55e' : '#fff' }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    open: { color: 'text-amber-400/70 bg-amber-400/10 border-amber-400/20', label: 'Open' },
    processing: { color: 'text-blue-400/70 bg-blue-400/10 border-blue-400/20', label: 'Processing' },
    sealed: { color: 'text-green-400/70 bg-green-400/10 border-green-400/20', label: 'Sealed' },
    failed: { color: 'text-red-400/70 bg-red-400/10 border-red-400/20', label: 'Failed' },
  };
  const s = map[status] ?? { color: 'text-white/30 bg-white/5 border-white/10', label: status };
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${s.color}`}>
      {s.label}
    </span>
  );
}

function ReconBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    matched: { color: 'text-green-400/70 bg-green-400/10 border-green-400/20', label: 'Reconciled' },
    difference: { color: 'text-red-400/70 bg-red-400/10 border-red-400/20', label: 'Difference' },
    unavailable: { color: 'text-white/30 bg-white/5 border-white/10', label: 'Unavailable' },
  };
  const s = map[status] ?? { color: 'text-amber-400/70 bg-amber-400/10 border-amber-400/20', label: 'Pending' };
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${s.color}`}>
      {s.label}
    </span>
  );
}
