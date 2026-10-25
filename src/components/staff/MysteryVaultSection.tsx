import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles, Gift, Plus, Edit2, Archive, ToggleLeft, ToggleRight,
  Save, X, Loader2, AlertCircle, Package, TrendingUp, DollarSign,
  Settings,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  fetchRewards, fetchAllRewards, saveReward, toggleRewardActive,
  archiveReward, fetchConfig, updateDistributionRate, fetchDashboardStats,
  extractSupabaseError,
  REWARD_CATEGORIES, RARITY_LEVELS, RATE_LABELS,
  type MysteryVaultReward, type MysteryVaultConfig, type DashboardStats,
} from '@/lib/mysteryVaultStore';
import { STAFF_GLASS_CARD } from '@/components/staff/staffGlass';

const GOLD = '#d4a52c';
const SOFT_GOLD = '#f5e6b0';
const DARK_BG = 'transparent';
const BORDER = 'rgba(212,165,44,0.12)';

const fmtMoney = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function MysteryVaultSection() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [config, setConfig] = useState<MysteryVaultConfig | null>(null);
  const [rewards, setRewards] = useState<MysteryVaultReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingReward, setEditingReward] = useState<MysteryVaultReward | null>(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingRate, setPendingRate] = useState<number | null>(null);
  const [rateSaving, setRateSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [s, c, r] = await Promise.all([
        fetchDashboardStats(), fetchConfig(), fetchRewards(),
      ]);
      setStats(s);
      setConfig(c);
      setPendingRate(c.distribution_rate);
      setRewards(r);
    } catch (err) {
      setError(extractSupabaseError(err) || 'Failed to load Mystery Vault data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refreshRewards = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([fetchAllRewards(), fetchDashboardStats()]);
      setRewards(r.filter((rw) => !rw.is_archived));
      setStats(s);
    } catch (err) {
      setError(extractSupabaseError(err) || 'Failed to refresh rewards.');
    }
  }, []);

  const handleRateChange = useCallback(async (rate: number) => {
    setPendingRate(rate);
    setRateSaving(true);
    try {
      await updateDistributionRate(rate);
      setConfig(await fetchConfig());
    } catch (err) {
      setError(extractSupabaseError(err) || 'Failed to update release rate.');
    } finally {
      setRateSaving(false);
    }
  }, []);

  const handleToggleActive = useCallback(async (id: string, active: boolean) => {
    setActionLoading(true);
    try { await toggleRewardActive(id, active); await refreshRewards(); }
    catch (err) { setError(extractSupabaseError(err) || 'Failed to toggle reward.'); }
    finally { setActionLoading(false); }
  }, [refreshRewards]);

  const handleArchive = useCallback(async (id: string) => {
    if (!confirm('Archive this reward? It will be hidden from the vault.')) return;
    setActionLoading(true);
    try { await archiveReward(id); await refreshRewards(); }
    catch (err) { setError(extractSupabaseError(err) || 'Failed to archive reward.'); }
    finally { setActionLoading(false); }
  }, [refreshRewards]);

  const handleSaveReward = useCallback(async (reward: Partial<MysteryVaultReward>) => {
    setActionLoading(true);
    setError('');
    setSaveError('');
    try {
      await saveReward(reward);
      setShowRewardModal(false);
      setEditingReward(null);
      await refreshRewards();
    } catch (err) {
      const msg = extractSupabaseError(err) || 'Failed to save reward.';
      setSaveError(msg);
    } finally {
      setActionLoading(false);
    }
  }, [refreshRewards]);

  const currentRate = pendingRate ?? config?.distribution_rate ?? 0;

  // Drop probability total — only active, in-stock, non-archived rewards count
  const { activeProbabilityTotal, probabilityValid } = useMemo(() => {
    const eligible = rewards.filter((r) => r.is_active && !r.is_archived && !(r.quantity_available <= 0 && !r.unlimited_inventory));
    const total = eligible.reduce((sum, r) => sum + Number(r.probability_weight), 0);
    return { activeProbabilityTotal: total, probabilityValid: Math.abs(total - 100) < 0.01 };
  }, [rewards]);

  useEffect(() => { void supabase.auth.getUser(); }, []);

  return (
    <div className="flex h-full flex-col" style={{ background: DARK_BG }}>
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <h2 className="text-sm font-bold tracking-wide text-white uppercase">Mystery Vault</h2>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 md:overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} /></div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-400" /><p className="text-[11px] text-red-300">{error}</p></div>
            <button onClick={() => { setError(''); load(); }} className="mt-2 text-[10px] text-red-400 underline">Try again</button>
          </div>
        ) : stats ? (
          <div className="space-y-4">
            {/* 1. Compact summary — 4 stats */}
            <CompactSummary stats={stats} rewardCount={rewards.length} />

            {/* 2. Release rate slider */}
            <ReleaseRateCard currentRate={currentRate} onRateChange={handleRateChange} saving={rateSaving} />

            {/* 3. Reward inventory */}
            <RewardInventory
              rewards={rewards}
              actionLoading={actionLoading}
              activeProbabilityTotal={activeProbabilityTotal}
              probabilityValid={probabilityValid}
              onToggleActive={handleToggleActive}
              onArchive={handleArchive}
              onEdit={(r) => { setEditingReward(r); setShowRewardModal(true); }}
              onCreate={() => { setEditingReward(null); setShowRewardModal(true); }}
            />
          </div>
        ) : null}
      </div>

      {showRewardModal && (
        <RewardModal reward={editingReward} saving={actionLoading} saveError={saveError} onSave={handleSaveReward}
          onClose={() => { setShowRewardModal(false); setEditingReward(null); setSaveError(''); }} />
      )}
    </div>
  );
}

// ── Compact Summary ──

function CompactSummary({ stats, rewardCount }: { stats: DashboardStats; rewardCount: number }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <SummaryStat icon={Package} label="Rewards Configured" value={rewardCount.toString()} />
      <SummaryStat icon={Gift} label="Total Distributed" value={stats.totalDistributed.toLocaleString()} />
      <SummaryStat icon={Package} label="Remaining Inventory" value={stats.totalRemainingInventory.toLocaleString()} />
      <SummaryStat icon={DollarSign} label="Actual Reward Cost" value={fmtMoney(stats.totalActualCost)} />
    </div>
  );
}

function SummaryStat({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3" style={STAFF_GLASS_CARD}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color: GOLD }} strokeWidth={1.5} />
        <span className="text-[9px] font-bold tracking-widest uppercase text-white/40">{label}</span>
      </div>
      <p className="mt-1.5 text-base font-bold text-white lg:text-lg">{value}</p>
    </div>
  );
}

// ── Release Rate ──

function ReleaseRateCard({ currentRate, onRateChange, saving }: { currentRate: number; onRateChange: (r: number) => void; saving: boolean }) {
  return (
    <div className="rounded-xl border p-4" style={STAFF_GLASS_CARD}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <h3 className="text-xs font-bold tracking-widest uppercase text-white/70">Release Rate</h3>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="h-3 w-3 animate-spin text-white/40" />}
          <span className="rounded-full px-3 py-1 text-[11px] font-bold tabular-nums" style={{ background: GOLD + '20', color: SOFT_GOLD }}>
            {currentRate}%
          </span>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-white/35">How often eligible opportunities result in a reward.</p>
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={currentRate}
          onChange={(e) => onRateChange(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: GOLD }}
        />
        <div className="mt-1 flex items-center justify-between text-[9px] tracking-widest uppercase text-white/25">
          <span>0%</span>
          <span style={{ color: SOFT_GOLD }}>{RATE_LABELS[currentRate] ?? `${currentRate}%`}</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

// ── Reward Inventory ──

function RewardInventory({ rewards, actionLoading, activeProbabilityTotal, probabilityValid, onToggleActive, onArchive, onEdit, onCreate }: {
  rewards: MysteryVaultReward[]; actionLoading: boolean;
  activeProbabilityTotal: number; probabilityValid: boolean;
  onToggleActive: (id: string, active: boolean) => void; onArchive: (id: string) => void;
  onEdit: (r: MysteryVaultReward) => void; onCreate: () => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold tracking-widest uppercase text-white/60">Reward Inventory ({rewards.length})</h3>
        <button onClick={onCreate}
          className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all active:scale-95"
          style={{ borderColor: GOLD + '50', background: GOLD + '15', color: SOFT_GOLD }}>
          <Plus className="h-3 w-3" strokeWidth={2} /> Add Reward
        </button>
      </div>

      {rewards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border py-8 text-center" style={{ borderColor: BORDER, background: 'rgba(255,255,255,0.02)' }}>
          <Package className="h-7 w-7 text-white/15" strokeWidth={1.5} />
          <p className="mt-2 text-[12px] font-semibold text-white/50">No rewards configured</p>
          <button onClick={onCreate} className="mt-3 flex items-center gap-1 rounded-lg border px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase"
            style={{ borderColor: GOLD + '50', background: GOLD + '15', color: SOFT_GOLD }}>
            <Plus className="h-3 w-3" strokeWidth={2} /> Add Your First Reward
          </button>
        </div>
      ) : (
        <>
          {/* Compact table */}
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: BORDER }}>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b" style={{ borderColor: BORDER }}>
                  <th className="px-3 py-2 text-[9px] font-bold tracking-widest uppercase text-white/40">Reward</th>
                  <th className="px-3 py-2 text-[9px] font-bold tracking-widest uppercase text-white/40">Qty</th>
                  <th className="px-3 py-2 text-[9px] font-bold tracking-widest uppercase text-white/40">Drop %</th>
                  <th className="px-3 py-2 text-[9px] font-bold tracking-widest uppercase text-white/40">Active</th>
                  <th className="px-3 py-2 text-[9px] font-bold tracking-widest uppercase text-white/40 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((r) => {
                  const outOfStock = !r.unlimited_inventory && r.quantity_available <= 0;
                  const countedInTotal = r.is_active && !outOfStock;
                  return (
                    <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <p className="text-[11px] font-semibold text-white/90">{r.name}</p>
                        {r.description && <p className="mt-0.5 truncate text-[9px] text-white/35 max-w-[200px]">{r.description}</p>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[10px] text-white/60">
                        {r.unlimited_inventory ? <span style={{ color: SOFT_GOLD }}>∞</span> : <span className={outOfStock ? 'text-red-400/60' : ''}>{r.quantity_available}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[10px] font-semibold tabular-nums" style={{ color: countedInTotal ? SOFT_GOLD : 'rgba(255,255,255,0.25)' }}>
                        {Number(r.probability_weight).toFixed(0)}%
                        {!countedInTotal && <span className="ml-1 text-[8px] text-white/20">excl.</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => onToggleActive(r.id, !r.is_active)} disabled={actionLoading} title={r.is_active ? 'Disable' : 'Enable'} className="rounded-lg p-1 transition-colors hover:bg-white/5">
                          {r.is_active ? <ToggleRight className="h-4 w-4" style={{ color: GOLD }} /> : <ToggleLeft className="h-4 w-4 text-white/25" />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => onEdit(r)} disabled={actionLoading} title="Edit" className="rounded-lg p-1.5 transition-colors hover:bg-white/5">
                            <Edit2 className="h-3.5 w-3.5 text-white/50" />
                          </button>
                          <button onClick={() => onArchive(r.id)} disabled={actionLoading} title="Archive" className="rounded-lg p-1.5 transition-colors hover:bg-white/5">
                            <Archive className="h-3.5 w-3.5 text-white/40" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Probability total indicator */}
          <ProbabilityTotal total={activeProbabilityTotal} valid={probabilityValid} />
        </>
      )}
    </div>
  );
}

function ProbabilityTotal({ total, valid }: { total: number; valid: boolean }) {
  const rounded = Math.round(total * 100) / 100;
  if (valid) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-[11px] font-semibold text-emerald-300">Active drop probabilities total 100%</span>
      </div>
    );
  }
  const diff = rounded - 100;
  const direction = diff < 0 ? 'below' : 'above';
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
      <div>
        <p className="text-[11px] font-semibold text-amber-300">
          Active drop probabilities total {rounded.toFixed(2)}% — {Math.abs(diff).toFixed(2)}% {direction} 100%
        </p>
        <p className="mt-0.5 text-[10px] text-amber-200/60">
          Adjust reward drop probabilities so active rewards sum to exactly 100%. Inactive and out-of-stock rewards are excluded.
        </p>
      </div>
    </div>
  );
}

// ── Reward Modal (Create / Edit) ──

const FIELD = 'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/80 placeholder:text-white/25 focus:border-[#d4a52c]/30 focus:outline-none';
const LABEL = 'text-[9px] font-bold tracking-widest uppercase text-white/40';

function RewardModal({ reward, saving, saveError, onSave, onClose }: {
  reward: MysteryVaultReward | null; saving: boolean; saveError: string;
  onSave: (r: Partial<MysteryVaultReward>) => void; onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<MysteryVaultReward>>(reward ?? {
    name: '', description: '', category: REWARD_CATEGORIES[0], retail_value: 0, actual_cost: 0,
    quantity_available: 0, unlimited_inventory: false, rarity: RARITY_LEVELS[0],
    probability_weight: 0, expiration_date: null, is_active: false,
  });
  const set = <K extends keyof MysteryVaultReward>(key: K, value: MysteryVaultReward[K]) => setForm((p) => ({ ...p, [key]: value }));
  const [formError, setFormError] = useState('');

  const handleSubmit = () => {
    const name = (form.name ?? '').trim();
    if (!name) { setFormError('Reward name is required.'); return; }
    const weight = Number(form.probability_weight);
    if (isNaN(weight) || weight < 0) { setFormError('Drop probability must be 0 or a positive number.'); return; }
    setFormError('');
    onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5" style={{ borderColor: GOLD + '30', background: DARK_BG }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
            <h3 className="text-sm font-bold tracking-wide text-white uppercase">{reward ? 'Edit Reward' : 'New Reward'}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/5"><X className="h-4 w-4 text-white/50" /></button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className={LABEL}>Reward Name</label>
            <input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Free Spot Bundle" className={`mt-1 ${FIELD}`} />
          </div>
          <div>
            <label className={LABEL}>Reward Type</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className={`mt-1 ${FIELD}`}>
              {REWARD_CATEGORIES.map((c) => <option key={c} value={c} className="bg-black text-white">{c}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Description (optional)</label>
            <textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="Short description" rows={2} className={`mt-1 ${FIELD}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Quantity / Stock</label>
              <input type="number" value={form.quantity_available ?? 0} onChange={(e) => set('quantity_available', Number(e.target.value))} disabled={form.unlimited_inventory} className={`mt-1 ${FIELD} ${form.unlimited_inventory ? 'opacity-40' : ''}`} />
            </div>
            <div>
              <label className={LABEL}>Cost per Unit ($)</label>
              <input type="number" step="0.01" value={form.actual_cost ?? 0} onChange={(e) => set('actual_cost', Number(e.target.value))} className={`mt-1 ${FIELD}`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Drop Probability (%)</label>
              <input type="number" step="1" min={0} max={100} value={form.probability_weight ?? 0} onChange={(e) => set('probability_weight', Number(e.target.value))} className={`mt-1 ${FIELD}`} />
            </div>
            <div>
              <label className={LABEL}>Retail Value ($)</label>
              <input type="number" step="0.01" value={form.retail_value ?? 0} onChange={(e) => set('retail_value', Number(e.target.value))} className={`mt-1 ${FIELD}`} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.unlimited_inventory ?? false} onChange={(e) => set('unlimited_inventory', e.target.checked)} className="h-3.5 w-3.5" style={{ accentColor: GOLD }} />
              <span className="text-[10px] text-white/60">Unlimited Inventory</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active ?? false} onChange={(e) => set('is_active', e.target.checked)} className="h-3.5 w-3.5" style={{ accentColor: GOLD }} />
              <span className="text-[10px] text-white/60">Active</span>
            </label>
          </div>
          <p className="text-[9px] leading-relaxed text-white/30">
            Active rewards with stock must have drop probabilities totalling exactly 100%. Save as inactive (draft) if you're not ready to activate.
          </p>
        </div>

        {(formError || saveError) && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
            <p className="text-[10px] text-red-300">{formError || saveError}</p>
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold tracking-widest uppercase text-white/50 hover:text-white/80">Cancel</button>
          <button onClick={handleSubmit} disabled={saving || !form.name?.trim()}
            className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[10px] font-bold tracking-widest uppercase disabled:opacity-50"
            style={{ borderColor: GOLD + '50', background: GOLD + '15', color: SOFT_GOLD }}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {reward ? 'Save Changes' : 'Create Reward'}
          </button>
        </div>
      </div>
    </div>
  );
}
