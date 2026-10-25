import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, Filter, Trash2, AlertTriangle, ShieldAlert, RotateCcw,
  Image as ImageIcon, FileText, Hash, HardDrive, Copy, CheckCircle2,
  X, ChevronDown, User, Briefcase, Globe, Inbox, RefreshCw, Eye,
  History, Loader2,
} from 'lucide-react';
import { STAFF_GLASS_SHELL, STAFF_GLASS_CARD, STAFF_GOLD, STAFF_GOLD_SOFT, STAFF_BORDER } from '@/components/staff/staffGlass';
import { imageManifest, type ManifestImageEntry } from '@/data/imageManifest';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────

interface VaultAsset {
  id: string;
  title: string;
  source_path: string;
  source_type: string;
  source_bucket: string | null;
  filename: string;
  directory: string | null;
  extension: string;
  mime_type: string | null;
  file_size: number | null;
  content_hash: string | null;
  assignment_type: string;
  status: string;
  code_references: unknown;
  thumbnail_url: string | null;
  notes: string | null;
  quarantined_at: string | null;
  quarantined_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface VaultAssignment {
  id: string;
  image_id: string;
  assignment_type: string;
  assigned_account_id: string | null;
  assigned_function: string | null;
  assigned_label: string | null;
  assigned_by: string | null;
  created_at: string;
}

interface AuditEntry {
  id: string;
  image_id: string | null;
  action: string;
  actor_id: string | null;
  details: unknown;
  created_at: string;
}

type FilterTab = 'all' | 'assigned' | 'unassigned' | 'duplicates' | 'unused' | 'quarantined';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function imagePath(url: string): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('/public/')) return url.replace('/public/', '/');
  if (url.startsWith('/')) return url;
  return '/' + url;
}

function assignmentIcon(type: string) {
  switch (type) {
    case 'person_account': return User;
    case 'function_feature': return Briefcase;
    case 'general_shared': return Globe;
    default: return Inbox;
  }
}

function assignmentLabel(type: string): string {
  switch (type) {
    case 'person_account': return 'Person / Account';
    case 'function_feature': return 'Function / Feature';
    case 'general_shared': return 'General / Shared';
    default: return 'Unassigned';
  }
}

// ── Main Component ─────────────────────────────────────────────────────────

export function ImageVaultSection({ staffAccountId }: { staffAccountId: string }) {
  const [assets, setAssets] = useState<VaultAsset[]>([]);
  const [assignments, setAssignments] = useState<VaultAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<VaultAsset | null>(null);
  const [assignModalAsset, setAssignModalAsset] = useState<VaultAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VaultAsset | null>(null);
  const [quarantineTarget, setQuarantineTarget] = useState<VaultAsset | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 60;

  // ── Load data ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [assetRes, assignRes] = await Promise.all([
        supabase.from('image_vault_assets').select('*').order('created_at', { ascending: false }),
        supabase.from('image_vault_assignments').select('*').order('created_at', { ascending: false }),
      ]);

      if (assetRes.error) throw assetRes.error;
      if (assignRes.error) throw assignRes.error;

      setAssets((assetRes.data ?? []) as VaultAsset[]);
      setAssignments((assignRes.data ?? []) as VaultAssignment[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load image vault data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadAuditLog = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from('image_vault_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (err) throw err;
      setAuditLog((data ?? []) as AuditEntry[]);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => { if (showAudit) loadAuditLog(); }, [showAudit, loadAuditLog]);

  // ── Sync manifest to database ────────────────────────────────────────────

  const syncManifest = useCallback(async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const manifestImages: ManifestImageEntry[] = imageManifest.publicImages;
      let imported = 0;
      let updated = 0;

      for (const img of manifestImages) {
        const refs = imageManifest.codeReferences[img.path] ?? [];
        const { data, error: err } = await supabase.rpc('sv_iv_upsert_asset', {
          p_source_path: img.path,
          p_filename: img.filename,
          p_extension: img.extension,
          p_source_type: 'public_asset',
          p_directory: img.directory,
          p_file_size: img.sizeBytes,
          p_code_references: refs,
          p_title: img.filename.replace(/\.[^.]+$/, ''),
        });
        if (err) throw err;
        if (data) imported++;
        updated++;
      }
      setSyncMessage('Imported ' + imported + ' images (' + updated + ' processed)');
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setError(msg);
    } finally {
      setSyncing(false);
    }
  }, [loadData]);

  // ── Computed stats ───────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active = assets.filter((a) => a.status === 'active');
    const assigned = active.filter((a) => a.assignment_type !== 'unassigned');
    const unassigned = active.filter((a) => a.assignment_type === 'unassigned');
    const quarantined = assets.filter((a) => a.status === 'quarantined');
    const deleted = assets.filter((a) => a.status === 'deleted');

    // Duplicates: same content_hash, non-null, status active
    const hashGroups: Record<string, VaultAsset[]> = {};
    for (const a of active) {
      if (a.content_hash) {
        if (!hashGroups[a.content_hash]) hashGroups[a.content_hash] = [];
        hashGroups[a.content_hash].push(a);
      }
    }
    const duplicateGroups = Object.values(hashGroups).filter((g) => g.length > 1);
    const duplicateCount = duplicateGroups.reduce((sum, g) => sum + g.length, 0);

    // Unused: no code references and unassigned
    const unused = active.filter((a) => {
      const refs = a.code_references as string[];
      return (!refs || refs.length === 0) && a.assignment_type === 'unassigned';
    });

    // Referenced: has code references
    const referenced = active.filter((a) => {
      const refs = a.code_references as string[];
      return refs && refs.length > 0;
    });

    // Missing refs: referenced in code but file doesn't exist in manifest
    const manifestPaths = new Set(imageManifest.publicImages.map((i) => i.path));
    const missingRefs = Object.keys(imageManifest.codeReferences).filter((p) => !manifestPaths.has(p));

    const totalSize = active.reduce((sum, a) => sum + (a.file_size ?? 0), 0);

    return {
      total: active.length,
      assigned: assigned.length,
      unassigned: unassigned.length,
      referenced: referenced.length,
      unused: unused.length,
      duplicates: duplicateCount,
      duplicateGroups,
      missingRefs: missingRefs.length,
      quarantined: quarantined.length,
      deleted: deleted.length,
      totalSize,
    };
  }, [assets]);

  // ── Filtered list ────────────────────────────────────────────────────────

  const filteredAssets = useMemo(() => {
    let list = assets.filter((a) => a.status !== 'deleted');

    switch (filter) {
      case 'assigned':
        list = list.filter((a) => a.assignment_type !== 'unassigned');
        break;
      case 'unassigned':
        list = list.filter((a) => a.assignment_type === 'unassigned');
        break;
      case 'duplicates': {
        const dupIds = new Set(stats.duplicateGroups.flat().map((a) => a.id));
        list = list.filter((a) => dupIds.has(a.id));
        break;
      }
      case 'unused':
        list = list.filter((a) => {
          const refs = a.code_references as string[];
          return (!refs || refs.length === 0) && a.assignment_type === 'unassigned';
        });
        break;
      case 'quarantined':
        list = list.filter((a) => a.status === 'quarantined');
        break;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.filename.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        (a.directory ?? '').toLowerCase().includes(q) ||
        (a.source_path ?? '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [assets, filter, search, stats.duplicateGroups]);

  const pagedAssets = filteredAssets.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = pagedAssets.length < filteredAssets.length;

  // Reset page when filter/search changes
  useEffect(() => { setPage(0); }, [filter, search]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleAssign = useCallback(async (
    imageId: string,
    type: string,
    accountId: string | null,
    func: string | null,
    label: string | null
  ) => {
    try {
      const { error: err } = await supabase.rpc('sv_iv_assign_image', {
        p_image_id: imageId,
        p_assignment_type: type,
        p_assigned_account_id: accountId,
        p_assigned_function: func,
        p_assigned_label: label,
      });
      if (err) throw err;
      setAssignModalAsset(null);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Assignment failed';
      setError(msg);
    }
  }, [loadData]);

  const handleUnassign = useCallback(async (assignmentId: string) => {
    try {
      const { error: err } = await supabase.rpc('sv_iv_unassign_image', {
        p_assignment_id: assignmentId,
      });
      if (err) throw err;
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unassign failed';
      setError(msg);
    }
  }, [loadData]);

  const handleQuarantine = useCallback(async (imageId: string, reason: string) => {
    try {
      const { error: err } = await supabase.rpc('sv_iv_quarantine_image', {
        p_image_id: imageId,
        p_reason: reason,
      });
      if (err) throw err;
      setQuarantineTarget(null);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Quarantine failed';
      setError(msg);
    }
  }, [loadData]);

  const handleRestore = useCallback(async (imageId: string) => {
    try {
      const { error: err } = await supabase.rpc('sv_iv_restore_image', {
        p_image_id: imageId,
      });
      if (err) throw err;
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Restore failed';
      setError(msg);
    }
  }, [loadData]);

  const handleDelete = useCallback(async (imageId: string) => {
    try {
      const { error: err } = await supabase.rpc('sv_iv_delete_image', {
        p_image_id: imageId,
      });
      if (err) throw err;
      setDeleteTarget(null);
      setSelectedAsset(null);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      setError(msg);
    }
  }, [loadData]);

  // ── Assignments for selected asset ───────────────────────────────────────

  const assetAssignments = useMemo(() => {
    if (!selectedAsset) return [];
    return assignments.filter((a) => a.image_id === selectedAsset.id);
  }, [selectedAsset, assignments]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3 lg:p-4" style={STAFF_GLASS_SHELL}>
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2 border-b border-[#c0911e]/15 px-1 pb-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-[#d4a52c]" strokeWidth={1.5} />
          <div>
            <div className="text-[11px] font-bold tracking-[0.2em] text-white uppercase">Image Vault</div>
            <div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">
              {stats.total} images · {stats.assigned} assigned · {stats.duplicates} duplicates · {formatBytes(stats.totalSize)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAudit((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/60 transition hover:border-white/25 hover:text-white/90"
          >
            <History className="h-3.5 w-3.5" /> Audit
          </button>
          <button
            type="button"
            onClick={syncManifest}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/20 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sync Manifest
          </button>
        </div>
      </div>

      {/* Sync message */}
      {syncMessage && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" /> {syncMessage}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] text-red-300">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Stats dashboard */}
      <div className="mb-3 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard icon={ImageIcon} label="Total" value={stats.total} color="#d4a52c" active={filter === 'all'} onClick={() => setFilter('all')} />
        <StatCard icon={User} label="Assigned" value={stats.assigned} color="#10b981" active={filter === 'assigned'} onClick={() => setFilter('assigned')} />
        <StatCard icon={Inbox} label="Unassigned" value={stats.unassigned} color="#6b7280" active={filter === 'unassigned'} onClick={() => setFilter('unassigned')} />
        <StatCard icon={FileText} label="Referenced" value={stats.referenced} color="#3b82f6" />
        <StatCard icon={Copy} label="Duplicates" value={stats.duplicates} color="#f59e0b" active={filter === 'duplicates'} onClick={() => setFilter('duplicates')} />
        <StatCard icon={AlertTriangle} label="Unused" value={stats.unused} color="#ef4444" active={filter === 'unused'} onClick={() => setFilter('unused')} />
        <StatCard icon={ShieldAlert} label="Quarantined" value={stats.quarantined} color="#a78bfa" active={filter === 'quarantined'} onClick={() => setFilter('quarantined')} />
      </div>

      {/* Missing refs warning */}
      {stats.missingRefs > 0 && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[10px] text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {stats.missingRefs} image path(s) referenced in code but not found in public/ — may be missing files or external URLs.
        </div>
      )}

      {/* Search + filter bar */}
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename, title, or path..."
            className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-8 pr-3 text-[11px] text-white placeholder-white/30 outline-none focus:border-[#d4a52c]/40"
          />
        </div>
        <div className="flex items-center gap-1 text-[10px] text-white/40">
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{filteredAssets.length} shown</span>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#d4a52c]" />
        </div>
      ) : pagedAssets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-white/30">
          <ImageIcon className="h-8 w-8" />
          <div className="text-[11px]">No images found{filter !== 'all' ? ' for this filter' : ''}. {assets.length === 0 && 'Click "Sync Manifest" to import.'}</div>
        </div>
      ) : (
        <>
          {/* Gallery grid */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1" style={{ overscrollBehavior: 'contain' }}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {pagedAssets.map((asset) => (
                <ImageTile
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAsset?.id === asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  onQuarantine={() => setQuarantineTarget(asset)}
                  onDelete={() => setDeleteTarget(asset)}
                  onAssign={() => setAssignModalAsset(asset)}
                  onRestore={() => handleRestore(asset.id)}
                />
              ))}
            </div>
            {hasMore && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white/60 transition hover:border-white/25 hover:text-white/90"
                >
                  Load More ({filteredAssets.length - pagedAssets.length} remaining)
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Detail drawer */}
      {selectedAsset && (
        <DetailDrawer
          asset={selectedAsset}
          assignments={assetAssignments}
          onClose={() => setSelectedAsset(null)}
          onAssign={() => setAssignModalAsset(selectedAsset)}
          onUnassign={handleUnassign}
          onQuarantine={() => setQuarantineTarget(selectedAsset)}
          onDelete={() => setDeleteTarget(selectedAsset)}
          onRestore={() => handleRestore(selectedAsset.id)}
        />
      )}

      {/* Assign modal */}
      {assignModalAsset && (
        <AssignModal
          asset={assignModalAsset}
          onClose={() => setAssignModalAsset(null)}
          onAssign={handleAssign}
        />
      )}

      {/* Quarantine modal */}
      {quarantineTarget && (
        <QuarantineModal
          asset={quarantineTarget}
          onClose={() => setQuarantineTarget(null)}
          onConfirm={(reason) => handleQuarantine(quarantineTarget.id, reason)}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirmModal
          asset={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}

      {/* Audit log drawer */}
      {showAudit && (
        <AuditDrawer
          entries={auditLog}
          onClose={() => setShowAudit(false)}
          loading={auditLog.length === 0}
        />
      )}
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, color, active, onClick,
}: {
  icon: typeof ImageIcon;
  label: string;
  value: number;
  color: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition ${
        active ? 'border-[#d4a52c]/40 bg-[#d4a52c]/10' : 'border-white/10 bg-black/20'
      } ${onClick ? 'cursor-pointer hover:border-white/25' : 'cursor-default'}`}
      style={STAFF_GLASS_CARD}
    >
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      <div className="text-base font-bold text-white">{value}</div>
      <div className="text-[8px] font-mono uppercase tracking-widest text-white/40">{label}</div>
    </button>
  );
}

// ── Image Tile ─────────────────────────────────────────────────────────────

function ImageTile({
  asset, isSelected, onClick, onQuarantine, onDelete, onAssign, onRestore,
}: {
  asset: VaultAsset;
  isSelected: boolean;
  onClick: () => void;
  onQuarantine: () => void;
  onDelete: () => void;
  onAssign: () => void;
  onRestore: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const AssignIcon = assignmentIcon(asset.assignment_type);
  const isQuarantined = asset.status === 'quarantined';

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer overflow-hidden rounded-lg border transition ${
        isSelected ? 'border-[#d4a52c]/60 ring-1 ring-[#d4a52c]/30' : 'border-white/10 hover:border-white/25'
      }`}
      style={STAFF_GLASS_CARD}
    >
      {/* Thumbnail */}
      <div className="relative aspect-square overflow-hidden bg-black/40">
        {!imgError ? (
          <img
            src={imagePath(asset.source_path)}
            alt={asset.filename}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-6 w-6 text-white/20" />
          </div>
        )}
        {/* Status overlays */}
        {isQuarantined && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <ShieldAlert className="h-5 w-5 text-[#a78bfa]" />
          </div>
        )}
        {/* Assignment badge */}
        <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5">
          <AssignIcon className="h-2.5 w-2.5" style={{ color: asset.assignment_type === 'unassigned' ? '#6b7280' : '#10b981' }} />
        </div>
      </div>

      {/* Info bar */}
      <div className="p-1.5">
        <div className="truncate text-[9px] font-semibold text-white/80" title={asset.filename}>{asset.filename}</div>
        <div className="flex items-center justify-between text-[8px] text-white/30">
          <span>{asset.extension.toUpperCase()}</span>
          <span>{formatBytes(asset.file_size)}</span>
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
        <button type="button" onClick={(e) => { e.stopPropagation(); onAssign(); }} className="rounded bg-[#d4a52c]/20 p-1 text-[#f5e6b0] hover:bg-[#d4a52c]/30" title="Assign">
          <User className="h-3 w-3" />
        </button>
        {isQuarantined ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onRestore(); }} className="rounded bg-emerald-500/20 p-1 text-emerald-300 hover:bg-emerald-500/30" title="Restore">
            <RotateCcw className="h-3 w-3" />
          </button>
        ) : (
          <button type="button" onClick={(e) => { e.stopPropagation(); onQuarantine(); }} className="rounded bg-[#a78bfa]/20 p-1 text-[#a78bfa] hover:bg-[#a78bfa]/30" title="Quarantine">
            <ShieldAlert className="h-3 w-3" />
          </button>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded bg-red-500/20 p-1 text-red-300 hover:bg-red-500/30" title="Delete">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Detail Drawer ──────────────────────────────────────────────────────────

function DetailDrawer({
  asset, assignments, onClose, onAssign, onUnassign, onQuarantine, onDelete, onRestore,
}: {
  asset: VaultAsset;
  assignments: VaultAssignment[];
  onClose: () => void;
  onAssign: () => void;
  onUnassign: (id: string) => void;
  onQuarantine: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const refs = (asset.code_references as string[]) ?? [];
  const isQuarantined = asset.status === 'quarantined';

  return (
    <>
      <div className="fixed inset-0 z-[9990] bg-black/50" onClick={onClose} />
      <div className="fixed right-0 top-0 z-[9991] flex h-full w-full max-w-md flex-col border-l border-[#c0911e]/20 bg-[#0a0c0e] shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 p-3">
          <div className="text-[11px] font-bold tracking-widest text-[#d4a52c] uppercase">Image Details</div>
          <button type="button" onClick={onClose} className="rounded p-1 text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4" style={{ overscrollBehavior: 'contain' }}>
          {/* Preview */}
          <div className="mb-4 overflow-hidden rounded-lg border border-white/10 bg-black/40">
            {!imgError ? (
              <img src={imagePath(asset.source_path)} alt={asset.filename} className="w-full object-contain" onError={() => setImgError(true)} />
            ) : (
              <div className="flex h-32 items-center justify-center"><ImageIcon className="h-8 w-8 text-white/20" /></div>
            )}
          </div>

          {/* Status badge */}
          <div className="mb-3 flex items-center gap-2">
            {isQuarantined ? (
              <span className="flex items-center gap-1 rounded-full bg-[#a78bfa]/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#a78bfa]">
                <ShieldAlert className="h-3 w-3" /> Quarantined
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Active
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white/50">
              {assignmentLabel(asset.assignment_type)}
            </span>
          </div>

          {/* Metadata */}
          <div className="mb-4 space-y-1.5 rounded-lg border border-white/10 bg-black/20 p-3">
            <DetailRow label="Filename" value={asset.filename} />
            <DetailRow label="Path" value={asset.source_path} mono />
            <DetailRow label="Source" value={asset.source_type} />
            <DetailRow label="Directory" value={asset.directory ?? '—'} />
            <DetailRow label="Format" value={asset.extension.toUpperCase()} />
            <DetailRow label="Size" value={formatBytes(asset.file_size)} />
            {asset.content_hash && <DetailRow label="Hash" value={asset.content_hash.slice(0, 16) + '...'} mono />}
            {asset.dimensions && <DetailRow label="Dimensions" value={asset.dimensions} />}
          </div>

          {/* Quarantine info */}
          {isQuarantined && asset.quarantined_reason && (
            <div className="mb-4 rounded-lg border border-[#a78bfa]/20 bg-[#a78bfa]/10 p-3 text-[10px] text-[#a78bfa]">
              <div className="font-bold uppercase tracking-wider">Quarantine Reason</div>
              <div className="mt-1">{asset.quarantined_reason}</div>
            </div>
          )}

          {/* Code references (Where Used) */}
          <div className="mb-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
              <FileText className="h-3 w-3" /> Where Used ({refs.length})
            </div>
            {refs.length > 0 ? (
              <div className="space-y-1">
                {refs.map((ref, i) => (
                  <div key={i} className="rounded border border-white/5 bg-black/20 px-2 py-1 text-[9px] font-mono text-white/50">
                    {ref}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-white/30">No code references found.</div>
            )}
          </div>

          {/* Assignments */}
          <div className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                <User className="h-3 w-3" /> Assignments ({assignments.length})
              </div>
              <button type="button" onClick={onAssign} className="flex items-center gap-1 rounded border border-[#d4a52c]/30 bg-[#d4a52c]/10 px-2 py-0.5 text-[9px] font-bold uppercase text-[#f5e6b0] hover:bg-[#d4a52c]/20">
                <User className="h-2.5 w-2.5" /> Assign
              </button>
            </div>
            {assignments.length > 0 ? (
              <div className="space-y-1.5">
                {assignments.map((a) => {
                  const AIcon = assignmentIcon(a.assignment_type);
                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
                      <div className="flex items-center gap-2">
                        <AIcon className="h-3 w-3 text-[#d4a52c]" />
                        <div>
                          <div className="text-[10px] font-semibold text-white/80">{a.assigned_label ?? assignmentLabel(a.assignment_type)}</div>
                          {a.assigned_function && <div className="text-[8px] font-mono text-white/40">{a.assigned_function}</div>}
                        </div>
                      </div>
                      <button type="button" onClick={() => onUnassign(a.id)} className="rounded p-1 text-white/30 hover:bg-red-500/10 hover:text-red-300" title="Remove assignment">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[10px] text-white/30">No assignments. Click "Assign" to link this image.</div>
            )}
          </div>

          {/* Notes */}
          {asset.notes && (
            <div className="mb-4 rounded-lg border border-white/10 bg-black/20 p-3 text-[10px] text-white/60">
              <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-white/40">Notes</div>
              {asset.notes}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex shrink-0 gap-2 border-t border-white/10 p-3">
          {isQuarantined ? (
            <button type="button" onClick={onRestore} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500/20">
              <RotateCcw className="h-3.5 w-3.5" /> Restore
            </button>
          ) : (
            <button type="button" onClick={onQuarantine} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#a78bfa]/30 bg-[#a78bfa]/10 py-2 text-[10px] font-bold uppercase tracking-wider text-[#a78bfa] transition hover:bg-[#a78bfa]/20">
              <ShieldAlert className="h-3.5 w-3.5" /> Quarantine
            </button>
          )}
          <button type="button" onClick={onDelete} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 py-2 text-[10px] font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500/20">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[10px]">
      <span className="shrink-0 font-mono uppercase tracking-wider text-white/40">{label}</span>
      <span className={`truncate text-right text-white/70 ${mono ? 'font-mono' : ''}`} title={value}>{value}</span>
    </div>
  );
}

// ── Assign Modal ───────────────────────────────────────────────────────────

function AssignModal({
  asset, onClose, onAssign,
}: {
  asset: VaultAsset;
  onClose: () => void;
  onAssign: (imageId: string, type: string, accountId: string | null, func: string | null, label: string | null) => void;
}) {
  const [type, setType] = useState<string>('function_feature');
  const [accountId, setAccountId] = useState('');
  const [func, setFunc] = useState('');
  const [label, setLabel] = useState('');

  const handleSubmit = () => {
    const trimmedLabel = label.trim() || null;
    const trimmedFunc = func.trim() || null;
    const trimmedAccountId = accountId.trim() || null;
    onAssign(asset.id, type, type === 'person_account' ? trimmedAccountId : null, type === 'function_feature' ? trimmedFunc : null, trimmedLabel);
  };

  return (
    <>
      <div className="fixed inset-0 z-[9992] bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[9993] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#c0911e]/20 bg-[#0a0c0e] p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[11px] font-bold tracking-widest text-[#d4a52c] uppercase">Assign Image</div>
          <button type="button" onClick={onClose} className="rounded p-1 text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-3 truncate text-[9px] font-mono text-white/40">{asset.filename}</div>

        {/* Assignment type selector */}
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {([
            { value: 'person_account', label: 'Person', icon: User },
            { value: 'function_feature', label: 'Function', icon: Briefcase },
            { value: 'general_shared', label: 'General', icon: Globe },
          ] as const).map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`flex flex-col items-center gap-1 rounded-lg border py-2 text-[9px] font-bold uppercase tracking-wider transition ${
                  type === opt.value ? 'border-[#d4a52c]/40 bg-[#d4a52c]/10 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:border-white/25'
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {opt.label}
              </button>
            );
          })}
        </div>

        {/* Conditional fields */}
        {type === 'person_account' && (
          <div className="mb-3">
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-white/40">Account ID (UUID)</label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="auth.users UUID — never use names or array positions"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] font-mono text-white placeholder-white/20 outline-none focus:border-[#d4a52c]/40"
            />
            <div className="mt-1 text-[8px] text-amber-400/60">
              Profile assignments must use the account's UUID for integrity.
            </div>
          </div>
        )}

        {type === 'function_feature' && (
          <div className="mb-3">
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-white/40">Function / Feature</label>
            <input
              type="text"
              value={func}
              onChange={(e) => setFunc(e.target.value)}
              placeholder="e.g. player_avatar, coach_portal_bg, about_page_slide"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] text-white placeholder-white/20 outline-none focus:border-[#d4a52c]/40"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-white/40">Label (optional)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Human-readable name for this assignment"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] text-white placeholder-white/20 outline-none focus:border-[#d4a52c]/40"
          />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-white/10 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50 transition hover:border-white/25">Cancel</button>
          <button type="button" onClick={handleSubmit} className="flex-1 rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/15 py-2 text-[10px] font-bold uppercase tracking-wider text-[#f5e6b0] transition hover:bg-[#d4a52c]/25">Assign</button>
        </div>
      </div>
    </>
  );
}

// ── Quarantine Modal ───────────────────────────────────────────────────────

function QuarantineModal({ asset, onClose, onConfirm }: { asset: VaultAsset; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const refs = (asset.code_references as string[]) ?? [];

  return (
    <>
      <div className="fixed inset-0 z-[9992] bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[9993] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#a78bfa]/20 bg-[#0a0c0e] p-4 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#a78bfa]" />
          <div className="text-[11px] font-bold tracking-widest text-[#a78bfa] uppercase">Quarantine Image</div>
        </div>

        <div className="mb-3 truncate text-[9px] font-mono text-white/40">{asset.filename}</div>

        {refs.length > 0 && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[10px] text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>This image is referenced in {refs.length} code file(s). Quarantining will hide it from normal views but will not remove the file.</span>
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-white/40">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this image being quarantined?"
            rows={3}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] text-white placeholder-white/20 outline-none focus:border-[#a78bfa]/40"
          />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-white/10 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50 transition hover:border-white/25">Cancel</button>
          <button type="button" onClick={() => onConfirm(reason.trim() || 'No reason provided')} className="flex-1 rounded-lg border border-[#a78bfa]/40 bg-[#a78bfa]/15 py-2 text-[10px] font-bold uppercase tracking-wider text-[#a78bfa] transition hover:bg-[#a78bfa]/25">Quarantine</button>
        </div>
      </div>
    </>
  );
}

// ── Delete Confirm ─────────────────────────────────────────────────────────

function DeleteConfirmModal({ asset, onClose, onConfirm }: { asset: VaultAsset; onClose: () => void; onConfirm: () => void }) {
  const refs = (asset.code_references as string[]) ?? [];
  const hasAssignments = asset.assignment_type !== 'unassigned';

  return (
    <>
      <div className="fixed inset-0 z-[9992] bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[9993] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-red-500/20 bg-[#0a0c0e] p-4 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <div className="text-[11px] font-bold tracking-widest text-red-400 uppercase">Delete Image</div>
        </div>

        <div className="mb-3 truncate text-[9px] font-mono text-white/40">{asset.filename}</div>

        <div className="mb-3 space-y-2">
          {(refs.length > 0 || hasAssignments) && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-[10px] text-red-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                {refs.length > 0 && <div>Referenced in {refs.length} code file(s).</div>}
                {hasAssignments && <div>Has active assignment(s).</div>}
                <div className="mt-1 font-bold">Deleting will break these references.</div>
              </div>
            </div>
          )}
          <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 text-[10px] text-white/50">
            This is a soft-delete: the image is marked as deleted and hidden from all views. The actual file in storage is NOT removed. The action is recorded in the audit log and can be reversed.
          </div>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-white/10 py-2 text-[10px] font-bold uppercase tracking-wider text-white/50 transition hover:border-white/25">Cancel</button>
          <button type="button" onClick={onConfirm} className="flex-1 rounded-lg border border-red-500/40 bg-red-500/15 py-2 text-[10px] font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500/25">Delete</button>
        </div>
      </div>
    </>
  );
}

// ── Audit Drawer ───────────────────────────────────────────────────────────

function AuditDrawer({ entries, onClose, loading }: { entries: AuditEntry[]; onClose: () => void; loading: boolean }) {
  return (
    <>
      <div className="fixed inset-0 z-[9990] bg-black/50" onClick={onClose} />
      <div className="fixed right-0 top-0 z-[9991] flex h-full w-full max-w-md flex-col border-l border-[#c0911e]/20 bg-[#0a0c0e] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 p-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-[#d4a52c]" />
            <div className="text-[11px] font-bold tracking-widest text-[#d4a52c] uppercase">Audit Log</div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3" style={{ overscrollBehavior: 'contain' }}>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#d4a52c]" /></div>
          ) : entries.length === 0 ? (
            <div className="py-8 text-center text-[10px] text-white/30">No audit entries yet.</div>
          ) : (
            <div className="space-y-1.5">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-white/5 bg-black/20 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#d4a52c]">{entry.action}</span>
                    <span className="text-[8px] font-mono text-white/30">{new Date(entry.created_at).toLocaleString()}</span>
                  </div>
                  {entry.image_id && (
                    <div className="mt-1 text-[8px] font-mono text-white/30">Image: {entry.image_id.slice(0, 8)}...</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
