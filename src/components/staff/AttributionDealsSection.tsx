import { useEffect, useState, useCallback } from 'react';
import {
  Search, Plus, X, RefreshCw, ChevronDown, ChevronRight,
  Tag, Handshake, Users, TrendingUp, Info, CheckCircle2, AlertCircle,
} from 'lucide-react';
import {
  fetchAcquisitionCodes, fetchDeals, fetchDealSplits, fetchAttributions,
  createAcquisitionCode, createDeal, updateAcquisitionCode, testAcquisitionCode,
  TRANSACTION_TYPES, CODE_STATUS,
  type SvAcquisitionCode, type SvDeal, type SvDealSplit, type SvAttributionRecord,
} from '@/lib/attributionEngine';
import { STAFF_GLASS_PANEL, STAFF_GLASS_CARD } from '@/components/staff/staffGlass';

type SubTab = 'overview' | 'codes' | 'deals' | 'attributions' | 'revenue';

const SUB_TABS: { id: SubTab; label: string; icon: typeof Info }[] = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'codes', label: 'Codes', icon: Tag },
  { id: 'deals', label: 'Deals', icon: Handshake },
  { id: 'attributions', label: 'Attributions', icon: Users },
  { id: 'revenue', label: 'Revenue', icon: TrendingUp },
];

export function AttributionDealsSection() {
  const [activeTab, setActiveTab] = useState<SubTab>('overview');

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 lg:p-6">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={STAFF_GLASS_PANEL}>
        {/* Sub-tab bar */}
        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/[0.06] p-2">
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all ${
                  active
                    ? 'border-[#d4a52c]/40 bg-[#d4a52c]/15 text-[#f5e6b0]'
                    : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/70'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'codes' && <CodesTab />}
          {activeTab === 'deals' && <DealsTab />}
          {activeTab === 'attributions' && <AttributionsTab />}
          {activeTab === 'revenue' && <RevenueTab />}
        </div>
      </div>
    </div>
  );
}

// ── Overview Tab ────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Architecture explanation */}
      <div className="rounded-xl border border-[#c0911e]/15 p-5" style={STAFF_GLASS_CARD}>
        <h2 className="mb-3 flex items-center gap-2 text-[12px] font-bold tracking-widest text-[#d4a52c] uppercase">
          <Info className="h-4 w-4" /> Attribution Architecture
        </h2>
        <p className="mb-4 text-[11px] leading-relaxed text-white/50">
          The attribution system uses a four-level hierarchy. Codes are how users enter the system.
          Attribution records where they came from. Deals determine economics. Transactions record what happened.
        </p>
        <div className="grid gap-3 sm:grid-cols-4">
          <ArchitectureCard
            label="GROUP"
            description="Partner/community attribution. Examples: SK = StakeKings, MBPN = Manitoba Poker Network, 0 = No group."
          />
          <ArchitectureCard
            label="P1"
            description="Direct referrer / acquisition source. The person or channel that brought the user to SpotVault."
          />
          <ArchitectureCard
            label="P2"
            description="Person who introduced/referred P1 to SpotVault. There is NO P3."
          />
          <ArchitectureCard
            label="DEAL"
            description="Economic rule set governing qualifying transactions. Determines who gets what share."
          />
        </div>
      </div>

      {/* Transaction type reference */}
      <div className="rounded-xl border border-white/[0.06] p-5" style={STAFF_GLASS_CARD}>
        <h2 className="mb-3 text-[12px] font-bold tracking-widest text-white/50 uppercase">Transaction Type Codes</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(TRANSACTION_TYPES).map(([code, label]) => (
            <div key={code} className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2">
              <span className="rounded border border-[#d4a52c]/20 bg-[#d4a52c]/[0.05] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#d4a52c]">{code}</span>
              <span className="text-[10px] text-white/50">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Principles */}
      <div className="rounded-xl border border-white/[0.06] p-5" style={STAFF_GLASS_CARD}>
        <h2 className="mb-3 text-[12px] font-bold tracking-widest text-white/50 uppercase">Key Principles</h2>
        <div className="space-y-2.5">
          <PrincipleRow label="CODE" desc="How the user enters the attribution system (e.g., SK-JOE)." />
          <PrincipleRow label="ATTRIBUTION" desc="Where the user came from (GROUP, P1, P2, Deal)." />
          <PrincipleRow label="DEAL" desc="Who is economically entitled to what — configured independently of codes." />
          <PrincipleRow label="TRANSACTION TYPE" desc="What economic event occurred (MEM, SPT, CRD, etc.)." />
          <PrincipleRow label="LEDGER" desc="Permanent record of what actually happened. Immutable once written." />
        </div>
      </div>

      {/* Safety notes */}
      <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.02] p-5">
        <h2 className="mb-3 text-[12px] font-bold tracking-widest text-amber-400/70 uppercase">Ledger Safety</h2>
        <ul className="space-y-1.5 text-[11px] leading-relaxed text-white/40">
          <li>• When a transaction completes, the economics are snapshot and frozen.</li>
          <li>• Changing a Deal does NOT retroactively alter historical completed transactions.</li>
          <li>• Deactivating a code preserves all historical attribution.</li>
          <li>• Refunds/reversals create linked ledger events — originals are never deleted.</li>
          <li>• Attribution IDs are unique and immutable.</li>
        </ul>
      </div>
    </div>
  );
}

function ArchitectureCard({ label, description }: { label: string; description: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] p-3" style={STAFF_GLASS_CARD}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <ChevronRight className="h-3 w-3 text-[#d4a52c]/50" />
        <span className="font-mono text-[10px] font-bold text-[#d4a52c]">{label}</span>
      </div>
      <p className="text-[10px] leading-relaxed text-white/40">{description}</p>
    </div>
  );
}

function PrincipleRow({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="shrink-0 rounded border border-[#d4a52c]/20 bg-[#d4a52c]/[0.05] px-2 py-0.5 font-mono text-[9px] font-bold text-[#d4a52c]">{label}</span>
      <span className="text-[11px] leading-relaxed text-white/50">{desc}</span>
    </div>
  );
}

// ── Codes Tab ───────────────────────────────────────────────────

function CodesTab() {
  const [codes, setCodes] = useState<SvAcquisitionCode[]>([]);
  const [deals, setDeals] = useState<SvDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [testCode, setTestCode] = useState('');
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, d] = await Promise.all([fetchAcquisitionCodes(), fetchDeals()]);
      setCodes(c);
      setDeals(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTest = async () => {
    if (!testCode.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAcquisitionCode(testCode);
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const filtered = codes.filter(c =>
    !search || c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.group_code.toLowerCase().includes(search.toLowerCase()) ||
    c.p1_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 p-4 sm:p-5">
      {/* Test code section */}
      <div className="rounded-xl border border-[#c0911e]/15 p-4" style={STAFF_GLASS_CARD}>
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-[#d4a52c] uppercase">
          <Search className="h-3.5 w-3.5" /> Test Code
        </h3>
        <p className="mb-3 text-[10px] text-white/40">Enter a code to see exactly what will happen before activating it.</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={testCode}
            onChange={(e) => setTestCode(e.target.value)}
            placeholder="e.g., SK-JOE"
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[11px] text-white/70 placeholder-white/25 outline-none focus:border-[#d4a52c]/40"
          />
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !testCode.trim()}
            className="rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/25 disabled:opacity-40"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
        </div>
        {testResult && (
          <div className="mt-3 rounded-lg border border-white/[0.06] p-3" style={STAFF_GLASS_CARD}>
            {testResult.ok ? (
              <div className="space-y-1.5 text-[10px]">
                <div className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Code resolves successfully</div>
                <TestRow label="Partner/Group" value={String(testResult.group ?? '—')} />
                <TestRow label="P1" value={String(testResult.p1 ?? '—')} />
                <TestRow label="P2" value={String(testResult.p2 ?? '—')} />
                <TestRow label="Deal" value={String(testResult.deal_code ?? '—')} />
                <TestRow label="Lounge" value={String(testResult.lounge ?? '—')} />
                <TestRow label="Skin" value={String(testResult.skin ?? '—')} />
                <TestRow label="Content Priority" value={String(testResult.content_priority ?? '—')} />
                <TestRow label="Revenue Attribution" value={testResult.revenue_attribution ? 'Enabled' : 'Disabled'} />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] text-red-400">
                <AlertCircle className="h-3.5 w-3.5" /> {String(testResult.error ?? 'Code not found')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search + create */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search codes..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-8 pr-3 text-[11px] text-white/70 placeholder-white/25 outline-none focus:border-[#d4a52c]/40"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/25"
        >
          <Plus className="h-3.5 w-3.5" /> Create
        </button>
      </div>

      {error && <div className="text-[11px] text-red-300">{error}</div>}

      {/* Code list */}
      {loading ? (
        <div className="flex items-center justify-center p-8"><RefreshCw className="h-5 w-5 animate-spin text-white/30" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-[11px] text-white/40">No codes found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((code) => {
            const deal = deals.find(d => d.id === code.deal_id);
            const statusInfo = CODE_STATUS[code.status as keyof typeof CODE_STATUS] ?? CODE_STATUS.inactive;
            return (
              <div key={code.id} className="rounded-xl border border-white/[0.06] p-3.5" style={STAFF_GLASS_CARD}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[12px] font-bold text-white/80">{code.code}</span>
                      <span className="rounded-full px-2 py-0.5 text-[8px] font-bold tracking-wider" style={{ background: `${statusInfo.color}15`, color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-white/40">
                      <span>GROUP: <span className="font-mono text-white/60">{code.group_code}</span></span>
                      <span>P1: <span className="font-mono text-white/60">{code.p1_code}</span></span>
                      <span>P2: <span className="font-mono text-white/60">{code.p2_code}</span></span>
                      {deal && <span>Deal: <span className="font-mono text-[#d4a52c]">{deal.deal_code}</span></span>}
                    </div>
                    {(code.lounge || code.skin || code.content_priority) && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-white/30">
                        {code.lounge && <span>Lounge: {code.lounge}</span>}
                        {code.skin && <span>Skin: {code.skin}</span>}
                        {code.content_priority && <span>Priority: {code.content_priority}</span>}
                      </div>
                    )}
                    <div className="mt-1.5 text-[9px] text-white/25">
                      {code.use_count} uses{code.max_uses ? ` / ${code.max_uses} max` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {code.status === 'active' ? (
                      <button
                        type="button"
                        onClick={async () => { await updateAcquisitionCode(code.id, { status: 'inactive' }); load(); }}
                        className="rounded-md border border-white/10 px-2 py-1 text-[9px] font-semibold text-white/40 transition hover:text-white/70"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => { await updateAcquisitionCode(code.id, { status: 'active' }); load(); }}
                        className="rounded-md border border-emerald-500/20 px-2 py-1 text-[9px] font-semibold text-emerald-400/70 transition hover:text-emerald-400"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateCodeModal deals={deals} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}

function TestRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/40">{label}</span>
      <span className="font-mono text-white/70">{value}</span>
    </div>
  );
}

function CreateCodeModal({ deals, onClose, onCreated }: { deals: SvDeal[]; onClose: () => void; onCreated: () => void }) {
  const [code, setCode] = useState('');
  const [group, setGroup] = useState('SK');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('0');
  const [dealId, setDealId] = useState('');
  const [lounge, setLounge] = useState('');
  const [skin, setSkin] = useState('');
  const [contentPriority, setContentPriority] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await createAcquisitionCode({
        code, groupCode: group, p1Code: p1 || '0', p2Code: p2 || '0',
        dealId: dealId || undefined, lounge: lounge || undefined, skin: skin || undefined,
        contentPriority: contentPriority || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create code');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#c0911e]/20 p-5 backdrop-blur-md" style={{ background: 'linear-gradient(135deg, rgba(22,17,12,0.94), rgba(10,10,12,0.96))', boxShadow: '0 8px 28px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,224,166,0.06)' }} onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[12px] font-bold tracking-widest text-[#d4a52c] uppercase">Create Acquisition Code</h3>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white/70"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <FormField label="Code" placeholder="e.g., SK-JOE" value={code} onChange={setCode} mono />
          <div className="grid grid-cols-3 gap-2">
            <FormField label="GROUP" value={group} onChange={setGroup} mono />
            <FormField label="P1" value={p1} onChange={setP1} mono />
            <FormField label="P2" value={p2} onChange={setP2} mono />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold tracking-widest text-white/40 uppercase">Deal</label>
            <select value={dealId} onChange={e => setDealId(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/70 outline-none">
              <option value="">None</option>
              {deals.map(d => <option key={d.id} value={d.id} className="bg-[#080706]">{d.deal_code} — {d.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <FormField label="Lounge" value={lounge} onChange={setLounge} />
            <FormField label="Skin" value={skin} onChange={setSkin} />
            <FormField label="Content Priority" value={contentPriority} onChange={setContentPriority} />
          </div>
          {error && <div className="text-[10px] text-red-400">{error}</div>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !code.trim()}
            className="w-full rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/15 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/25 disabled:opacity-40"
          >
            {saving ? 'Creating...' : 'Create Code'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Deals Tab ───────────────────────────────────────────────────

function DealsTab() {
  const [deals, setDeals] = useState<SvDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);
  const [splits, setSplits] = useState<SvDealSplit[]>([]);
  const [loadingSplits, setLoadingSplits] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDeals(await fetchDeals());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleDeal = async (dealId: string) => {
    if (expandedDeal === dealId) {
      setExpandedDeal(null);
      return;
    }
    setExpandedDeal(dealId);
    setLoadingSplits(true);
    try {
      setSplits(await fetchDealSplits(dealId));
    } catch { setSplits([]); }
    finally { setLoadingSplits(false); }
  };

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-bold tracking-widest text-white/50 uppercase">Deal Manager</h3>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1 rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/25"
        >
          <Plus className="h-3.5 w-3.5" /> Create Deal
        </button>
      </div>

      {error && <div className="text-[11px] text-red-300">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center p-8"><RefreshCw className="h-5 w-5 animate-spin text-white/30" /></div>
      ) : deals.length === 0 ? (
        <div className="p-8 text-center text-[11px] text-white/40">No deals found.</div>
      ) : (
        <div className="space-y-2">
          {deals.map((deal) => (
            <div key={deal.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <button
                type="button"
                onClick={() => toggleDeal(deal.id)}
                className="flex w-full items-center gap-3 p-3.5 text-left transition hover:bg-white/[0.01]"
              >
                {expandedDeal === deal.id ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-[#d4a52c]">{deal.deal_code}</span>
                    <span className="text-[11px] font-semibold text-white/70">{deal.label}</span>
                  </div>
                  {deal.description && <p className="mt-0.5 truncate text-[10px] text-white/40">{deal.description}</p>}
                  <div className="mt-1 flex items-center gap-3 text-[9px] text-white/30">
                    <span>GROUP: <span className="font-mono">{deal.group_code}</span></span>
                    <span>Status: <span className="font-semibold">{deal.status}</span></span>
                  </div>
                </div>
              </button>
              {expandedDeal === deal.id && (
                <div className="border-t border-white/[0.04] p-3.5">
                  {loadingSplits ? (
                    <div className="py-4 text-center"><RefreshCw className="mx-auto h-4 w-4 animate-spin text-white/30" /></div>
                  ) : splits.length === 0 ? (
                    <div className="py-3 text-center text-[10px] text-white/40">No splits configured for this deal.</div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-6 gap-2 border-b border-white/[0.04] pb-1.5 text-[8px] font-bold tracking-wider text-white/30 uppercase">
                        <span>Type</span><span>Partner</span><span>P1</span><span>P2</span><span>Creator</span><span>SpotVault</span>
                      </div>
                      {splits.map((split) => (
                        <div key={split.id} className="grid grid-cols-6 gap-2 text-[10px] text-white/50">
                          <span className="font-mono font-bold text-[#d4a52c]">{split.transaction_type}</span>
                          <span>{split.partner_rule?.value ?? 0}%</span>
                          <span>{split.p1_rule?.value ?? 0}%</span>
                          <span>{split.p2_rule?.value ?? 0}%</span>
                          <span>{split.creator_rule?.value ?? 0}%</span>
                          <span>{split.spotvault_rule?.value ?? 0}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateDealModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateDealModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [dealCode, setDealCode] = useState('');
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [groupCode, setGroupCode] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await createDeal({ dealCode, label, description, groupCode });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create deal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#c0911e]/20 p-5 backdrop-blur-md" style={{ background: 'linear-gradient(135deg, rgba(22,17,12,0.94), rgba(10,10,12,0.96))', boxShadow: '0 8px 28px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,224,166,0.06)' }} onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[12px] font-bold tracking-widest text-[#d4a52c] uppercase">Create Deal</h3>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white/70"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <FormField label="Deal Code" placeholder="e.g., SK-002" value={dealCode} onChange={setDealCode} mono />
          <FormField label="Label" placeholder="e.g., StakeKings Premium Deal" value={label} onChange={setLabel} />
          <FormField label="Description" value={description} onChange={setDescription} />
          <FormField label="Group Code" value={groupCode} onChange={setGroupCode} mono />
          {error && <div className="text-[10px] text-red-400">{error}</div>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dealCode.trim() || !label.trim()}
            className="w-full rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/15 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/25 disabled:opacity-40"
          >
            {saving ? 'Creating...' : 'Create Deal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Attributions Tab ────────────────────────────────────────────

function AttributionsTab() {
  const [records, setRecords] = useState<SvAttributionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setRecords(await fetchAttributions(100));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load attributions');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = records.filter(r =>
    !search ||
    r.attribution_id.toLowerCase().includes(search.toLowerCase()) ||
    r.group_code.toLowerCase().includes(search.toLowerCase()) ||
    r.p1_code.toLowerCase().includes(search.toLowerCase()) ||
    r.user_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Attribution ID, User ID, GROUP, P1..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-8 pr-3 text-[11px] text-white/70 placeholder-white/25 outline-none focus:border-[#d4a52c]/40"
          />
        </div>
      </div>

      {error && <div className="text-[11px] text-red-300">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center p-8"><RefreshCw className="h-5 w-5 animate-spin text-white/30" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-[11px] text-white/40">No attribution records found.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((rec) => (
            <div key={rec.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] font-bold text-[#d4a52c]">{rec.attribution_id}</span>
                <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold tracking-wider ${
                  rec.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                  rec.status === 'revoked' ? 'bg-red-500/15 text-red-400' :
                  'bg-white/5 text-white/40'
                }`}>
                  {rec.status.toUpperCase()}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-white/40 sm:grid-cols-4">
                <span>GROUP: <span className="font-mono text-white/60">{rec.group_code}</span></span>
                <span>P1: <span className="font-mono text-white/60">{rec.p1_code}</span></span>
                <span>P2: <span className="font-mono text-white/60">{rec.p2_code}</span></span>
                <span>User: <span className="font-mono text-white/60">{rec.user_id.slice(0, 8).toUpperCase()}</span></span>
              </div>
              {(rec.associated_lounge || rec.associated_skin || rec.preferred_content_partner) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-white/30">
                  {rec.associated_lounge && <span>Lounge: {rec.associated_lounge}</span>}
                  {rec.associated_skin && <span>Skin: {rec.associated_skin}</span>}
                  {rec.preferred_content_partner && <span>Priority: {rec.preferred_content_partner}</span>}
                </div>
              )}
              <div className="mt-1.5 text-[9px] text-white/25">
                Acquired: {new Date(rec.acquisition_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {rec.acquisition_code && ` via ${rec.acquisition_code}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Revenue Tab ─────────────────────────────────────────────────

function RevenueTab() {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
        <TrendingUp className="mx-auto mb-3 h-8 w-8 text-[#d4a52c]/40" />
        <h3 className="text-[12px] font-bold tracking-widest text-white/50 uppercase">Revenue Analytics</h3>
        <p className="mt-2 text-[11px] text-white/40">
          Revenue breakdowns by GROUP, P1, P2, Deal, and transaction type will appear here once
          transaction data is flowing through the unified ledger.
        </p>
      </div>
    </div>
  );
}

// ── Shared Form Field ───────────────────────────────────────────

function FormField({ label, placeholder, value, onChange, mono }: { label: string; placeholder?: string; value: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold tracking-widest text-white/40 uppercase">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white/70 placeholder-white/25 outline-none focus:border-[#d4a52c]/40 ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}
