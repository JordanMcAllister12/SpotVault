import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, Image as ImageIcon, Search, Shield, Trash2, Upload, X,
  ShieldCheck, BadgeCheck, KeyRound, Clock, FileText, Mail, CalendarCheck,
  Users, BarChart3, Globe, RefreshCw, AlertCircle, LogIn, ShieldX, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useStaffTraffic, useStaffAccounts, useLoginActivity, type LoginPeriod, type LoginActivityRow } from '@/hooks/useStaffAccounts';

import { type SpotVaultAccount } from '@/types';
import { useUserNames } from '@/hooks/useUserNames';
import {
  SCREEN_TARGETS, getScreenLabel, useEnvironmentAssets, usePortalBackground,
  type EnvironmentAsset, type ScreenTarget, type GalleryVisibility,
} from '@/data/environmentAssets';
import {
  type BookingProviderApproval, fetchAllApprovedProviders, approveProvider, revokeProviderApproval,
} from '@/lib/booking';
import { StaffVerificationQueue } from '@/features/community/StaffVerificationQueue';
import {
  getPendingRoleRequests, getAllRoleRequests, reviewRoleRequest, revokeRoleRequest,
  type RoleRequest,
} from '@/lib/authEngine';
import { ROLE_LABELS, type RoleType } from '@/lib/authConstants';
import {
  getPendingFeedPostingRequests, getAllFeedPostingRequests, approveFeedPosting, rejectFeedPosting, revokeFeedPosting,
  type FeedPostingRequest,
} from '@/lib/authEngine';
import {
  searchUsersForNetworkApproval, grantNetworkPosting, revokeNetworkPosting, getNetworkPostingApprovals,
  type NetworkUserSearchResult, type NetworkPostingApproval,
} from '@/lib/authEngine';
import { sendSystemMessage } from '@/lib/profileStore';

// ── Types ──────────────────────────────────────────────────────

export type AssetFilter = 'ALL' | 'ASSIGNED' | 'UNASSIGNED' | 'ACCESS' | 'COMMUNITY' | 'PLAYER' | 'BUSINESS' | 'CREATOR' | 'COACH' | 'STABLE' | 'JOBS' | 'ADVERTISING' | 'MARKETPLACE' | 'STORE' | 'PERFORMANCE_CENTER' | 'HELP' | 'STUDENT_CENTER' | 'STAFF';

const PORTAL_FILTERS = new Set<AssetFilter>(['PLAYER', 'BUSINESS', 'CREATOR', 'COACH', 'STABLE']);

function assetsEqual(a: EnvironmentAsset[], b: EnvironmentAsset[]): boolean {
  if (a.length !== b.length) return false;
  const bMap = new Map(b.map((x) => [x.id, x]));
  for (const item of a) {
    const match = bMap.get(item.id);
    if (!match) return false;
    if (match.name !== item.name || match.notes !== item.notes || match.src !== item.src ||
        match.fileName !== item.fileName || match.filePath !== item.filePath ||
        match.galleryVisibility !== item.galleryVisibility ||
        match.allowedScreens.length !== item.allowedScreens.length ||
        item.allowedScreens.some((t, i) => t !== match.allowedScreens[i])) return false;
  }
  return true;
}

// ── Asset Manager (main view) ──────────────────────────────────

export function AssetManagerSection({ staffAccount }: { staffAccount: SpotVaultAccount }) {
  const assetStore = useEnvironmentAssets();
  const [draft, setDraft] = useState<EnvironmentAsset[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<AssetFilter>('ALL');
  const [search, setSearch] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EnvironmentAsset | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<ScreenTarget | null>(null);
  const [applyStatus, setApplyStatus] = useState<{ kind: 'idle' | 'saving' | 'success' | 'error'; message?: string }>({ kind: 'idle' });

  useEffect(() => {
    if (assetStore.ready && !draftLoaded) {
      setDraft(assetStore.assets);
      setDraftLoaded(true);
    }
  }, [assetStore.ready, assetStore.assets, draftLoaded]);

  const hasUnsavedChanges = useMemo(() => {
    if (!draftLoaded) return false;
    return !assetsEqual(draft, assetStore.assets);
  }, [draft, assetStore.assets, draftLoaded]);

  const filteredAssets = useMemo(() => draft.filter((asset) => {
    const haystack = `${asset.name} ${asset.fileName} ${asset.notes}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    const targets = asset.allowedScreens;
    if (filter === 'ALL') return true;
    if (filter === 'UNASSIGNED') return targets.length === 0;
    if (filter === 'ASSIGNED') return targets.length > 0;
    if (filter === 'ACCESS') return targets.includes('ACCESS_LOGIN');
    if (filter === 'COMMUNITY') return targets.includes('COMMUNITY');
    if (filter === 'JOBS') return targets.includes('JOBS');
    if (filter === 'ADVERTISING') return targets.includes('ADVERTISING');
    if (filter === 'MARKETPLACE') return targets.includes('MARKETPLACE');
    if (filter === 'STORE') return targets.includes('STORE');
    if (filter === 'PERFORMANCE_CENTER') return targets.includes('PERFORMANCE_CENTER');
    if (filter === 'HELP') return targets.includes('HELP_MAIN');
    if (filter === 'STUDENT_CENTER') return targets.includes('STUDENT_CENTER');
    if (filter === 'STAFF') return targets.includes('STAFF_ADMIN');
    if (PORTAL_FILTERS.has(filter)) return targets.some((target) => target.startsWith(`${filter}_`));
    return true;
  }), [draft, filter, search]);

  const safeIndex = filteredAssets.length > 0 ? Math.min(currentIndex, filteredAssets.length - 1) : 0;
  const currentAsset = filteredAssets[safeIndex] ?? null;

  const goPrev = () => setCurrentIndex((i) => (filteredAssets.length > 0 ? (i - 1 + filteredAssets.length) % filteredAssets.length : 0));
  const goNext = () => setCurrentIndex((i) => (filteredAssets.length > 0 ? (i + 1) % filteredAssets.length : 0));

  useEffect(() => { if (currentIndex >= filteredAssets.length) setCurrentIndex(0); }, [filteredAssets.length, currentIndex]);

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const savedIds = new Set(assetStore.assets.map((a) => a.id));
      const draftIds = new Set(draft.map((a) => a.id));

      for (const asset of draft) {
        if (!savedIds.has(asset.id)) continue;
        const original = assetStore.assets.find((a) => a.id === asset.id)!;
        const nameChanged = original.name !== asset.name;
        const notesChanged = original.notes !== asset.notes;
        const screensChanged = original.allowedScreens.length !== asset.allowedScreens.length ||
          original.allowedScreens.some((t, i) => t !== asset.allowedScreens[i]);
        const visibilityChanged = original.galleryVisibility !== asset.galleryVisibility;
        if (nameChanged || notesChanged || screensChanged || visibilityChanged) {
          await assetStore.updateMetadata(asset.id, { name: asset.name, notes: asset.notes });
          if (visibilityChanged) {
            await assetStore.updateGalleryVisibility(asset.id, asset.galleryVisibility);
          }
          if (screensChanged) {
            const currentTargets = original.allowedScreens;
            const newTargets = asset.allowedScreens;
            const add = newTargets.filter((t) => !currentTargets.includes(t));
            const remove = currentTargets.filter((t) => !newTargets.includes(t));
            for (const t of add) await assetStore.updateAssignments([asset.id], t, true);
            for (const t of remove) await assetStore.updateAssignments([asset.id], t, false);
          }
        }
      }

      for (const asset of assetStore.assets) {
        if (!draftIds.has(asset.id)) {
          await assetStore.deleteAsset(asset.id);
        }
      }

      for (const asset of draft) {
        if (!savedIds.has(asset.id) && asset.src) {
          await assetStore.saveNewAssetFromDraft(asset);
        }
      }

      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      window.dispatchEvent(new CustomEvent('spotvault-environment-assets-changed'));
    } finally {
      setSaving(false);
    }
  };

  const FILTER_LABELS: Record<AssetFilter, string> = {
    ALL: 'All', ASSIGNED: 'Assigned', UNASSIGNED: 'Unassigned', ACCESS: 'Access', COMMUNITY: 'Community',
    PLAYER: 'Player', BUSINESS: 'Business', CREATOR: 'Creator', COACH: 'Coach', STABLE: 'Stable',
    JOBS: 'Jobs', ADVERTISING: 'Advertising', MARKETPLACE: 'Marketplace', STORE: 'Store',
    PERFORMANCE_CENTER: 'Performance Center', HELP: 'Help', STUDENT_CENTER: 'Workspace', STAFF: 'Staff',
  };

  const COMPACT_FILTERS: AssetFilter[] = ['ALL', 'ASSIGNED', 'UNASSIGNED', 'PLAYER', 'COMMUNITY', 'STUDENT_CENTER', 'BUSINESS', 'CREATOR', 'COACH', 'STABLE', 'STAFF'];

  const removeAssignment = (target: ScreenTarget) => {
    if (!currentAsset) return;
    setDraft((prev) => prev.map((a) => a.id === currentAsset.id ? { ...a, allowedScreens: a.allowedScreens.filter((t) => t !== target) } : a));
  };

  const addAssignment = (target: ScreenTarget) => {
    if (!currentAsset) return;
    setDraft((prev) => prev.map((a) => a.id === currentAsset.id ? { ...a, allowedScreens: a.allowedScreens.includes(target) ? a.allowedScreens : [...a.allowedScreens, target] } : a));
    setAssignOpen(false);
  };

  const handleVisibilityChange = (visibility: GalleryVisibility) => {
    if (!currentAsset) return;
    setDraft((prev) => prev.map((a) => a.id === currentAsset.id ? { ...a, galleryVisibility: visibility } : a));
  };

  const handleApplyBackground = async () => {
    if (!currentAsset || !applyTarget) return;
    setApplyStatus({ kind: 'saving' });
    try {
      await assetStore.applyPortalBackground(currentAsset.id, applyTarget);
      setDraft((prev) => prev.map((a) => {
        if (a.id === currentAsset.id) {
          return { ...a, allowedScreens: a.allowedScreens.includes(applyTarget) ? a.allowedScreens : [...a.allowedScreens, applyTarget] };
        }
        return { ...a, allowedScreens: a.allowedScreens.filter((t) => t !== applyTarget) };
      }));
      setApplyStatus({ kind: 'success', message: `${getScreenLabel(applyTarget)} background updated.` });
      window.setTimeout(() => setApplyStatus({ kind: 'idle' }), 3000);
    } catch {
      setApplyStatus({ kind: 'error', message: 'Could not apply background. Please try again.' });
      window.setTimeout(() => setApplyStatus({ kind: 'idle' }), 4000);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-white/[0.06] bg-[#0a0c0e]/40 px-4 py-3 sm:px-5 sm:py-4 backdrop-blur-md">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">Image Library · {draft.length} assets</div>
            <h1 className="mt-1 text-xl font-semibold text-white">Asset Manager</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 sm:w-auto lg:w-64">
              <Search className="h-3.5 w-3.5 text-white/35" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name..." className="w-full bg-transparent text-[11px] text-white outline-none placeholder:text-white/25" />
            </label>
            <div className="relative">
              <button type="button" onClick={() => setFilterOpen((v) => !v)} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-bold tracking-widest text-white/60 uppercase hover:border-white/25">
                Filter: {FILTER_LABELS[filter]} <ChevronRight className={`h-3 w-3 transition-transform ${filterOpen ? 'rotate-90' : ''}`} />
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-white/10 bg-[#0b0d0f] p-1 shadow-xl">
                  {COMPACT_FILTERS.map((f) => (
                    <button key={f} type="button" onClick={() => { setFilter(f); setFilterOpen(false); setCurrentIndex(0); }} className={`block w-full rounded-md px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider ${filter === f ? 'bg-[#d4a52c]/15 text-[#f5e6b0]' : 'text-white/50 hover:bg-white/5'}`}>{FILTER_LABELS[f]}</button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={() => setUploadOpen(true)} className="flex items-center gap-2 rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/15 px-3 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase hover:bg-[#d4a52c]/25"><Upload className="h-3.5 w-3.5" />Add Images</button>
            <button type="button" disabled={!hasUnsavedChanges || saving} onClick={() => void handleSaveChanges()} className="rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/20 px-4 py-2 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:bg-[#d4a52c]/30 disabled:opacity-40 disabled:saturate-50">{saving ? 'Saving...' : 'Save Changes'}</button>
            {saved && <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-emerald-300 uppercase"><Check className="h-3.5 w-3.5" />Saved</span>}
            {hasUnsavedChanges && <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-amber-300 uppercase"><AlertTriangle className="h-3.5 w-3.5" />Unsaved</span>}
          </div>
        </div>
      </div>

      <div className="flex-1 p-3 sm:p-5">
        {filteredAssets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-[#0a0c0e]/30 p-10 text-center text-[11px] text-white/40 backdrop-blur-md">No assets match this filter.</div>
        ) : currentAsset ? (
          <div className="mx-auto max-w-3xl">
            {/* Image viewer with prev/next */}
            <div className="flex items-center gap-4">
              <button type="button" onClick={goPrev} disabled={filteredAssets.length <= 1} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0a0c0e]/40 text-white/60 backdrop-blur-md transition hover:border-[#d4a52c]/40 hover:text-[#d4a52c] disabled:opacity-30">
                <ChevronLeft className="h-6 w-6" />
              </button>
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/[0.08] bg-[#111416]">
                {currentAsset.src ? <img src={currentAsset.src} alt={currentAsset.name} className="aspect-video w-full object-contain" /> : <div className="aspect-video w-full bg-[radial-gradient(ellipse_at_50%_30%,#25211a_0%,#08090a_75%)]" />}
              </div>
              <button type="button" onClick={goNext} disabled={filteredAssets.length <= 1} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0a0c0e]/40 text-white/60 backdrop-blur-md transition hover:border-[#d4a52c]/40 hover:text-[#d4a52c] disabled:opacity-30">
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>

            {/* Image info + assignments */}
            <div className="mt-5 rounded-xl border border-[#c0911e]/20 bg-[#0a0c0e]/50 p-5 backdrop-blur-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-mono tracking-widest text-[#d4a52c] uppercase">Asset {safeIndex + 1} of {filteredAssets.length}</div>
                  <h2 className="mt-1 text-lg font-bold text-white">{currentAsset.name}</h2>
                  <div className="mt-1 text-[10px] text-white/40">{currentAsset.fileName}</div>
                  <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase ${currentAsset.allowedScreens.length ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-300' : 'border-amber-300/30 bg-amber-300/10 text-amber-200'}`}>{currentAsset.allowedScreens.length ? 'Assigned' : 'Unassigned'}</div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Gallery:</span>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase ${currentAsset.galleryVisibility === 'hidden' ? 'border-white/15 bg-white/5 text-white/40' : 'border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[#d4a52c]'}`}>{currentAsset.galleryVisibility === 'both' ? 'Player + Community' : currentAsset.galleryVisibility === 'player' ? 'Player Only' : currentAsset.galleryVisibility === 'community' ? 'Community Only' : 'Hidden'}</span>
                  </div>
                </div>
                <button type="button" onClick={() => setDeleteTarget(currentAsset)} className="flex items-center gap-1 rounded-lg border border-red-300/20 bg-red-300/5 px-3 py-2 text-[9px] font-bold tracking-widest text-red-200 uppercase hover:border-red-300/40 hover:bg-red-300/10"><Trash2 className="h-3 w-3" />Delete</button>
              </div>

              {/* Current assignments */}
              <div className="mt-5">
                <div className="mb-2 text-[9px] font-mono tracking-[0.2em] text-[#d4a52c] uppercase">Current Assignments</div>
                {currentAsset.allowedScreens.length ? (
                  <div className="flex flex-wrap gap-2">
                    {currentAsset.allowedScreens.map((target) => (
                      <span key={target} className="flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-200">
                        {getScreenLabel(target)}
                        <button type="button" onClick={() => removeAssignment(target)} className="ml-0.5 text-emerald-200/60 hover:text-red-300"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-amber-200">No assignments yet.</p>
                )}
                <button type="button" onClick={() => setAssignOpen((v) => !v)} className="mt-3 flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/10 px-3 py-2 text-[9px] font-bold tracking-widest text-[#f5e6b0] uppercase hover:bg-[#d4a52c]/20">
                  <Upload className="h-3 w-3" /> Assign to Room / Page
                </button>
              </div>

              {/* Founder approval: gallery visibility */}
              <div className="mt-5 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/[0.04] p-4">
                <div className="mb-2 text-[9px] font-mono tracking-[0.2em] text-[#d4a52c] uppercase">Founder Approval · Gallery Visibility</div>
                <p className="mb-3 text-[10px] leading-relaxed text-white/40">Control where this background appears in the user-facing background selection gallery. Hidden backgrounds are only visible to staff.</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: 'both', label: 'Player + Community' },
                    { value: 'player', label: 'Player Portal Only' },
                    { value: 'community', label: 'Community Only' },
                    { value: 'hidden', label: 'Hidden from Users' },
                  ] as { value: GalleryVisibility; label: string }[]).map((opt) => {
                    const active = currentAsset.galleryVisibility === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => handleVisibilityChange(opt.value)}
                        className={`rounded-lg border px-3 py-2 text-[9px] font-bold tracking-widest uppercase transition-all ${active ? 'border-[#d4a52c]/60 bg-[#d4a52c]/20 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/70'}`}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assignment selector */}
              {assignOpen && (
                <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="mb-2 text-[9px] font-mono tracking-widest text-white/30 uppercase">Select Destination</div>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {SCREEN_TARGETS.map((group) => (
                      <div key={group.group}>
                        <div className="text-[8px] font-bold tracking-widest text-white/40 uppercase">{group.label}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {group.targets.map((target) => {
                            const isAssigned = currentAsset.allowedScreens.includes(target.id);
                            return (
                              <button key={target.id} type="button" onClick={() => isAssigned ? removeAssignment(target.id) : addAssignment(target.id)} className={`rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase ${isAssigned ? 'border-emerald-300/40 bg-emerald-300/15 text-emerald-200' : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/70'}`}>{target.label}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply Background to Portal */}
              <div className="mt-5 rounded-lg border border-[#c0911e]/20 bg-[#c0911e]/[0.04] p-4">
                <div className="mb-2 text-[9px] font-mono tracking-[0.2em] text-[#d4a52c] uppercase">Apply as Portal Background</div>
                <p className="mb-3 text-[10px] leading-relaxed text-white/40">Select a portal or room below, then click Apply Background. This will exclusively set this image as the active background for that destination, replacing any previous assignment.</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <select
                    value={applyTarget ?? ''}
                    onChange={(e) => setApplyTarget((e.target.value || null) as ScreenTarget | null)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[11px] font-semibold text-white outline-none focus:border-[#d4a52c]/60"
                  >
                    <option value="">Select destination...</option>
                    {SCREEN_TARGETS.map((group) => (
                      <optgroup key={group.group} label={group.label}>
                        {group.targets.map((target) => (
                          <option key={target.id} value={target.id}>{target.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!applyTarget || applyStatus.kind === 'saving' || !currentAsset.src}
                    onClick={() => void handleApplyBackground()}
                    className="flex items-center justify-center gap-2 rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/20 px-5 py-2.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:bg-[#d4a52c]/30 disabled:opacity-40 disabled:saturate-50"
                  >
                    {applyStatus.kind === 'saving' ? 'Applying...' : 'Apply Background'}
                  </button>
                </div>
                {applyStatus.kind === 'success' && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2">
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                    <span className="text-[10px] font-bold tracking-widest text-emerald-300 uppercase">{applyStatus.message}</span>
                  </div>
                )}
                {applyStatus.kind === 'error' && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-300/10 px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-300" />
                    <span className="text-[10px] font-bold tracking-widest text-red-300 uppercase">{applyStatus.message}</span>
                  </div>
                )}
                {currentAsset.allowedScreens.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {currentAsset.allowedScreens.map((target) => (
                      <span key={target} className="flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-bold tracking-wider text-emerald-200 uppercase">
                        <Check className="h-2.5 w-2.5" /> {getScreenLabel(target)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onSave={(newAssets) => { setDraft((prev) => [...prev, ...newAssets]); setUploadOpen(false); }} />}
      {deleteTarget && <DeleteConfirm asset={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={() => { setDraft((prev) => prev.filter((a) => a.id !== deleteTarget.id)); setDeleteTarget(null); }} />}
    </div>
  );
}

interface PendingUpload { file: File; name: string; notes: string; previewUrl: string; targets: ScreenTarget[]; }

function UploadModal({ onClose, onSave }: { onClose: () => void; onSave: (newAssets: EnvironmentAsset[]) => void; }) {
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['GLOBAL']));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { pending.forEach((p) => URL.revokeObjectURL(p.previewUrl)); }, [pending]);

  const addFiles = (files: FileList | File[]) => {
    const valid = Array.from(files).filter((file) => file.type.startsWith('image/') && ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && file.size <= 10 * 1024 * 1024);
    const next: PendingUpload[] = valid.map((file) => ({ file, name: file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim().toUpperCase(), notes: '', previewUrl: URL.createObjectURL(file), targets: [] }));
    setPending((current) => [...current, ...next]);
  };

  const removePending = (index: number) => setPending((current) => { URL.revokeObjectURL(current[index].previewUrl); return current.filter((_, i) => i !== index); });
  const updatePending = (index: number, changes: Partial<PendingUpload>) => setPending((current) => current.map((p, i) => i === index ? { ...p, ...changes } : p));
  const toggleTarget = (index: number, target: ScreenTarget) => updatePending(index, { targets: pending[index].targets.includes(target) ? pending[index].targets.filter((t) => t !== target) : [...pending[index].targets, target] });
  const toggleGroup = (group: string) => setOpenGroups((current) => { const next = new Set(current); if (next.has(group)) next.delete(group); else next.add(group); return next; });

  const handleSaveAll = () => {
    const newAssets: EnvironmentAsset[] = pending.map((item) => ({
      id: `draft-${crypto.randomUUID()}`, name: item.name.toUpperCase(), fileName: item.file.name, filePath: '', src: item.previewUrl, kind: 'image' as const, allowedScreens: item.targets, notes: item.notes, galleryVisibility: 'hidden',
    }));
    onSave(newAssets);
  };

  return (
    <div className="fixed inset-0 z-[450] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0a0c0e]/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#c0911e]/20 bg-[#0b0d0f] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0a0c0e]/40 px-5 py-4 backdrop-blur-md">
          <div>
            <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">Upload Images</div>
            <h2 className="mt-1 text-base font-semibold text-white">Add images to the library</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/50 hover:text-white"><X className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 px-5 py-4">
          {pending.length === 0 ? (
            <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }} onClick={() => inputRef.current?.click()} className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-all ${dragOver ? 'border-[#d4a52c] bg-[#d4a52c]/5' : 'border-white/15 hover:border-white/30'}`}>
              <Upload className="h-8 w-8 text-white/40" />
              <div className="mt-3 text-[12px] font-semibold text-white/70">Drag and drop images here</div>
              <div className="mt-1 text-[10px] text-white/40">or click to browse · PNG, JPG, WEBP · max 10MB</div>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((item, index) => (
                <div key={index} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex gap-4">
                    <img src={item.previewUrl} alt="" className="h-24 w-40 shrink-0 rounded-lg border border-white/10 object-cover" />
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="text-[8px] font-mono tracking-widest text-[#d4a52c] uppercase">Asset Name</label>
                        <input value={item.name} onChange={(e) => updatePending(index, { name: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-white outline-none focus:border-[#d4a52c]/60" />
                      </div>
                      <div>
                        <div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">File Name</div>
                        <div className="mt-0.5 truncate text-[10px] text-white/50">{item.file.name}</div>
                      </div>
                      <div>
                        <label className="text-[8px] font-mono tracking-widest text-[#d4a52c] uppercase">Internal Notes</label>
                        <input value={item.notes} onChange={(e) => updatePending(index, { notes: e.target.value })} placeholder="Optional..." className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] text-white outline-none placeholder:text-white/25 focus:border-[#d4a52c]/60" />
                      </div>
                    </div>
                    <button type="button" onClick={() => removePending(index)} className="h-fit rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/40 hover:text-red-300"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1.5 text-[8px] font-mono tracking-widest text-white/30 uppercase">Assign to (optional)</div>
                    <div className="space-y-1.5">
                      {SCREEN_TARGETS.map((group) => {
                        const isOpen = openGroups.has(group.group);
                        return (
                          <div key={group.group} className="rounded-md border border-white/[0.04]">
                            <button type="button" onClick={() => toggleGroup(group.group)} className="flex w-full items-center justify-between px-2.5 py-1.5 text-left">
                              <span className="text-[9px] font-bold tracking-widest text-white/50 uppercase">{group.label}</span>
                              <ChevronRight className={`h-3 w-3 text-white/30 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                            </button>
                            {isOpen && (
                              <div className="flex flex-wrap gap-1.5 px-2.5 pb-2">
                                {group.targets.map((target) => {
                                  const checked = item.targets.includes(target.id);
                                  return <button key={target.id} type="button" onClick={() => toggleTarget(index, target.id)} className={`rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase ${checked ? 'border-emerald-300/40 bg-emerald-300/15 text-emerald-200' : 'border-white/10 text-white/40 hover:text-white/70'}`}>{target.label}</button>;
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-3 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:border-white/30 hover:text-white/70"><Upload className="h-3.5 w-3.5" />Add More Images</button>
            </div>
          )}
        </div>
        <footer className="flex shrink-0 items-center justify-between border-t border-white/[0.06] px-5 py-4">
          <span className="text-[10px] font-mono tracking-widest text-white/30 uppercase">{pending.length} image{pending.length !== 1 ? 's' : ''} ready</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-bold tracking-widest text-white/60 uppercase hover:text-white">Cancel</button>
            <button type="button" disabled={pending.length === 0} onClick={handleSaveAll} className="rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/20 px-5 py-2.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:bg-[#d4a52c]/30 disabled:opacity-50">Add {pending.length > 0 ? `(${pending.length})` : ''}</button>
          </div>
        </footer>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); if (inputRef.current) inputRef.current.value = ''; }} />
      </div>
    </div>
  );
}

function DeleteConfirm({ asset, onCancel, onConfirm }: { asset: EnvironmentAsset; onCancel: () => void; onConfirm: () => void; }) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0a0c0e]/55 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border border-red-300/20 bg-[#0b0d0f] p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-300/30 bg-red-300/10"><AlertTriangle className="h-5 w-5 text-red-300" /></div>
          <div>
            <h3 className="text-base font-semibold text-white">Delete Image?</h3>
            <p className="text-[10px] font-mono tracking-widest text-red-300/60 uppercase">{asset.name}</p>
          </div>
        </div>
        <p className="mb-5 text-[11px] leading-relaxed text-white/60">This will remove this image from the Asset Manager and from all portal/background options. Click SAVE CHANGES to make the deletion permanent.</p>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-[10px] font-bold tracking-widest text-white/60 uppercase hover:text-white">Cancel</button>
          <button type="button" onClick={onConfirm} className="rounded-lg border border-red-300/40 bg-red-300/15 px-4 py-2.5 text-[10px] font-bold tracking-widest text-red-200 uppercase transition-all hover:bg-red-300/25">Delete Image</button>
        </div>
      </div>
    </div>
  );
}

// ── User Accounts (Real + Demo) ─────────────────────────────────

export function UserAccessSection({ onSelectedUserIdChange }: { onSelectedUserIdChange?: (userId: string | null) => void }) {
  const [tab, setTab] = useState<'real' | 'staff'>('real');
  const staff = useStaffAccounts();
  const login = useLoginActivity();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [loginPopoverOpen, setLoginPopoverOpen] = useState(false);
  const loginBtnRef = useRef<HTMLButtonElement>(null);
  const [loginPopoverPos, setLoginPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const selectUser = useCallback((userId: string) => {
    setSelectedAccountId(userId);
    onSelectedUserIdChange?.(userId);
  }, [onSelectedUserIdChange]);
  const [searchInput, setSearchInput] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
  const STAFF_ROLES = new Set(['staff', 'moderator', 'developer_admin']);

  const realUsers = useMemo(() => staff.accounts.filter((u) => !STAFF_ROLES.has(u.role) && u.role !== 'superuser'), [staff.accounts]);
  const staffUsers = useMemo(() => staff.accounts.filter((u) => STAFF_ROLES.has(u.role) || u.role === 'superuser'), [staff.accounts]);
  const selectedReal = (tab === 'staff' ? staffUsers : realUsers).find((u) => u.user_id === selectedAccountId) ?? null;

  const handleSearch = (term: string) => {
    setSearchInput(term);
    staff.search(term);
  };

  const handleSort = (mode: 'newest' | 'oldest' | 'alpha_az' | 'alpha_za') => {
    staff.sort(mode);
    setSortOpen(false);
  };

  const sortLabel = staff.currentSort === 'newest' ? 'Newest Signup' :
    staff.currentSort === 'oldest' ? 'Oldest Signup' :
    staff.currentSort === 'alpha_az' ? 'Name A-Z' : 'Name Z-A';

  const activeUsers = tab === 'staff' ? staffUsers : realUsers;

  const periodLabels: Record<LoginPeriod, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    '7days': '7 Days',
    '30days': '30 Days',
  };

  useEffect(() => {
    if (loginPopoverOpen && loginBtnRef.current) {
      const rect = loginBtnRef.current.getBoundingClientRect();
      const popoverWidth = 420;
      const margin = 8;
      const maxLeft = window.innerWidth - popoverWidth - margin;
      setLoginPopoverPos({ top: rect.bottom + 4, left: Math.max(margin, Math.min(rect.left, maxLeft)) });
    } else {
      setLoginPopoverPos(null);
    }
  }, [loginPopoverOpen]);

  useEffect(() => {
    if (!loginPopoverOpen) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setLoginPopoverOpen(false); };
    const handleScroll = () => {
      if (loginBtnRef.current) {
        const rect = loginBtnRef.current.getBoundingClientRect();
        const popoverWidth = 420;
        const margin = 8;
        const maxLeft = window.innerWidth - popoverWidth - margin;
        setLoginPopoverPos({ top: rect.bottom + 4, left: Math.max(margin, Math.min(rect.left, maxLeft)) });
      }
    };
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleScroll, true);
    return () => { window.removeEventListener('keydown', handleEscape); window.removeEventListener('scroll', handleScroll, true); };
  }, [loginPopoverOpen]);

  return (
    <div className="flex min-h-0 flex-col p-3 sm:p-4">
      {/* Unified USER MANAGEMENT header — Platform Users + Login Activity consolidated */}
      <div className="shrink-0 rounded-xl border border-[#c0911e]/15 bg-[#0a0c0e]/50 px-4 py-2.5 sm:px-5 sm:py-3 backdrop-blur-md">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[9px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">User Management · {staff.error ? 'ERROR' : `${realUsers.length} real`} · {staffUsers.length} staff</div>
              <h1 className="mt-0.5 text-lg font-semibold text-white">Platform Users</h1>
            </div>
            {/* Compact login activity summary — clickable to expand popover */}
            <button
              ref={loginBtnRef}
              type="button"
              onClick={() => setLoginPopoverOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] text-white/60 hover:border-[#d4a52c]/30 hover:text-white/80 transition"
            >
              <LogIn className="h-3.5 w-3.5 text-[#d4a52c]" />
              <span className="hidden sm:inline">
                {login.period === 'today' ? 'Today' : login.period === 'yesterday' ? 'Yesterday' : login.period === '7days' ? '7d' : '30d'}:
              </span>
              <span className="font-mono font-bold text-white">{login.counts?.authenticated_users ?? (login.loading ? '…' : 0)}</span>
              <span className="text-white/40">users</span>
              <span className="text-white/20">·</span>
              <span className="font-mono font-bold text-white">{login.counts?.total_login_events ?? (login.loading ? '…' : 0)}</span>
              <span className="text-white/40">logins</span>
              <ChevronDown className={`h-3 w-3 text-white/40 transition-transform ${loginPopoverOpen ? 'rotate-180' : ''}`} />
            </button>
            {/* Login period selectors */}
            <div className="hidden sm:flex items-center gap-0.5">
              {(['today', 'yesterday', '7days', '30days'] as LoginPeriod[]).map((p) => (
                <button key={p} type="button" onClick={() => login.setPeriod(p)} className={`rounded-md border px-1.5 py-0.5 text-[8px] font-bold tracking-widest uppercase transition ${login.period === p ? 'border-[#d4a52c]/50 bg-[#d4a52c]/10 text-[#f5e6b0]' : 'border-white/10 text-white/35 hover:text-white/60'}`}>
                  {periodLabels[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 sm:w-auto lg:w-64">
              <Search className="h-3.5 w-3.5 text-white/35" />
              <input value={searchInput} onChange={(e) => handleSearch(e.target.value)} placeholder="Search name or email..." className="w-full bg-transparent text-[11px] text-white outline-none placeholder:text-white/25" />
            </label>
            <div className="relative">
              <button type="button" onClick={() => setSortOpen((v) => !v)} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[9px] sm:text-[10px] font-bold tracking-widest text-white/60 uppercase hover:border-white/25">
                <span className="hidden sm:inline">Sort:</span> {sortLabel} <ChevronRight className={`h-3 w-3 transition-transform ${sortOpen ? 'rotate-90' : ''}`} />
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-white/10 bg-[#0b0d0f] p-1 shadow-xl">
                  {([['newest', 'Newest Signup'], ['oldest', 'Oldest Signup'], ['alpha_az', 'Name A-Z'], ['alpha_za', 'Name Z-A']] as const).map(([mode, label]) => (
                    <button key={mode} type="button" onClick={() => handleSort(mode)} className={`block w-full rounded-md px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider ${staff.currentSort === mode ? 'bg-[#d4a52c]/15 text-[#f5e6b0]' : 'text-white/50 hover:bg-white/5'}`}>{label}</button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={() => staff.refresh()} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[9px] sm:text-[10px] font-bold tracking-widest text-white/60 uppercase hover:border-white/25">
              <RefreshCw className="h-3.5 w-3.5" /><span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => { setTab('real'); selectUser(''); onSelectedUserIdChange?.(null); }} className={`rounded-lg border px-3 py-1.5 text-[9px] sm:text-[10px] font-bold tracking-widest uppercase transition ${tab === 'real' ? 'border-[#d4a52c]/60 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>Real Users ({staff.error ? 'ERROR' : realUsers.length})</button>
          <button type="button" onClick={() => { setTab('staff'); selectUser(''); onSelectedUserIdChange?.(null); }} className={`rounded-lg border px-3 py-1.5 text-[9px] sm:text-[10px] font-bold tracking-widest uppercase transition ${tab === 'staff' ? 'border-[#d4a52c]/60 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>Staff ({staffUsers.length})</button>
          {/* Mobile login period selectors */}
          <div className="flex sm:hidden items-center gap-0.5 ml-auto">
            {(['today', 'yesterday', '7days', '30days'] as LoginPeriod[]).map((p) => (
              <button key={p} type="button" onClick={() => login.setPeriod(p)} className={`rounded-md border px-1.5 py-0.5 text-[7px] font-bold tracking-widest uppercase transition ${login.period === p ? 'border-[#d4a52c]/50 bg-[#d4a52c]/10 text-[#f5e6b0]' : 'border-white/10 text-white/35'}`}>
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Login activity popover — portaled to document.body to escape stacking contexts */}
      {loginPopoverOpen && loginPopoverPos && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setLoginPopoverOpen(false)} />
          <div
            className="fixed z-[9999] w-[420px] max-w-[calc(100vw-16px)] max-h-[360px] overflow-y-auto rounded-lg border border-[#c0911e]/20 p-3 shadow-2xl backdrop-blur-md"
            style={{ top: loginPopoverPos.top, left: loginPopoverPos.left, background: 'linear-gradient(135deg, rgba(22,17,12,0.94), rgba(10,10,12,0.96))', boxShadow: '0 8px 28px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,224,166,0.06)' }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LogIn className="h-3.5 w-3.5 text-[#d4a52c]" />
                <span className="text-[10px] font-bold tracking-widest text-white/70 uppercase">Login Activity · {periodLabels[login.period]}</span>
              </div>
              <button type="button" onClick={() => setLoginPopoverOpen(false)} className="text-white/40 hover:text-white"><X className="h-3.5 w-3.5" /></button>
            </div>
            {login.error ? (
              <div className="flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-300/5 p-2 text-[10px] text-red-300">
                <AlertCircle className="h-3.5 w-3.5" /> {login.error}
              </div>
            ) : login.loading ? (
              <div className="py-4 text-center text-[10px] text-white/40">Loading...</div>
            ) : login.rows.length === 0 ? (
              <div className="py-4 text-center text-[10px] text-white/40">No login activity for this period.</div>
            ) : (
              <table className="w-full text-left">
                <thead className="border-b border-white/[0.06] text-[8px] font-mono tracking-widest text-white/30 uppercase">
                  <tr>
                    <th className="px-2 py-1">Name</th>
                    <th className="px-2 py-1 text-center">Logins</th>
                    <th className="px-2 py-1">Latest</th>
                    <th className="px-2 py-1">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {login.rows.slice(0, 12).map((r: LoginActivityRow) => (
                    <tr key={r.user_id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="px-2 py-1.5 text-[10px] font-semibold text-white">{r.display_name ?? r.email}</td>
                      <td className="px-2 py-1.5 text-center text-[10px] font-mono font-bold text-white">{r.login_count}</td>
                      <td className="px-2 py-1.5 text-[9px] text-white/50">{r.latest_login ? new Date(r.latest_login).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</td>
                      <td className="px-2 py-1.5 text-[9px] text-white/50">{r.device_type ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {login.rows.length > 12 && <div className="px-2 py-1 text-[8px] text-white/30">+{login.rows.length - 12} more...</div>}
          </div>
        </>,
        document.body
      )}

      {/* Two-column framed glass panels — user list | user details */}
      <div className="mt-3.5 grid min-h-0 flex-1 grid-cols-1 gap-3.5 lg:grid-cols-2">
        {/* LEFT: User list — framed glass panel */}
        <div className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#c0911e]/15 bg-[#08090b]/60 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md sv-staff-scroll ${selectedReal ? 'hidden lg:flex' : 'flex'} ${selectedAccountId && selectedReal ? 'lg:flex' : ''}`} style={{ boxShadow: '0 4px 20px -8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          {staff.loading ? (
            <div className="p-8 text-center text-[11px] text-white/40">Loading {tab === 'staff' ? 'staff' : 'real'} users...</div>
          ) : staff.error ? (
            <div className="p-6 text-center">
              <AlertTriangle className="mx-auto h-6 w-6 text-red-300" />
              <p className="mt-2 text-[11px] text-red-200 font-bold">{staff.error}</p>
              <p className="mt-1 text-[10px] text-red-200/50">
                {staff.error === 'SESSION INVALID' && 'Your session has expired. Please log out and sign back in.'}
                {staff.error === 'PERMISSION DENIED' && 'Your account does not have Staff authorization to view the account directory.'}
                {staff.error.startsWith('ACCOUNT DIRECTORY ERROR') && 'The account directory endpoint returned an error. See browser console for details.'}
                {staff.error.startsWith('NETWORK ERROR') && 'Unable to reach the account directory. Check your network connection.'}
                {staff.error.startsWith('UNKNOWN ERROR') && 'An unexpected error occurred while loading the account directory.'}
              </p>
              <button type="button" onClick={() => staff.refresh()} className="mt-3 rounded-lg border border-white/15 px-4 py-2 text-[10px] font-bold tracking-widest text-white/60 uppercase hover:border-white/30 hover:text-white/80">Retry</button>
            </div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:hidden sv-staff-scroll">
                {activeUsers.length === 0 ? (
                  <div className="p-6 text-center text-[11px] text-white/40">No {tab === 'staff' ? 'staff' : 'real'} users found.</div>
                ) : activeUsers.map((user) => (
                  <button key={user.user_id} onClick={() => selectUser(user.user_id)} className={`block w-full border-b border-white/[0.04] p-3 text-left transition ${user.user_id === selectedAccountId ? 'bg-[#d4a52c]/10' : 'hover:bg-white/[0.03]'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-semibold text-white">{user.display_name ?? '—'}</div>
                        {user.username && <div className="truncate text-[10px] text-white/40">@{user.username}</div>}
                        {user.sv_user_id && <div className="mt-0.5 text-[9px] font-mono font-bold tracking-wider text-[#d4a52c]/80">{user.sv_user_id}</div>}
                        <div className="mt-1 break-all text-[10px] text-white/55">{user.email ?? '—'}</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase ${user.status === 'active' ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-300' : user.status === 'banned' ? 'border-red-300/25 bg-red-300/10 text-red-300' : 'border-amber-300/25 bg-amber-300/10 text-amber-200'}`}>{user.status}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-[9px] font-bold tracking-widest text-[#d4a52c] uppercase">{user.role}</span>
                      <span className="text-[9px] font-bold tracking-widest text-emerald-300/70 uppercase">{user.membership_tier}</span>
                      {user.profile_complete === false && <span className="text-[8px] font-bold text-amber-400">PROFILE MISSING</span>}
                      <span className="text-[9px] text-white/30">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</span>
                    </div>
                  </button>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden min-h-0 flex-1 overflow-auto md:block sv-staff-scroll">
                <table className="w-full min-w-[500px] text-left">
                  <thead className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#08090b]/80 text-[9px] font-mono tracking-widest text-white/35 uppercase">
                    <tr>
                      {tab === 'staff' ? (
                        <><th className="px-4 py-3">Name</th><th className="px-4 py-3">SV ID</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Membership</th><th className="px-4 py-3">Status</th></>
                      ) : (
                        <><th className="px-4 py-3">Name</th><th className="px-4 py-3">SV ID</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Membership</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last Active</th></>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {activeUsers.length === 0 ? (
                      <tr><td colSpan={tab === 'staff' ? 6 : 7} className="px-4 py-8 text-center text-[11px] text-white/40">No {tab === 'staff' ? 'staff' : 'real'} users found.</td></tr>
                    ) : activeUsers.map((user) => (
                      <tr key={user.user_id} onClick={() => selectUser(user.user_id)} className={`cursor-pointer border-b border-white/[0.05] ${user.user_id === selectedAccountId ? 'bg-[#d4a52c]/10' : 'hover:bg-white/[0.03]'}`}>
                        <td className="px-4 py-3 text-[11px] font-semibold text-white">{user.display_name ?? '—'}{user.username && <span className="block text-[9px] font-normal text-white/40">@{user.username}</span>}{user.profile_complete === false && <span className="block text-[8px] font-bold text-amber-400">PROFILE MISSING</span>}</td>
                        <td className="px-4 py-3 text-[10px] font-mono font-bold tracking-wider text-[#d4a52c]/80">{user.sv_user_id ?? '—'}</td>
                        <td className="px-4 py-3 text-[10px] text-white/65">{user.email ?? '—'}</td>
                        <td className="px-4 py-3 text-[9px] font-bold tracking-widest text-[#d4a52c] uppercase">{user.role}{user.role === 'superuser' && <span className="block text-[8px] text-amber-400">FOUNDER</span>}</td>
                        <td className="px-4 py-3 text-[9px] font-bold tracking-widest text-emerald-300/70 uppercase">{user.membership_tier}</td>
                        <td className="px-4 py-3"><span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase ${user.status === 'active' ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-300' : user.status === 'banned' ? 'border-red-300/25 bg-red-300/10 text-red-300' : 'border-amber-300/25 bg-amber-300/10 text-amber-200'}`}>{user.status}</span></td>
                        {tab !== 'staff' && <td className="px-4 py-3 text-[10px] text-white/50">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* RIGHT: User details — framed glass panel */}
        <div className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#c0911e]/15 bg-[#08090b]/60 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md sv-staff-scroll ${selectedReal ? 'flex' : 'hidden lg:flex'}`} style={{ boxShadow: '0 4px 20px -8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          {selectedReal ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 sv-staff-scroll">
              {/* Mobile back button */}
              <button type="button" onClick={() => { selectUser(''); onSelectedUserIdChange?.(null); }} className="mb-3 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/60 transition hover:border-[#d4a52c]/30 hover:text-white lg:hidden">
                <ChevronLeft className="h-3.5 w-3.5" /> Back to Users
              </button>
              {/* Avatar + Name header */}
              <div className="flex items-center gap-3 border-b border-white/[0.06] pb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d4a52c]/30 bg-[#d4a52c]/10 text-[14px] font-bold text-[#f5e6b0]">
                  {(selectedReal.display_name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-white">{selectedReal.display_name ?? '—'}</div>
                  {selectedReal.username && <div className="truncate text-[11px] text-white/40">@{selectedReal.username}</div>}
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase ${selectedReal.status === 'active' ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-300' : selectedReal.status === 'banned' ? 'border-red-300/25 bg-red-300/10 text-red-300' : 'border-amber-300/25 bg-amber-300/10 text-amber-200'}`}>{selectedReal.status}</span>
                    <span className="text-[9px] font-bold tracking-widest text-[#d4a52c] uppercase">{selectedReal.role}</span>
                  </div>
                </div>
              </div>

              {/* Account summary */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <InfoBox label="Email" value={selectedReal.email ?? '—'} />
                <InfoBox label="SV User ID" value={selectedReal.sv_user_id ?? '—'} />
                <InfoBox label="Membership" value={selectedReal.membership_tier ?? '—'} />
                <InfoBox label="Role" value={selectedReal.role ?? '—'} />
                <InfoBox label="Account Created" value={selectedReal.created_at ? new Date(selectedReal.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'} />
                <InfoBox label="Last Sign In" value={selectedReal.last_sign_in_at ? new Date(selectedReal.last_sign_in_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'} />
                <InfoBox label="Profile Complete" value={selectedReal.profile_complete === false ? 'No' : 'Yes'} />
                <InfoBox label="User ID" value={selectedReal.user_id} />
              </div>

              {/* Account actions */}
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <div className="mb-2 text-[9px] font-mono tracking-widest text-white/30 uppercase">Account Actions</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[9px] font-bold tracking-widest text-white/50 uppercase transition hover:border-white/25 hover:text-white/80">
                    View Profile
                  </button>
                  <button type="button" className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[9px] font-bold tracking-widest text-white/50 uppercase transition hover:border-white/25 hover:text-white/80">
                    Copy User ID
                  </button>
                  <button type="button" className="rounded-lg border border-red-300/20 bg-red-300/5 px-3 py-2 text-[9px] font-bold tracking-widest text-red-300/70 uppercase transition hover:border-red-300/40 hover:text-red-300">
                    Suspend
                  </button>
                </div>
              </div>

              {/* Membership controls */}
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <div className="mb-2 text-[9px] font-mono tracking-widest text-white/30 uppercase">Membership Controls</div>
                <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/50">Current Tier</span>
                    <span className="text-[10px] font-bold tracking-widest text-emerald-300/70 uppercase">{selectedReal.membership_tier}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-white/50">Primary Role</span>
                    <span className="text-[10px] font-bold tracking-widest text-[#d4a52c] uppercase">{selectedReal.role}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
              <div>
                <Users className="mx-auto h-8 w-8 text-white/15" />
                <p className="mt-3 text-[11px] text-white/30">Select a user from the list to view their details.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function LoginActivitySection() {
  const { rows, counts, loading, error, period, setPeriod, refresh } = useLoginActivity();

  const periodLabels: Record<LoginPeriod, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    '7days': '7 Days',
    '30days': '30 Days',
  };

  return (
    <div className="rounded-none border-0 border-b border-white/[0.06] bg-[#0a0c0e]/30 p-3 backdrop-blur-md">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <LogIn className="h-3.5 w-3.5 text-[#d4a52c]" />
          <h2 className="text-[10px] font-bold tracking-widest text-white/60 uppercase">Login Activity</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Users</span>
              <span className="text-[14px] font-mono font-bold text-white">{counts?.authenticated_users ?? (loading ? '…' : 0)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Events</span>
              <span className="text-[14px] font-mono font-bold text-white">{counts?.total_login_events ?? (loading ? '…' : 0)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {(['today', 'yesterday', '7days', '30days'] as LoginPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase transition ${
                period === p
                  ? 'border-[#d4a52c]/60 bg-[#d4a52c]/15 text-[#f5e6b0]'
                  : 'border-white/10 text-white/40 hover:text-white/70'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
          <button type="button" onClick={refresh} className="ml-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white/40 hover:text-white/70" title="Refresh">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-300/5 p-2 text-[10px] text-red-300">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
          <button type="button" onClick={refresh} className="ml-auto rounded border border-white/15 px-1.5 py-0.5 text-[8px] font-bold uppercase text-white/60 hover:border-white/30">Retry</button>
        </div>
      )}

      {!error && !loading && rows.length > 0 && (
        <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-white/[0.04] bg-white/[0.01]">
          <table className="w-full min-w-[500px] text-left">
            <thead className="border-b border-white/[0.06] text-[8px] font-mono tracking-widest text-white/30 uppercase">
              <tr>
                <th className="px-2 py-1">Name</th>
                <th className="px-2 py-1 text-center">Logins</th>
                <th className="px-2 py-1">Latest</th>
                <th className="px-2 py-1">Device</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((r) => (
                <tr key={r.user_id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-2 py-1.5 text-[10px] font-semibold text-white">{r.display_name ?? r.email}</td>
                  <td className="px-2 py-1.5 text-center text-[10px] font-mono font-bold text-white">{r.login_count}</td>
                  <td className="px-2 py-1.5 text-[9px] text-white/50">{r.latest_login ? new Date(r.latest_login).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</td>
                  <td className="px-2 py-1.5 text-[9px] text-white/50">{r.device_type ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 8 && <div className="px-2 py-1 text-[8px] text-white/30">+{rows.length - 8} more...</div>}
        </div>
      )}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-2">
      <div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">{label}</div>
      <div className="mt-1 break-all text-[10px] font-semibold text-white">{value}</div>
    </div>
  );
}

// ── Booking Providers ──────────────────────────────────────────

const BOOKING_CATEGORY_OPTIONS = [
  { value: 'COACH', label: 'Coach' },
  { value: 'POKER_PRO', label: 'Poker Pro' },
  { value: 'CREATOR', label: 'Creator / Talent' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'INVESTOR', label: 'Investor' },
  { value: 'INDUSTRY_EXPERT', label: 'Industry Executive' },
  { value: 'OTHER', label: 'Other' },
];

export function BookingProvidersSection({ staffAccount }: { staffAccount: SpotVaultAccount }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SpotVaultAccount | null>(null);
  const [searched, setSearched] = useState(false);
  const [approvedProviders, setApprovedProviders] = useState<BookingProviderApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['COACH']);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await fetchAllApprovedProviders();
    setApprovedProviders(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSearch = async () => {
    setSearched(true);
    const q = searchQuery.trim().toLowerCase();
    if (!q) { setSearchResult(null); return; }
    // Search real user profiles from the database
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, display_name, username')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(1);
    if (profileError || !profileData || profileData.length === 0) {
      // Fallback: search by email in auth.users via the staff RPC
      const { data: authData } = await supabase.rpc('sv_staff_get_accounts', {
        p_search: searchQuery.trim(),
        p_sort: 'newest',
        p_limit: 1,
        p_offset: 0,
      });
      const acct = (authData as unknown as Array<{ user_id: string; display_name: string; username: string; email: string }>)?.[0];
      if (acct) {
        setSearchResult({ id: acct.user_id, name: acct.display_name, username: acct.username, email: acct.email } as { id: string; name: string; username: string; email: string } | null);
      } else {
        setSearchResult(null);
      }
    } else {
      const p = profileData[0];
      const { data: authData } = await supabase.rpc('sv_staff_get_accounts', {
        p_search: p.username || p.display_name || '',
        p_sort: 'newest',
        p_limit: 1,
        p_offset: 0,
      });
      const acct = (authData as unknown as Array<{ user_id: string; email: string }>)?.[0];
      setSearchResult({
        id: p.user_id,
        name: p.display_name ?? p.username,
        username: p.username ?? 'unknown',
        email: acct?.email ?? '',
      });
    }
  };

  const handleEnable = async () => {
    if (!searchResult) return;
    setActionLoading(true);
    await approveProvider(searchResult.id, searchResult.name, searchResult.username, searchResult.email, selectedCategories, staffAccount.username);
    setActionLoading(false);
    setSearchResult(null);
    setSearchQuery('');
    setSearched(false);
    load();
  };

  const handleRemove = async (accountId: string) => {
    setActionLoading(true);
    await revokeProviderApproval(accountId);
    setActionLoading(false);
    load();
  };

  const toggleCategory = (cat: string) => setSelectedCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/[0.06] bg-[#0a0c0e]/40 px-4 py-3 sm:px-5 sm:py-4 backdrop-blur-md">
        <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">Booking Marketplace · Provider Authorization</div>
        <h1 className="mt-1 text-xl font-semibold text-white">Booking Providers</h1>
        <p className="mt-1 text-[11px] text-white/40">Approve who can offer their time through SpotVault.</p>
      </div>
      <div className="flex-1 p-3 sm:p-5">
        <div className="mb-4">
          <label className="text-[9px] font-mono tracking-widest text-[#d4a52c] uppercase">Username or Email</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }} placeholder="Search by username, name, or email..." className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-[12px] text-white outline-none focus:border-[#d4a52c]/60 placeholder:text-white/25" />
            </div>
            <button type="button" onClick={handleSearch} className="rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/15 px-5 py-2.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:bg-[#d4a52c]/25">Search</button>
          </div>
          {searched && searchResult && (
            <div className="mt-4 rounded-xl border border-[#c0911e]/20 bg-[#0c0e10] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold text-white">{searchResult.name}</div>
                  {searchResult.email && <div className="mt-0.5 text-[11px] text-white/50">{searchResult.email}</div>}
                  <div className="mt-0.5 text-[10px] font-mono tracking-widest text-white/40 uppercase">Username: {searchResult.username}</div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#c0911e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-sm font-bold text-[#d4a52c]">{searchResult.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
              </div>
              <div className="mt-4">
                <label className="text-[9px] font-mono tracking-widest text-white/40 uppercase">Provider Category</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BOOKING_CATEGORY_OPTIONS.map((c) => (
                    <button key={c.value} type="button" onClick={() => toggleCategory(c.value)} className={`rounded-md border px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase transition-all ${selectedCategories.includes(c.value) ? 'border-[#c0911e]/40 bg-[#c0911e]/15 text-[#f5e6b0]' : 'border-white/10 bg-white/[0.03] text-white/40 hover:border-white/25'}`}>{c.label}</button>
                  ))}
                </div>
              </div>
              {approvedProviders.some((p) => p.account_id === searchResult.id && p.status === 'active') ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  <span className="text-[11px] font-semibold text-emerald-300">Already approved as a booking provider.</span>
                </div>
              ) : (
                <button type="button" onClick={handleEnable} disabled={actionLoading || selectedCategories.length === 0} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#c0911e]/50 bg-gradient-to-b from-[#c0911e]/20 to-[#835e17]/20 py-3 text-[11px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:from-[#c0911e]/30 hover:to-[#835e17]/30 disabled:opacity-50">
                  <ShieldCheck className="h-4 w-4" />{actionLoading ? 'Enabling...' : 'Enable Booking Provider'}
                </button>
              )}
            </div>
          )}
          {searched && !searchResult && <div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center text-[11px] text-white/40">No user found matching "{searchQuery}".</div>}
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-bold tracking-[0.25em] text-white/50 uppercase">Currently Approved Providers</h2>
            <span className="text-[9px] font-mono tracking-widest text-white/30 uppercase">{approvedProviders.filter((p) => p.status === 'active').length} active</span>
          </div>
          {loading ? (
            <div className="py-8 text-center text-[11px] text-white/30">Loading...</div>
          ) : approvedProviders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-[11px] text-white/40">No booking providers approved yet.</div>
          ) : (
            <div className="space-y-2">
              {approvedProviders.map((p) => (
                <div key={p.id} className={`flex items-center justify-between rounded-lg border p-3 ${p.status === 'active' ? 'border-white/[0.08] bg-white/[0.025]' : 'border-white/[0.05] bg-white/[0.01] opacity-60'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#c0911e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-[11px] font-bold text-[#d4a52c]">{p.display_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                    <div>
                      <div className="text-[12px] font-bold text-white">{p.display_name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-white/40">
                        {p.username && <span>@{p.username}</span>}
                        {p.email && <span>· {p.email}</span>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        {p.categories.map((c) => <span key={c} className="rounded-full border border-[#c0911e]/20 bg-[#c0911e]/10 px-2 py-0.5 text-[8px] font-bold tracking-wider text-[#d4a52c] uppercase">{c.replace(/_/g, ' ')}</span>)}
                        <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase ${p.status === 'active' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-300' : 'border-red-300/20 bg-red-300/10 text-red-300'}`}>{p.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[9px] font-mono tracking-widest text-white/30 uppercase">Approved</div>
                      <div className="text-[10px] text-white/50">{new Date(p.approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                    {p.status === 'active' && <button type="button" onClick={() => handleRemove(p.account_id)} disabled={actionLoading} className="flex items-center gap-1 rounded-lg border border-red-300/20 bg-red-300/5 px-3 py-2 text-[9px] font-bold tracking-widest text-red-200 uppercase transition-all hover:border-red-300/40 hover:bg-red-300/10 disabled:opacity-50"><X className="h-3 w-3" />Remove</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Community Verification ──────────────────────────────────────

export function CommunityVerificationSection({ staffAccount }: { staffAccount: SpotVaultAccount }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/[0.06] bg-[#0a0c0e]/40 px-5 py-4 backdrop-blur-md">
        <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">Community Verification</div>
        <h1 className="mt-1 text-xl font-semibold text-white">Verification Queue</h1>
        <p className="mt-1 text-[11px] text-white/40">Review and approve community verification submissions.</p>
      </div>
      <div className="flex-1 p-5">
        <StaffVerificationQueue staffId={staffAccount.id} />
      </div>
    </div>
  );
}

// ── Access & Approvals (Role Requests) ──────────────────────────

type ApprovalTab = 'pending' | 'approved' | 'rejected' | 'revoked' | 'audit' | 'feed-pending' | 'feed-approved' | 'feed-revoked';

export function AccessApprovalsSection({ staffAccount }: { staffAccount: SpotVaultAccount }) {
  const [tab, setTab] = useState<ApprovalTab>('pending');
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [staffNote, setStaffNote] = useState<Record<string, string>>({});
  const [testWelcomeSending, setTestWelcomeSending] = useState(false);
  const [testWelcomeSent, setTestWelcomeSent] = useState(false);
  const roleRequestUserIds = requests.map((r) => r.user_id);
  const userNames = useUserNames(roleRequestUserIds);

  const load = async () => {
    setLoading(true);
    const data = tab === 'pending' ? await getPendingRoleRequests() : await getAllRoleRequests();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const handleReview = async (requestId: string, decision: 'approved' | 'rejected') => {
    setActionLoading(requestId);
    const note = staffNote[requestId] ?? '';
    await reviewRoleRequest(requestId, decision, note || undefined);
    setActionLoading(null);
    setStaffNote((prev) => { const next = { ...prev }; delete next[requestId]; return next; });
    load();
  };

  const handleRevoke = async (requestId: string) => {
    setActionLoading(requestId);
    await revokeRoleRequest(requestId);
    setActionLoading(null);
    load();
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const handleSendTestWelcome = async () => {
    setTestWelcomeSending(true);
    const id = await sendSystemMessage(staffAccount.id, 'test_welcome_' + Date.now(), 'Test Welcome Message', 'This is a test welcome message from SpotVault.', { test: true });
    setTestWelcomeSending(false);
    if (id) { setTestWelcomeSent(true); window.setTimeout(() => setTestWelcomeSent(false), 3000); }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] bg-[#0a0c0e]/40 px-5 py-4 backdrop-blur-md">
        <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">Role &amp; Portal Access</div>
        <h1 className="mt-1 text-xl font-semibold text-white">Access &amp; Approvals</h1>
        <p className="mt-1 text-[11px] text-white/40">Review and approve privileged role requests.</p>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" disabled={testWelcomeSending} onClick={handleSendTestWelcome} className="flex items-center gap-1.5 rounded-lg border border-[#c0911e]/30 bg-[#c091e]/10 px-3 py-1.5 text-[9px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c091e]/20 disabled:opacity-50">
            {testWelcomeSent ? <Check className="h-3 w-3 text-emerald-300" /> : <Mail className="h-3 w-3" />}
            {testWelcomeSent ? 'Sent' : testWelcomeSending ? 'Sending...' : 'Send Test Welcome Message'}
          </button>
        </div>
        {pendingCount > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2">
            <Clock className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[11px] font-semibold text-amber-200">{pendingCount} pending request{pendingCount !== 1 ? 's' : ''} awaiting review</span>
          </div>
        )}
      </div>
      <div className="flex gap-1.5 border-b border-white/[0.06] bg-[#0a0c0e]/30 px-5 py-2 backdrop-blur-md">
        {(['pending', 'approved', 'rejected', 'revoked', 'feed-pending', 'feed-approved', 'feed-revoked', 'audit'] as ApprovalTab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase transition ${tab === t ? 'border-[#d4a52c]/60 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
            {t === 'audit' ? 'Audit Log' : t === 'feed-pending' ? 'Feed Posting' : t === 'feed-approved' ? 'Feed Active' : t === 'feed-revoked' ? 'Feed Revoked' : t}
          </button>
        ))}
      </div>
      <div className="flex-1 p-5">
        <div className="rounded-xl border border-[#c0911e]/15 bg-[#0a0c0e]/40 p-4 backdrop-blur-md">
        {loading ? (
          <div className="py-8 text-center text-[11px] text-white/30">Loading...</div>
        ) : tab === 'audit' ? (
          <AuditLogView />
        ) : tab.startsWith('feed-') ? (
          <FeedPostingQueue tab={tab} />
        ) : requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-[11px] text-white/40">No {tab} role requests.</div>
        ) : (
          <div className="space-y-3">
            {requests.filter((r) => tab === 'pending' ? r.status === 'pending' : r.status === tab).map((req) => {
              const userInfo = userNames[req.user_id];
              const displayName = userInfo?.display_name ?? req.user_id.slice(0, 8);
              const username = userInfo?.username ?? 'unknown';
              const roleLabel = ROLE_LABELS[req.role as RoleType] ?? req.role;
              const isLoading = actionLoading === req.id;
              return (
                <div key={req.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#c0911e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-[11px] font-bold text-[#d4a52c]">{displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                      <div>
                        <div className="text-[13px] font-bold text-white">{displayName}</div>
                        <div className="text-[10px] text-white/40">@{username}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-mono tracking-widest text-white/30 uppercase">Requested</div>
                      <div className="text-[10px] text-white/50">{new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-full border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-1 text-[10px] font-bold tracking-wider text-[#d4a52c] uppercase">{roleLabel}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase ${req.status === 'pending' ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : req.status === 'approved' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-300' : req.status === 'rejected' ? 'border-red-300/30 bg-red-300/10 text-red-300' : 'border-white/20 bg-white/5 text-white/50'}`}>{req.status}</span>
                  </div>
                  {req.note && <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">User note</div><p className="mt-1 text-[11px] leading-relaxed text-white/60">{req.note}</p></div>}
                  {req.staff_note && <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Staff note</div><p className="mt-1 text-[11px] leading-relaxed text-white/50">{req.staff_note}</p></div>}
                  {req.status === 'pending' && (
                    <div className="mt-3">
                      <input value={staffNote[req.id] ?? ''} onChange={(e) => setStaffNote((prev) => ({ ...prev, [req.id]: e.target.value }))} placeholder="Staff note (optional)..." className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#d4a52c]/40" />
                      <div className="mt-2 flex gap-2">
                        <button type="button" disabled={isLoading} onClick={() => handleReview(req.id, 'approved')} className="flex items-center gap-1.5 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-4 py-2.5 text-[10px] font-bold tracking-widest text-emerald-300 uppercase transition hover:bg-emerald-300/20 disabled:opacity-50"><Check className="h-3.5 w-3.5" />{isLoading ? 'Processing...' : 'Approve'}</button>
                        <button type="button" disabled={isLoading} onClick={() => handleReview(req.id, 'rejected')} className="flex items-center gap-1.5 rounded-lg border border-red-300/20 bg-red-300/5 px-4 py-2.5 text-[10px] font-bold tracking-widest text-red-300 uppercase transition hover:bg-red-300/10 disabled:opacity-50"><X className="h-3.5 w-3.5" />Reject</button>
                      </div>
                    </div>
                  )}
                  {req.status === 'approved' && (
                    <div className="mt-3">
                      <button type="button" disabled={isLoading} onClick={() => handleRevoke(req.id)} className="flex items-center gap-1.5 rounded-lg border border-red-300/20 bg-red-300/5 px-4 py-2 text-[9px] font-bold tracking-widest text-red-300 uppercase transition hover:bg-red-300/10 disabled:opacity-50"><Shield className="h-3 w-3" />{isLoading ? 'Revoking...' : 'Revoke Access'}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function AuditLogView() {
  const [events, setEvents] = useState<Array<{ id: string; actor_id: string; action: string; target_user_id: string | null; metadata: Record<string, unknown>; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const auditUserIds = events.flatMap((e) => [e.actor_id, e.target_user_id].filter(Boolean) as string[]);
  const auditNames = useUserNames(auditUserIds);

  useEffect(() => {
    (async () => {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase.from('sv_access_audit_log').select('id, actor_id, action, target_user_id, metadata, created_at').order('created_at', { ascending: false }).limit(100);
      if (!error) setEvents(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="py-8 text-center text-[11px] text-white/30">Loading audit log...</div>;
  if (events.length === 0) return <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-[11px] text-white/40">No audit events recorded yet.</div>;

  return (
    <div className="space-y-1.5">
      {events.map((evt) => {
        const actor = auditNames[evt.actor_id];
        const target = evt.target_user_id ? auditNames[evt.target_user_id] : null;
        return (
          <div key={evt.id} className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d4a52c]/60" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-white">{evt.action.replace(/_/g, ' ')}</span>
                <span className="text-[9px] font-mono text-white/30">{new Date(evt.created_at).toLocaleString()}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-white/40">Actor: {actor?.display_name ?? evt.actor_id.slice(0, 8)}{target && <> · Target: {target.display_name}</>}</div>
              {evt.metadata && Object.keys(evt.metadata).length > 0 && <div className="mt-1 text-[9px] font-mono text-white/25">{JSON.stringify(evt.metadata)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeedPostingQueue({ tab }: { tab: ApprovalTab }) {
  const [requests, setRequests] = useState<FeedPostingRequest[]>([]);
  const feedUserIds = requests.map((r) => r.user_id);
  const feedUserNames = useUserNames(feedUserIds);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [staffNote, setStaffNote] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const data = tab === 'feed-pending' ? await getPendingFeedPostingRequests() : await getAllFeedPostingRequests();
    setRequests(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId);
    const note = staffNote[requestId] ?? '';
    await approveFeedPosting(requestId, note || undefined);
    setActionLoading(null);
    setStaffNote((prev) => { const next = { ...prev }; delete next[requestId]; return next; });
    load();
  };

  const handleReject = async (requestId: string) => {
    setActionLoading(requestId);
    const note = staffNote[requestId] ?? '';
    await rejectFeedPosting(requestId, note || undefined);
    setActionLoading(null);
    setStaffNote((prev) => { const next = { ...prev }; delete next[requestId]; return next; });
    load();
  };

  const handleRevoke = async (requestId: string) => {
    setActionLoading(requestId);
    await revokeFeedPosting(requestId);
    setActionLoading(null);
    load();
  };

  const filtered = requests.filter((r) => {
    if (tab === 'feed-pending') return r.status === 'pending';
    if (tab === 'feed-approved') return r.status === 'approved';
    if (tab === 'feed-revoked') return r.status === 'revoked' || r.status === 'rejected';
    return true;
  });

  if (loading) return <div className="py-8 text-center text-[11px] text-white/30">Loading...</div>;
  if (filtered.length === 0) return <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-[11px] text-white/40">No {tab.replace('feed-', '')} feed posting requests.</div>;

  return (
    <div className="space-y-3">
      {filtered.map((req) => {
        const userInfo = feedUserNames[req.user_id];
        const displayName = userInfo?.display_name ?? req.user_id.slice(0, 8);
        const username = userInfo?.username ?? 'unknown';
        const isLoading = actionLoading === req.id;
        return (
          <div key={req.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#c0911e]/30 bg-gradient-to-b from-[#2a2010] to-[#1a1408] text-[11px] font-bold text-[#d4a52c]">{displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                <div>
                  <div className="text-[13px] font-bold text-white">{displayName}</div>
                  <div className="text-[10px] text-white/40">@{username}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] font-mono tracking-widest text-white/30 uppercase">Requested</div>
                <div className="text-[10px] text-white/50">{new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {req.category && <span className="rounded-full border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-1 text-[10px] font-bold tracking-wider text-[#d4a52c] uppercase">{req.category}</span>}
              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase ${req.status === 'pending' ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : req.status === 'approved' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-300' : req.status === 'rejected' ? 'border-red-300/30 bg-red-300/10 text-red-300' : 'border-white/20 bg-white/5 text-white/50'}`}>{req.status}</span>
            </div>
            {req.reason && <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Reason</div><p className="mt-1 text-[11px] leading-relaxed text-white/60">{req.reason}</p></div>}
            {req.staff_note && <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Staff note</div><p className="mt-1 text-[11px] leading-relaxed text-white/50">{req.staff_note}</p></div>}
            {req.status === 'pending' && (
              <div className="mt-3">
                <input value={staffNote[req.id] ?? ''} onChange={(e) => setStaffNote((prev) => ({ ...prev, [req.id]: e.target.value }))} placeholder="Staff note (optional)..." className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#d4a52c]/40" />
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={isLoading} onClick={() => handleApprove(req.id)} className="flex items-center gap-1.5 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-4 py-2.5 text-[10px] font-bold tracking-widest text-emerald-300 uppercase transition hover:bg-emerald-300/20 disabled:opacity-50"><Check className="h-3.5 w-3.5" />{isLoading ? 'Processing...' : 'Approve'}</button>
                  <button type="button" disabled={isLoading} onClick={() => handleReject(req.id)} className="flex items-center gap-1.5 rounded-lg border border-red-300/20 bg-red-300/5 px-4 py-2.5 text-[10px] font-bold tracking-widest text-red-300 uppercase transition hover:bg-red-300/10 disabled:opacity-50"><X className="h-3.5 w-3.5" />Reject</button>
                </div>
              </div>
            )}
            {req.status === 'approved' && (
              <div className="mt-3">
                <button type="button" disabled={isLoading} onClick={() => handleRevoke(req.id)} className="flex items-center gap-1.5 rounded-lg border border-red-300/20 bg-red-300/5 px-4 py-2 text-[9px] font-bold tracking-widest text-red-300 uppercase transition hover:bg-red-300/10 disabled:opacity-50"><Shield className="h-3 w-3" />{isLoading ? 'Revoking...' : 'Revoke Posting Access'}</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Network Posting Approvals (Info Feed) ──────────────────────

const NETWORK_CATEGORIES = ['Player', 'Creator', 'Streamer', 'Coach', 'Industry', 'Operator', 'Partner', 'Media', 'Organization'];

export function NetworkPostingApprovalsSection({ staffAccount }: { staffAccount: SpotVaultAccount }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NetworkUserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [approvals, setApprovals] = useState<NetworkPostingApproval[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Player');

  const loadApprovals = useCallback(async () => {
    setLoadingApprovals(true);
    const data = await getNetworkPostingApprovals();
    setApprovals(data);
    setLoadingApprovals(false);
  }, []);

  useEffect(() => { loadApprovals(); }, [loadApprovals]);

  const doSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const results = await searchUsersForNetworkApproval(query.trim());
    setSearchResults(results);
    setSearching(false);
  }, []);

  const handleGrant = async (userId: string) => {
    setActioning(userId);
    await grantNetworkPosting(userId, selectedCategory);
    setActioning(null);
    await doSearch(searchQuery);
    await loadApprovals();
  };

  const handleRevoke = async (userId: string) => {
    setActioning(userId);
    await revokeNetworkPosting(userId);
    setActioning(null);
    await doSearch(searchQuery);
    await loadApprovals();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/[0.06] bg-[#0a0c0e]/40 px-5 py-4 backdrop-blur-md">
        <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">Info Feed · SpotVault</div>
        <h1 className="mt-1 text-xl font-semibold text-white">Info Feed Posting Access</h1>
        <p className="mt-1 text-[11px] text-white/40">Approve or revoke which accounts can post to the Info Feed.</p>
      </div>
      <div className="flex-1 p-5">
        <div className="mb-4">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-white/35" />
            <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); doSearch(e.target.value); }} placeholder="Search by name or username..." className="w-full bg-transparent text-[11px] text-white outline-none placeholder:text-white/25" />
          </label>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[9px] font-bold tracking-widest text-white/30 uppercase">Category:</span>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-[#d4a52c]/50">
              {NETWORK_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
        {searching && <p className="text-[10px] text-white/30">Searching...</p>}
        {!searching && searchResults.length > 0 && (
          <div className="mb-4 space-y-1.5">
            <div className="text-[9px] font-bold tracking-widest text-white/30 uppercase">Search Results</div>
            {searchResults.map((user) => (
              <div key={user.user_id} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold text-white">{user.display_name}</p>
                  <p className="text-[9px] text-white/40">@{user.username} · {user.poker_role || 'player'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {user.is_approved ? <span className="text-[9px] font-bold text-emerald-300">Approved</span> : user.has_membership ? <span className="text-[9px] text-[#d4a52c]/60">Member</span> : null}
                  {user.is_approved ? (
                    <button onClick={() => handleRevoke(user.user_id)} disabled={actioning === user.user_id} className="rounded-lg border border-red-300/20 bg-red-300/5 px-2.5 py-1.5 text-[9px] font-bold tracking-widest text-red-200 uppercase hover:bg-red-300/10 disabled:opacity-50">Revoke</button>
                  ) : (
                    <button onClick={() => handleGrant(user.user_id)} disabled={actioning === user.user_id} className="rounded-lg border border-[#d4a52c]/40 bg-[#d4a52c]/15 px-2.5 py-1.5 text-[9px] font-bold tracking-widest text-[#f5e6b0] uppercase hover:bg-[#d4a52c]/25 disabled:opacity-50">Approve</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div>
          <div className="mb-2 text-[9px] font-bold tracking-widest text-white/30 uppercase">Currently Approved ({approvals.filter(a => a.status === 'active').length})</div>
          {loadingApprovals ? (
            <p className="text-[10px] text-white/30">Loading...</p>
          ) : approvals.length === 0 ? (
            <p className="text-[10px] text-white/30">No network posting approvals yet.</p>
          ) : (
            <div className="space-y-1.5">
              {approvals.filter(a => a.status === 'active').map((approval) => (
                <div key={approval.user_id} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-bold text-white">{approval.user_id.slice(0, 8)}...</p>
                    <p className="text-[9px] text-white/40">Approved {new Date(approval.granted_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => handleRevoke(approval.user_id)} disabled={actioning === approval.user_id} className="rounded-lg border border-red-300/20 bg-red-300/5 px-2.5 py-1.5 text-[9px] font-bold tracking-widest text-red-200 uppercase hover:bg-red-300/10 disabled:opacity-50">Revoke</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Creator Approvals ───────────────────────────────────────────

import {
  getPendingApplications, getAllApplications, reviewApplication, getAllPermissions, revokePermission,
  type CreatorApplication,
} from '@/lib/creatorStore';

export function CreatorApprovalsSection({ staffAccount }: { staffAccount: SpotVaultAccount }) {
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'permissions'>('pending');
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [permissions, setPermissions] = useState<Array<{ user_id: string; can_publish_video_spots: boolean; can_create_multispot: boolean; granted_at: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [staffNote, setStaffNote] = useState<Record<string, string>>({});
  const [grantVideo, setGrantVideo] = useState<Record<string, boolean>>({});
  const [grantMultispot, setGrantMultispot] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    if (tab === 'permissions') {
      const perms = await getAllPermissions();
      setPermissions(perms);
    } else {
      const data = tab === 'pending' ? await getPendingApplications() : await getAllApplications();
      setApplications(data);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const handleReview = async (applicationId: string, decision: 'approved' | 'rejected' | 'info_requested') => {
    setActionLoading(applicationId);
    const note = staffNote[applicationId] ?? '';
    const gv = grantVideo[applicationId] ?? false;
    const gm = grantMultispot[applicationId] ?? false;
    await reviewApplication(applicationId, decision, note, gv, gm, staffAccount.id);
    setActionLoading(null);
    setStaffNote((prev) => { const n = { ...prev }; delete n[applicationId]; return n; });
    setGrantVideo((prev) => { const n = { ...prev }; delete n[applicationId]; return n; });
    setGrantMultispot((prev) => { const n = { ...prev }; delete n[applicationId]; return n; });
    setReviewing(null);
    load();
  };

  const handleRevoke = async (userId: string, revokeVideo: boolean, revokeMultispot: boolean) => {
    setActionLoading(userId);
    await revokePermission(userId, revokeVideo, revokeMultispot);
    setActionLoading(null);
    load();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] bg-[#0a0c0e]/40 px-5 py-4 backdrop-blur-md">
        <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">Creator Approvals</div>
        <h1 className="mt-1 text-xl font-semibold text-white">Content Creator Applications</h1>
        <p className="mt-1 text-[11px] text-white/40">Review and approve users requesting video spot and multi-spot analysis publishing permissions.</p>
      </div>
      <div className="flex gap-1.5 border-b border-white/[0.06] bg-[#0a0c0e]/30 px-5 py-2 backdrop-blur-md">
        {(['pending', 'approved', 'rejected', 'permissions'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[9px] font-bold tracking-widest uppercase transition ${tab === t ? 'border-[#d4a52c]/60 bg-[#d4a52c]/15 text-[#f5e6b0]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
            {t === 'permissions' ? 'Permissions' : t}
          </button>
        ))}
      </div>
      <div className="flex-1 p-5">
        <div className="rounded-xl border border-[#c0911e]/15 bg-[#0a0c0e]/40 p-4 backdrop-blur-md">
          {loading ? (
            <div className="py-8 text-center text-[11px] text-white/30">Loading...</div>
          ) : tab === 'permissions' ? (
            permissions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-[11px] text-white/40">No creator permissions granted yet.</div>
            ) : (
              <div className="space-y-3">
                {permissions.map((perm) => (
                  <div key={perm.user_id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[12px] font-bold text-white">{perm.user_id.slice(0, 8)}...</div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase ${perm.can_publish_video_spots ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-300' : 'border-white/10 text-white/30'}`}>
                            Video Spots: {perm.can_publish_video_spots ? 'Approved' : 'Not Approved'}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase ${perm.can_create_multispot ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-300' : 'border-white/10 text-white/30'}`}>
                            Multi-Spot: {perm.can_create_multispot ? 'Approved' : 'Not Approved'}
                          </span>
                        </div>
                      </div>
                      {(perm.can_publish_video_spots || perm.can_create_multispot) && (
                        <button
                          type="button"
                          disabled={actionLoading === perm.user_id}
                          onClick={() => handleRevoke(perm.user_id, perm.can_publish_video_spots, perm.can_create_multispot)}
                          className="flex items-center gap-1.5 rounded-lg border border-red-300/20 bg-red-300/5 px-3 py-2 text-[9px] font-bold tracking-widest text-red-300 uppercase transition hover:bg-red-300/10 disabled:opacity-50"
                        >
                          <Shield className="h-3 w-3" /> Revoke All
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : applications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-[11px] text-white/40">No {tab} creator applications.</div>
          ) : (
            <div className="space-y-3">
              {applications.filter((a) => tab === 'pending' ? a.status === 'pending' : a.status === tab).map((app) => (
                <div key={app.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-bold text-white">{app.real_name || app.user_id.slice(0, 8)}</div>
                      <div className="text-[10px] text-white/40">User ID: {app.user_id.slice(0, 8)}...</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-mono tracking-widest text-white/30 uppercase">Applied</div>
                      <div className="text-[10px] text-white/50">{new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-full border border-[#c0911e]/30 bg-[#c0911e]/10 px-3 py-1 text-[10px] font-bold tracking-wider text-[#d4a52c] uppercase">
                      {app.application_type === 'video_spot' ? 'Video Spots' : app.application_type === 'multispot' ? 'Multi-Spot' : 'Both'}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase ${app.status === 'pending' ? 'border-amber-300/30 bg-amber-300/10 text-amber-200' : app.status === 'approved' ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-300' : 'border-red-300/30 bg-red-300/10 text-red-300'}`}>
                      {app.status}
                    </span>
                  </div>
                  {(app.poker_screen_names || app.main_poker_sites || gameType(app)) && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                      {app.poker_screen_names && <div><span className="text-white/30">Screen names:</span> <span className="text-white/60">{app.poker_screen_names}</span></div>}
                      {app.main_poker_sites && <div><span className="text-white/30">Sites:</span> <span className="text-white/60">{app.main_poker_sites}</span></div>}
                      {app.game_type && <div><span className="text-white/30">Game:</span> <span className="text-white/60">{app.game_type}</span></div>}
                      {app.stakes_abi && <div><span className="text-white/30">Stakes:</span> <span className="text-white/60">{app.stakes_abi}</span></div>}
                    </div>
                  )}
                  {app.documented_results && <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Results</div><p className="mt-1 text-[11px] leading-relaxed text-white/60">{app.documented_results}</p></div>}
                  {app.public_profile_links && <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Profile Links</div><p className="mt-1 text-[11px] leading-relaxed text-white/60">{app.public_profile_links}</p></div>}
                  {app.intended_content && <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Intended Content</div><p className="mt-1 text-[11px] leading-relaxed text-white/60">{app.intended_content}</p></div>}
                  {app.attachment_urls && app.attachment_urls.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-white/40">
                      <BadgeCheck className="h-3.5 w-3.5 text-[#d4a52c]/60" /> {app.attachment_urls.length} attachment(s)
                    </div>
                  )}
                  {app.staff_notes && <div className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"><div className="text-[8px] font-mono tracking-widest text-white/30 uppercase">Staff Notes</div><p className="mt-1 text-[11px] leading-relaxed text-white/50">{app.staff_notes}</p></div>}

                  {app.status === 'pending' && (
                    <div className="mt-3">
                      {reviewing === app.id ? (
                        <div className="space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-[11px] text-white/70">
                              <input type="checkbox" checked={grantVideo[app.id] ?? app.application_type !== 'multispot'} onChange={(e) => setGrantVideo((p) => ({ ...p, [app.id]: e.target.checked }))} className="accent-[#d4a52c]" />
                              Grant Video Spots
                            </label>
                            <label className="flex items-center gap-2 text-[11px] text-white/70">
                              <input type="checkbox" checked={grantMultispot[app.id] ?? app.application_type !== 'video_spot'} onChange={(e) => setGrantMultispot((p) => ({ ...p, [app.id]: e.target.checked }))} className="accent-[#d4a52c]" />
                              Grant Multi-Spot
                            </label>
                          </div>
                          <input value={staffNote[app.id] ?? ''} onChange={(e) => setStaffNote((p) => ({ ...p, [app.id]: e.target.value }))} placeholder="Staff note (optional)..." className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] text-white outline-none placeholder:text-white/25 focus:border-[#d4a52c]/40" />
                          <div className="flex gap-2">
                            <button type="button" disabled={actionLoading === app.id} onClick={() => handleReview(app.id, 'approved')} className="flex items-center gap-1.5 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-4 py-2.5 text-[10px] font-bold tracking-widest text-emerald-300 uppercase transition hover:bg-emerald-300/20 disabled:opacity-50"><Check className="h-3.5 w-3.5" />{actionLoading === app.id ? 'Processing...' : 'Approve'}</button>
                            <button type="button" disabled={actionLoading === app.id} onClick={() => handleReview(app.id, 'rejected')} className="flex items-center gap-1.5 rounded-lg border border-red-300/20 bg-red-300/5 px-4 py-2.5 text-[10px] font-bold tracking-widest text-red-300 uppercase transition hover:bg-red-300/10 disabled:opacity-50"><X className="h-3.5 w-3.5" />Reject</button>
                            <button type="button" disabled={actionLoading === app.id} onClick={() => handleReview(app.id, 'info_requested')} className="flex items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-300/5 px-4 py-2.5 text-[10px] font-bold tracking-widest text-amber-300 uppercase transition hover:bg-amber-300/10 disabled:opacity-50"><AlertTriangle className="h-3.5 w-3.5" />Request Info</button>
                            <button type="button" onClick={() => setReviewing(null)} className="rounded-lg border border-white/10 px-4 py-2.5 text-[10px] font-bold tracking-widest text-white/50 uppercase hover:text-white/70">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setReviewing(app.id)} className="flex items-center gap-1.5 rounded-lg border border-[#d4a52c]/40 bg-[#c0911e]/15 px-4 py-2.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition hover:bg-[#c0911e]/25">
                          <KeyRound className="h-3.5 w-3.5" /> Review
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function gameType(app: CreatorApplication): string {
  return app.game_type;
}

// ── Reports / Moderation ────────────────────────────────────────

export function StaffReportsSection() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/[0.06] bg-[#0a0c0e]/40 px-5 py-4 backdrop-blur-md">
        <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">Reports &amp; Moderation</div>
        <h1 className="mt-1 text-xl font-semibold text-white">Reports</h1>
        <p className="mt-1 text-[11px] text-white/40">Review reported content and moderation actions.</p>
      </div>
      <div className="flex-1 p-5">
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
          <Shield className="mx-auto h-8 w-8 text-white/15" strokeWidth={1.5} />
          <p className="mt-3 text-[13px] text-white/35">No open reports.</p>
        </div>
      </div>
    </div>
  );
}

// ── System Messages ────────────────────────────────────────────

export function StaffSystemMessagesSection({ staffAccount }: { staffAccount: SpotVaultAccount }) {
  const [messages, setMessages] = useState<Array<{ id: string; title: string; body: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const load = async () => {
    setLoading(true);
    const { supabase } = await import('@/lib/supabase');
    const { data } = await supabase.from('sv_system_messages').select('id, title, body, created_at').order('created_at', { ascending: false }).limit(20);
    setMessages(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    await sendSystemMessage(staffAccount.id, 'sysmsg_' + Date.now(), title.trim(), body.trim(), {});
    setSending(false);
    setTitle('');
    setBody('');
    setSent(true);
    window.setTimeout(() => setSent(false), 3000);
    load();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/[0.06] bg-[#0a0c0e]/40 px-5 py-4 backdrop-blur-md">
        <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">System Messages</div>
        <h1 className="mt-1 text-xl font-semibold text-white">Platform Announcements</h1>
        <p className="mt-1 text-[11px] text-white/40">Send platform-wide announcements and system messages.</p>
      </div>
      <div className="flex-1 p-5">
        <div className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="mb-3 text-[9px] font-mono tracking-widest text-[#d4a52c] uppercase">New System Message</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Message title..." className="mb-2 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[12px] text-white outline-none placeholder:text-white/25 focus:border-[#d4a52c]/60" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message body..." rows={3} className="mb-3 w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-white outline-none placeholder:text-white/25 focus:border-[#d4a52c]/60" />
          <div className="flex items-center gap-3">
            <button type="button" disabled={!title.trim() || !body.trim() || sending} onClick={handleSend} className="rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/20 px-5 py-2.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:bg-[#d4a52c]/30 disabled:opacity-50">{sending ? 'Sending...' : 'Send Message'}</button>
            {sent && <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-emerald-300 uppercase"><Check className="h-3.5 w-3.5" />Sent</span>}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[9px] font-bold tracking-widest text-white/30 uppercase">Recent Messages</div>
          {loading ? (
            <p className="text-[10px] text-white/30">Loading...</p>
          ) : messages.length === 0 ? (
            <p className="text-[10px] text-white/30">No system messages yet.</p>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => (
                <div key={msg.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-white">{msg.title}</div>
                    <div className="text-[9px] font-mono text-white/30">{new Date(msg.created_at).toLocaleString()}</div>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-white/50">{msg.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── StakeKings Access Management ───────────────────────────────

import {
  staffSearchUserByUsername,
  staffGrantStakeKingsManager,
  staffRevokeStakeKingsManager,
  staffListStakeKingsManagers,
  type StaffUserSearchResult,
  type StakeKingsManager,
} from '@/lib/partnerStore';
import { Crown, UserPlus, UserMinus } from 'lucide-react';

export function StakeKingsAccessSection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StaffUserSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [managers, setManagers] = useState<StakeKingsManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const loadManagers = async () => {
    setLoading(true);
    const data = await staffListStakeKingsManagers();
    setManagers(data);
    setLoading(false);
  };

  useEffect(() => { loadManagers(); }, []);

  const handleSearch = async () => {
    setSearched(true);
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); return; }
    const results = await staffSearchUserByUsername(q);
    setSearchResults(results);
  };

  const handleGrant = async (userId: string) => {
    setActionLoading(true);
    setMessage(null);
    const result = await staffGrantStakeKingsManager(userId);
    setActionLoading(false);
    if (result.ok) {
      setMessage({ kind: 'success', text: 'StakeKings Manager access granted.' });
      setSearchResults([]);
      setSearchQuery('');
      setSearched(false);
      loadManagers();
    } else {
      setMessage({ kind: 'error', text: result.error || 'Failed to grant access.' });
    }
  };

  const handleRevoke = async (userId: string) => {
    setActionLoading(true);
    setMessage(null);
    const result = await staffRevokeStakeKingsManager(userId);
    setActionLoading(false);
    if (result.ok) {
      setMessage({ kind: 'success', text: 'StakeKings Manager access removed. User is now a player.' });
      loadManagers();
    } else {
      setMessage({ kind: 'error', text: result.error || 'Failed to remove access.' });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/[0.06] bg-[#0a0c0e]/40 px-5 py-4 backdrop-blur-md">
        <div className="text-[10px] font-mono tracking-[0.25em] text-[#d4a52c] uppercase">Partner Access · StakeKings</div>
        <h1 className="mt-1 text-xl font-semibold text-white">StakeKings Access Management</h1>
        <p className="mt-1 text-[11px] text-white/40">Grant or remove StakeKings Manager access for SpotVault users.</p>
      </div>
      <div className="flex-1 p-5">
        {message && (
          <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-[11px] ${message.kind === 'success' ? 'border-emerald-300/20 bg-emerald-300/5 text-emerald-300' : 'border-red-300/20 bg-red-300/5 text-red-300'}`}>
            {message.kind === 'success' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <label className="text-[9px] font-mono tracking-widest text-[#d4a52c] uppercase">Search by Username</label>
          <div className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                placeholder="Enter username (e.g. jordanmcallister12)..."
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-3 text-[12px] text-white outline-none focus:border-[#d4a52c]/60 placeholder:text-white/25"
              />
            </div>
            <button type="button" onClick={handleSearch} className="rounded-lg border border-[#d4a52c]/50 bg-[#d4a52c]/15 px-5 py-2.5 text-[10px] font-bold tracking-widest text-[#f5e6b0] uppercase transition-all hover:bg-[#d4a52c]/25">Search</button>
          </div>

          {searched && searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((user) => {
                const isAlreadyManager = managers.some((m) => m.user_id === user.user_id);
                return (
                  <div key={user.user_id} className="flex items-center justify-between rounded-xl border border-[#c0911e]/20 bg-[#0c0e10] p-4">
                    <div>
                      <div className="text-sm font-bold text-white">{user.display_name ?? user.email}</div>
                      {user.username && <div className="mt-0.5 text-[10px] font-mono tracking-widest text-white/40 uppercase">@{user.username}</div>}
                      <div className="mt-0.5 text-[10px] text-white/50">{user.email}</div>
                    </div>
                    {isAlreadyManager ? (
                      <span className="flex items-center gap-1.5 rounded-lg border border-emerald-300/20 bg-emerald-300/5 px-3 py-2 text-[10px] font-bold tracking-widest text-emerald-300 uppercase">
                        <ShieldCheck className="h-3.5 w-3.5" /> Already Manager
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleGrant(user.user_id)}
                        disabled={actionLoading}
                        className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-[10px] font-bold tracking-widest text-emerald-300 uppercase transition-all hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Grant Manager
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {searched && searchResults.length === 0 && (
            <div className="mt-4 rounded-lg border border-white/10 bg-[#0a0c0e]/30 p-4 text-center text-[11px] text-white/40">
              No users found matching that username.
            </div>
          )}
        </div>

        {/* Current managers */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Crown className="h-4 w-4 text-[#d4a52c]" />
            <h2 className="text-[11px] font-bold tracking-widest text-white/50 uppercase">Current StakeKings Managers</h2>
          </div>
          {loading ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#0a0c0e]/40 p-6 text-center text-[11px] text-white/40">Loading...</div>
          ) : managers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-[#0a0c0e]/30 p-6 text-center text-[11px] text-white/40">No StakeKings managers currently assigned.</div>
          ) : (
            <div className="space-y-2">
              {managers.map((mgr) => (
                <div key={mgr.user_id} className="flex items-center justify-between rounded-xl border border-[#c0911e]/20 bg-[#0c0e10] p-4">
                  <div>
                    <div className="text-sm font-bold text-white">{mgr.display_name ?? mgr.email}</div>
                    {mgr.username && <div className="mt-0.5 text-[10px] font-mono tracking-widest text-white/40 uppercase">@{mgr.username}</div>}
                    <div className="mt-0.5 text-[10px] text-white/50">{mgr.email}</div>
                    {mgr.stakekings_test_override && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[8px] font-bold tracking-widest text-amber-300 uppercase">Test Override</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(mgr.user_id)}
                    disabled={actionLoading}
                    className="flex items-center gap-2 rounded-lg border border-red-300/30 bg-red-300/5 px-4 py-2.5 text-[10px] font-bold tracking-widest text-red-200 uppercase transition-all hover:bg-red-300/10 disabled:opacity-50"
                  >
                    <UserMinus className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Website Traffic Section ────────────────────────────────────

export function AccountTrafficSection() {
  const { traffic, loading, error } = useStaffTraffic();
  const [trafficView, setTrafficView] = useState<'day' | 'week' | 'month'>('day');

  const chartData = useMemo(() => {
    if (!traffic) return [];
    if (trafficView === 'day') return traffic.daily.map((d) => ({ label: d.date, visits: d.visits }));
    if (trafficView === 'week') return traffic.weekly.map((w) => ({ label: w.week_start, visits: w.visits }));
    return traffic.monthly.map((m) => ({ label: m.month, visits: m.visits }));
  }, [traffic, trafficView]);

  const maxVisits = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(1, ...chartData.map((d) => d.visits));
  }, [chartData]);

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 lg:p-6">
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-300/20 bg-red-300/5 p-3 text-[11px] text-red-300">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="rounded-2xl border border-[#c0911e]/20 bg-[#0a0c0e]/55 p-5 backdrop-blur-md">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#d4a52c]" />
            <h2 className="text-[12px] font-bold tracking-widest text-white/70 uppercase">Website Traffic</h2>
          </div>
          <div className="flex gap-1">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTrafficView(v)}
                className={`rounded-lg border px-3 py-1 text-[9px] font-bold tracking-widest uppercase transition ${
                  trafficView === v
                    ? 'border-[#d4a52c]/60 bg-[#d4a52c]/15 text-[#f5e6b0]'
                    : 'border-white/10 text-white/40 hover:text-white/70'
                }`}
              >
                {v === 'day' ? 'Daily' : v === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-[11px] text-white/40">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading traffic...
          </div>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <div className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Unique Visitors Today</div>
                <div className="mt-1 text-[20px] font-mono font-bold text-white">{traffic?.today ?? 0}</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <div className="text-[9px] font-bold tracking-widest text-white/40 uppercase">This Week</div>
                <div className="mt-1 text-[20px] font-mono font-bold text-white">{traffic?.last_7_days ?? 0}</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <div className="text-[9px] font-bold tracking-widest text-white/40 uppercase">This Month</div>
                <div className="mt-1 text-[20px] font-mono font-bold text-white">{traffic?.last_30_days ?? 0}</div>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <div className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Page Views Today</div>
                <div className="mt-1 text-[20px] font-mono font-bold text-white">{traffic?.page_views_today ?? 0}</div>
              </div>
            </div>
            <div className="mb-5 flex flex-wrap gap-3 text-[9px] text-white/35">
              <span>Unique visitors exclude bots/crawlers</span>
              <span>·</span>
              <span>Logged-in today: {traffic?.authenticated_today ?? 0}</span>
              <span>·</span>
              <span>Total page views: {traffic?.page_views_total ?? 0}</span>
            </div>

            {/* Time-series bar chart */}
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="mb-2 text-[9px] font-bold tracking-widest text-white/30 uppercase">
                {trafficView === 'day' ? 'Daily Unique Visitors — Last 30 Days' : trafficView === 'week' ? 'Weekly Unique Visitors — Last 12 Weeks' : 'Monthly Unique Visitors — Last 12 Months'}
              </div>
              {chartData.length > 0 && chartData.some((d) => d.visits > 0) ? (
                <div className="flex h-32 items-end gap-1">
                  {chartData.map((d, i) => {
                    const heightPct = (d.visits / maxVisits) * 100;
                    return (
                      <div key={i} className="group relative flex flex-1 flex-col items-center justify-end" title={`${d.label}: ${d.visits}`}>
                        <div
                          className="w-full rounded-t transition-all"
                          style={{
                            height: `${Math.max(2, heightPct)}%`,
                            background: d.visits > 0 ? 'linear-gradient(to top, rgba(212,165,44,0.3), rgba(212,165,44,0.8))' : 'rgba(255,255,255,0.04)',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center text-[11px] text-white/30">
                  No traffic data yet. Visits will appear here as users browse the site.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
