import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ScreenTarget =
  | 'ACCESS_LOGIN'
  | 'COMMUNITY'
  | 'PLAYER_MAIN'
  | 'PLAYER_PEER_ROOM'
  | 'PLAYER_SECOND_FLOOR'
  | 'INVESTOR_MAIN'
  | 'BUSINESS_MAIN'
  | 'BUSINESS_SECOND_FLOOR'
  | 'MEDIA_MAIN'
  | 'MEDIA_SECOND_FLOOR'
  | 'CREATOR_MAIN'
  | 'CREATOR_SECOND_FLOOR'
  | 'COACH_MAIN'
  | 'STABLE_MAIN'
  | 'STABLE_SECOND_FLOOR'
  | 'AFFILIATE_PARTNER_MAIN'
  | 'AFFILIATE_PARTNER_SECOND_FLOOR'
  | 'STAKEKINGS_MAIN'
  | 'HELP_MAIN'
  | 'JOBS'
  | 'ADVERTISING'
  | 'MARKETPLACE'
  | 'STORE'
  | 'PERFORMANCE_CENTER'
  | 'STUDENT_CENTER'
  | 'STAFF_ADMIN';

export type AssetKind = 'image' | 'generated';
export type GalleryVisibility = 'player' | 'community' | 'both' | 'hidden';

export interface EnvironmentAsset {
  id: string;
  name: string;
  fileName: string;
  filePath: string;
  src: string | null;
  kind: AssetKind;
  allowedScreens: ScreenTarget[];
  notes: string;
  galleryVisibility: GalleryVisibility;
}

export const PORTAL_TO_SCREEN_TARGET: Record<string, ScreenTarget> = {
  PLAYER: 'PLAYER_MAIN',
  INVESTOR: 'INVESTOR_MAIN',
  BUSINESS: 'BUSINESS_MAIN',
  MEDIA: 'MEDIA_MAIN',
  CREATOR: 'CREATOR_MAIN',
  COACH: 'COACH_MAIN',
  STABLE: 'STABLE_MAIN',
  AFFILIATE_PARTNER: 'AFFILIATE_PARTNER_MAIN',
  STAKEKINGS_PLAYER: 'STAKEKINGS_MAIN',
  STAFF: 'STAFF_ADMIN',
  HELP: 'HELP_MAIN',
};

export function getPortalScreenTarget(portalId: string): ScreenTarget | null {
  return PORTAL_TO_SCREEN_TARGET[portalId] ?? null;
}

export const SCREEN_TARGETS: { group: string; label: string; targets: { id: ScreenTarget; label: string }[] }[] = [
  { group: 'GLOBAL', label: 'Shared / Global', targets: [
    { id: 'ACCESS_LOGIN', label: 'Login / Access' },
    { id: 'COMMUNITY', label: 'Community' },
    { id: 'JOBS', label: 'Jobs' },
    { id: 'ADVERTISING', label: 'Advertising' },
    { id: 'MARKETPLACE', label: 'Marketplace' },
    { id: 'STORE', label: 'Store' },
    { id: 'PERFORMANCE_CENTER', label: 'Performance Center' },
    { id: 'HELP_MAIN', label: 'Help' },
    { id: 'STUDENT_CENTER', label: 'Workspace' },
  ] },
  { group: 'PLAYER', label: 'Player', targets: [
    { id: 'PLAYER_MAIN', label: 'Home' },
    { id: 'PLAYER_PEER_ROOM', label: 'Peer Room' },
  ] },
  { group: 'BUSINESS', label: 'Business', targets: [
    { id: 'BUSINESS_MAIN', label: 'Business Hub' },
  ] },
  { group: 'CREATOR', label: 'Creator', targets: [
    { id: 'CREATOR_MAIN', label: 'Creator Hub' },
  ] },
  { group: 'COACH', label: 'Coach', targets: [
    { id: 'COACH_MAIN', label: 'Coach Hub' },
  ] },
  { group: 'STABLE', label: 'Stable', targets: [
    { id: 'STABLE_MAIN', label: 'Stable Hub' },
  ] },
  { group: 'MEDIA', label: 'Media', targets: [
    { id: 'MEDIA_MAIN', label: 'Media Hub' },
  ] },
  { group: 'INVESTOR', label: 'Investor', targets: [
    { id: 'INVESTOR_MAIN', label: 'Investor Hub' },
  ] },
  { group: 'AFFILIATE_PARTNER', label: 'Affiliate / Partner', targets: [
    { id: 'AFFILIATE_PARTNER_MAIN', label: 'Affiliate Hub' },
    { id: 'AFFILIATE_PARTNER_SECOND_FLOOR', label: 'Affiliate Second Floor' },
  ] },
  { group: 'STAKEKINGS', label: 'StakeKings', targets: [
    { id: 'STAKEKINGS_MAIN', label: 'StakeKings Hub' },
  ] },
  { group: 'STAFF', label: 'Staff / Admin', targets: [
    { id: 'STAFF_ADMIN', label: 'Staff / Admin' },
  ] },
];

export const ENVIRONMENT_ASSETS: EnvironmentAsset[] = [
  { id: 'coach-room-media-lounge', name: 'COACH_ROOM_MEDIA_LOUNGE', fileName: 'coach-portal-background.webp', filePath: '/coach-portal-background.webp', src: '/coach-portal-background.webp', kind: 'image', allowedScreens: ['COACH_MAIN'], notes: '', galleryVisibility: 'both' },
  { id: 'investor-room-vancouver', name: 'INVESTOR_ROOM_VANCOUVER', fileName: 'investor-glass-tower-vancouver.webp', filePath: '/assets/investor-glass-tower-vancouver.webp', src: '/assets/investor-glass-tower-vancouver.webp', kind: 'image', allowedScreens: ['INVESTOR_MAIN'], notes: '', galleryVisibility: 'both' },
  { id: 'glass-tower-toronto', name: 'INVESTOR_ROOM_TORONTO', fileName: 'glass-tower-toronto.webp', filePath: '/glass-tower-toronto.webp', src: '/glass-tower-toronto.webp', kind: 'image', allowedScreens: ['INVESTOR_MAIN'], notes: '', galleryVisibility: 'both' },
  { id: 'player-high-roller-lounge', name: 'PLAYER_HIGH_ROLLER_LOUNGE', fileName: 'player-portal-high-roller-lounge.webp', filePath: '/player-portal-high-roller-lounge.webp', src: '/player-portal-high-roller-lounge.webp', kind: 'image', allowedScreens: ['PLAYER_MAIN'], notes: '', galleryVisibility: 'both' },
  { id: 'player-network-floor', name: 'PLAYER_NETWORK_FLOOR', fileName: 'image copy copy copy copy.webp', filePath: '/image copy copy copy copy.webp', src: '/image copy copy copy copy.webp', kind: 'image', allowedScreens: ['PLAYER_PEER_ROOM', 'BUSINESS_MAIN'], notes: '', galleryVisibility: 'both' },
  { id: 'community-option-01', name: 'COMMUNITY_OPTION_01', fileName: 'image copy.webp', filePath: '/image copy.webp', src: '/image copy.webp', kind: 'image', allowedScreens: ['COMMUNITY'], notes: '', galleryVisibility: 'community' },
  { id: 'urban-park', name: 'URBAN PARK', fileName: 'CSS-generated environment', filePath: 'src/themes/communityThemes.tsx', src: null, kind: 'generated', allowedScreens: ['COMMUNITY'], notes: '', galleryVisibility: 'hidden' },
  { id: 'waterfront-promenade', name: 'WATERFRONT PROMENADE', fileName: 'CSS-generated environment', filePath: 'src/themes/communityThemes.tsx', src: null, kind: 'generated', allowedScreens: ['COMMUNITY'], notes: '', galleryVisibility: 'hidden' },
  { id: 'the-commons', name: 'THE COMMONS', fileName: 'CSS-generated environment', filePath: 'src/themes/communityThemes.tsx', src: null, kind: 'generated', allowedScreens: ['COMMUNITY'], notes: '', galleryVisibility: 'hidden' },
  { id: 'rooftop-social-club', name: 'ROOFTOP SOCIAL CLUB', fileName: 'CSS-generated environment', filePath: 'src/themes/communityThemes.tsx', src: null, kind: 'generated', allowedScreens: ['COMMUNITY'], notes: '', galleryVisibility: 'hidden' },
  { id: 'golf-course', name: 'GOLF COURSE', fileName: 'CSS-generated environment', filePath: 'src/themes/communityThemes.tsx', src: null, kind: 'generated', allowedScreens: ['COMMUNITY'], notes: '', galleryVisibility: 'hidden' },
  { id: 'help-overview', name: 'HELP_OVERVIEW', fileName: 'help-env-overview.webp', filePath: '/help-env-overview.webp', src: '/help-env-overview.webp', kind: 'image', allowedScreens: ['HELP_MAIN'], notes: '', galleryVisibility: 'hidden' },
  { id: 'help-therapy', name: 'HELP_THERAPY', fileName: 'help-env-therapy.webp', filePath: '/help-env-therapy.webp', src: '/help-env-therapy.webp', kind: 'image', allowedScreens: ['HELP_MAIN'], notes: '', galleryVisibility: 'hidden' },
  { id: 'help-performance', name: 'HELP_PERFORMANCE', fileName: 'help-env-performance.webp', filePath: '/help-env-performance.webp', src: '/help-env-performance.webp', kind: 'image', allowedScreens: ['HELP_MAIN'], notes: '', galleryVisibility: 'hidden' },
  { id: 'help-gambling', name: 'HELP_GAMBLING', fileName: 'help-env-gambling.webp', filePath: '/help-env-gambling.webp', src: '/help-env-gambling.webp', kind: 'image', allowedScreens: ['HELP_MAIN'], notes: '', galleryVisibility: 'hidden' },
  { id: 'help-my-support', name: 'HELP_MY_SUPPORT', fileName: 'help-env-mysupport.webp', filePath: '/help-env-mysupport.webp', src: '/help-env-mysupport.webp', kind: 'image', allowedScreens: ['HELP_MAIN'], notes: '', galleryVisibility: 'hidden' },
  { id: 'executive-office', name: 'EXECUTIVE_OFFICE', fileName: 'CSS-generated environment', filePath: 'src/themes/investorThemes.tsx', src: null, kind: 'generated', allowedScreens: ['INVESTOR_MAIN'], notes: '', galleryVisibility: 'hidden' },
  { id: 'the-vault', name: 'THE_VAULT', fileName: 'CSS-generated environment', filePath: 'src/themes/investorThemes.tsx', src: null, kind: 'generated', allowedScreens: ['INVESTOR_MAIN'], notes: '', galleryVisibility: 'hidden' },
  { id: 'stakekings-action', name: 'STAKEKINGS_ACTION', fileName: 'stakekings-action-btn.webp', filePath: '/assets/stakekings-action-btn.webp', src: '/assets/stakekings-action-btn.webp', kind: 'image', allowedScreens: ['STAKEKINGS_MAIN'], notes: 'StakeKings branded background', galleryVisibility: 'both' },
  { id: 'stakekings-logo-bg', name: 'STAKEKINGS_LOGO', fileName: 'stakekings_logo.webp', filePath: '/stakekings_logo.webp', src: '/stakekings_logo.webp', kind: 'image', allowedScreens: ['STAKEKINGS_MAIN'], notes: 'StakeKings logo background', galleryVisibility: 'hidden' },
];

export type AssetAssignments = Record<string, ScreenTarget[]>;
export const DEFAULT_ASSET_ASSIGNMENTS: AssetAssignments = Object.fromEntries(ENVIRONMENT_ASSETS.map((asset) => [asset.id, asset.allowedScreens]));
const STORAGE_KEY = 'spotvault-environment-asset-assignments';

type AssetRow = {
  id: string;
  display_name: string;
  file_name: string;
  file_path: string;
  src: string | null;
  kind: AssetKind;
  allowed_screens: string[];
  notes: string;
  gallery_visibility?: GalleryVisibility;
};

function mapRow(row: AssetRow): EnvironmentAsset {
  return { id: row.id, name: row.display_name, fileName: row.file_name, filePath: row.file_path, src: row.src, kind: row.kind, allowedScreens: row.allowed_screens as ScreenTarget[], notes: row.notes ?? '', galleryVisibility: row.gallery_visibility ?? 'hidden' };
}

function toRow(asset: EnvironmentAsset): AssetRow {
  return { id: asset.id, display_name: asset.name, file_name: asset.fileName, file_path: asset.filePath, src: asset.src, kind: asset.kind, allowed_screens: asset.allowedScreens, notes: asset.notes, gallery_visibility: asset.galleryVisibility };
}

function legacyAssignments(): AssetAssignments | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as AssetAssignments : null;
  } catch { return null; }
}

export interface EnvironmentAssetStore {
  assets: EnvironmentAsset[];
  assignments: AssetAssignments;
  ready: boolean;
  saving: boolean;
  updateAssignments: (assetIds: string[], target: ScreenTarget, enabled: boolean) => Promise<void>;
  updateMetadata: (assetId: string, changes: { name?: string; notes?: string }) => Promise<void>;
  updateGalleryVisibility: (assetId: string, visibility: GalleryVisibility) => Promise<void>;
  uploadFiles: (files: File[]) => Promise<void>;
  saveNewAsset: (file: File, name: string, notes: string, targets: ScreenTarget[]) => Promise<void>;
  saveNewAssetFromDraft: (asset: EnvironmentAsset) => Promise<void>;
  deleteAsset: (assetId: string) => Promise<void>;
  applyPortalBackground: (assetId: string, target: ScreenTarget) => Promise<void>;
}

export function useEnvironmentAssets(): EnvironmentAssetStore {
  const [assets, setAssets] = useState<EnvironmentAsset[]>(ENVIRONMENT_ASSETS);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const assetsRef = useRef(assets);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.from('spotvault_environment_assets').select('id, display_name, file_name, file_path, src, kind, allowed_screens, notes, gallery_visibility').order('created_at', { ascending: true });
      if (error) { if (!cancelled) setReady(true); return; }
      const rows = (data ?? []) as AssetRow[];
      if (rows.length === 0) {
        const legacy = legacyAssignments();
        const seed = ENVIRONMENT_ASSETS.map((asset) => ({ ...asset, allowedScreens: legacy?.[asset.id] ?? asset.allowedScreens }));
        await supabase.from('spotvault_environment_assets').upsert(seed.map(toRow));
        if (!cancelled) setAssets(seed);
      } else {
        if (!cancelled) setAssets(rows.map(mapRow));
      }
      if (!cancelled) setReady(true);
    };
    const refreshHandler = () => { void load(); };
    window.addEventListener('spotvault-environment-assets-changed', refreshHandler);
    void load();
    return () => {
      cancelled = true;
      window.removeEventListener('spotvault-environment-assets-changed', refreshHandler);
    };
  }, []);

  const updateAssignments = async (assetIds: string[], target: ScreenTarget, enabled: boolean) => {
    setSaving(true);
    const selected = new Set(assetIds);
    const nextAssets = assetsRef.current.map((asset) => {
      if (!selected.has(asset.id)) return asset;
      const next = enabled ? Array.from(new Set([...asset.allowedScreens, target])) : asset.allowedScreens.filter((item) => item !== target);
      return { ...asset, allowedScreens: next };
    });
    assetsRef.current = nextAssets;
    setAssets(nextAssets);
    const changed = nextAssets.filter((asset) => selected.has(asset.id));
    const results = await Promise.all(changed.map((asset) => supabase.from('spotvault_environment_assets').update({ allowed_screens: asset.allowedScreens, updated_at: new Date().toISOString() }).eq('id', asset.id)));
    setSaving(false);
    if (results.some((result) => result.error)) throw new Error('Could not save asset assignments.');
    window.dispatchEvent(new CustomEvent('spotvault-environment-assets-changed'));
  };

  const updateMetadata = async (assetId: string, changes: { name?: string; notes?: string }) => {
    setAssets((previous) => previous.map((asset) => asset.id === assetId ? { ...asset, ...(changes.name === undefined ? {} : { name: changes.name }), ...(changes.notes === undefined ? {} : { notes: changes.notes }) } : asset));
    const payload = { ...(changes.name === undefined ? {} : { display_name: changes.name }), ...(changes.notes === undefined ? {} : { notes: changes.notes }), updated_at: new Date().toISOString() };
    const { error } = await supabase.from('spotvault_environment_assets').update(payload).eq('id', assetId);
    if (error) throw new Error('Could not save asset details.');
  };

  const updateGalleryVisibility = async (assetId: string, visibility: GalleryVisibility) => {
    setAssets((previous) => previous.map((asset) => asset.id === assetId ? { ...asset, galleryVisibility: visibility } : asset));
    const { error } = await supabase.from('spotvault_environment_assets').update({ gallery_visibility: visibility, updated_at: new Date().toISOString() }).eq('id', assetId);
    if (error) throw new Error('Could not update gallery visibility.');
    window.dispatchEvent(new CustomEvent('spotvault-environment-assets-changed'));
  };

  const uploadFiles = async (files: File[]) => {
    setSaving(true);
    try {
      const added: EnvironmentAsset[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) continue;
        const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
        const id = crypto.randomUUID();
        const filePath = `${id}${extension}`;
        const upload = await supabase.storage.from('spotvault-assets').upload(filePath, file, { contentType: file.type, upsert: false });
        if (upload.error) continue;
        const src = supabase.storage.from('spotvault-assets').getPublicUrl(filePath).data.publicUrl;
        const asset: EnvironmentAsset = { id, name: file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim().toUpperCase() || id, fileName: file.name, filePath: `spotvault-assets/${filePath}`, src, kind: 'image', allowedScreens: [], notes: '', galleryVisibility: 'hidden' };
        const { error } = await supabase.from('spotvault_environment_assets').insert(toRow(asset));
        if (!error) added.push(asset);
      }
      setAssets((previous) => [...previous, ...added]);
      window.dispatchEvent(new CustomEvent('spotvault-environment-assets-changed'));
    } finally { setSaving(false); }
  };

  const saveNewAsset = async (file: File, name: string, notes: string, targets: ScreenTarget[]) => {
    setSaving(true);
    try {
      const slug = name.toLowerCase().replace(/[_\s]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
      let id = slug || crypto.randomUUID();
      const { data: existing } = await supabase.from('spotvault_environment_assets').select('id').eq('id', id).maybeSingle();
      if (existing) id = `${id}-${Date.now().toString(36)}`;
      const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
      const storagePath = `${id}${extension}`;
      const upload = await supabase.storage.from('spotvault-assets').upload(storagePath, file, { contentType: file.type, upsert: false });
      if (upload.error) throw new Error('Could not upload image.');
      const src = supabase.storage.from('spotvault-assets').getPublicUrl(storagePath).data.publicUrl;
      const asset: EnvironmentAsset = { id, name: name.toUpperCase(), fileName: file.name, filePath: `spotvault-assets/${storagePath}`, src, kind: 'image', allowedScreens: targets, notes, galleryVisibility: 'hidden' };
      const { error } = await supabase.from('spotvault_environment_assets').insert(toRow(asset));
      if (error) throw new Error('Could not save asset record.');
      setAssets((previous) => [...previous, asset]);
      window.dispatchEvent(new CustomEvent('spotvault-environment-assets-changed'));
    } finally { setSaving(false); }
  };

  const saveNewAssetFromDraft = async (asset: EnvironmentAsset) => {
    setSaving(true);
    try {
      const response = await fetch(asset.src);
      const blob = await response.blob();
      const file = new File([blob], asset.fileName || `${asset.id}.png`, { type: blob.type || 'image/png' });
      const slug = asset.name.toLowerCase().replace(/[_\s]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
      let id = slug || crypto.randomUUID();
      const { data: existing } = await supabase.from('spotvault_environment_assets').select('id').eq('id', id).maybeSingle();
      if (existing) id = `${id}-${Date.now().toString(36)}`;
      const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
      const storagePath = `${id}${extension}`;
      const upload = await supabase.storage.from('spotvault-assets').upload(storagePath, file, { contentType: file.type, upsert: false });
      if (upload.error) throw new Error('Could not upload image.');
      const src = supabase.storage.from('spotvault-assets').getPublicUrl(storagePath).data.publicUrl;
      const savedAsset: EnvironmentAsset = { ...asset, id, src, filePath: `spotvault-assets/${storagePath}` };
      const { error } = await supabase.from('spotvault_environment_assets').insert(toRow(savedAsset));
      if (error) throw new Error('Could not save asset record.');
      setAssets((previous) => [...previous, savedAsset]);
      window.dispatchEvent(new CustomEvent('spotvault-environment-assets-changed'));
    } finally { setSaving(false); }
  };

  const deleteAsset = async (assetId: string) => {
    setSaving(true);
    try {
      const asset = assets.find((a) => a.id === assetId);
      if (asset && asset.filePath.startsWith('spotvault-assets/')) {
        const storagePath = asset.filePath.replace('spotvault-assets/', '');
        await supabase.storage.from('spotvault-assets').remove([storagePath]);
      }
      await supabase.from('spotvault_environment_assets').delete().eq('id', assetId);
      setAssets((previous) => previous.filter((a) => a.id !== assetId));
      window.dispatchEvent(new CustomEvent('spotvault-environment-assets-changed'));
    } finally { setSaving(false); }
  };

  const applyPortalBackground = async (assetId: string, target: ScreenTarget) => {
    setSaving(true);
    try {
      const nextAssets = assetsRef.current.map((asset) => {
        if (asset.id === assetId) {
          const screens = asset.allowedScreens.includes(target) ? asset.allowedScreens : [...asset.allowedScreens, target];
          return { ...asset, allowedScreens: screens };
        }
        return { ...asset, allowedScreens: asset.allowedScreens.filter((t) => t !== target) };
      });
      assetsRef.current = nextAssets;
      setAssets(nextAssets);
      const results = await Promise.all(nextAssets.map((asset) =>
        supabase.from('spotvault_environment_assets').update({ allowed_screens: asset.allowedScreens, updated_at: new Date().toISOString() }).eq('id', asset.id)
      ));
      if (results.some((r) => r.error)) throw new Error('Could not apply background.');
      window.dispatchEvent(new CustomEvent('spotvault-environment-assets-changed'));
    } finally { setSaving(false); }
  };

  const assignments = useMemo(() => Object.fromEntries(assets.map((asset) => [asset.id, asset.allowedScreens])), [assets]);
  return { assets, assignments, ready, saving, updateAssignments, updateMetadata, updateGalleryVisibility, uploadFiles, saveNewAsset, saveNewAssetFromDraft, deleteAsset, applyPortalBackground };
}

export function useAssetAssignments(): [AssetAssignments, (next: AssetAssignments | ((prev: AssetAssignments) => AssetAssignments)) => void] {
  const store = useEnvironmentAssets();
  const update = (next: AssetAssignments | ((prev: AssetAssignments) => AssetAssignments)) => {
    const resolved = typeof next === 'function' ? next(store.assignments) : next;
    Object.entries(resolved).forEach(([assetId, targets]) => {
      const current = store.assignments[assetId] ?? [];
      const allTargets = Array.from(new Set([...current, ...targets]));
      allTargets.forEach((target) => { void store.updateAssignments([assetId], target, targets.includes(target)); });
    });
  };
  return [store.assignments, update];
}

export function getAssetsForScreen(target: ScreenTarget, assignments: AssetAssignments, assets: EnvironmentAsset[] = ENVIRONMENT_ASSETS): EnvironmentAsset[] {
  return assets.filter((asset) => assignments[asset.id]?.includes(target));
}

export function getGalleryAssets(assets: EnvironmentAsset[], destination: 'player' | 'community'): EnvironmentAsset[] {
  return assets.filter((asset) => asset.src && (destination === 'player' ? (asset.galleryVisibility === 'player' || asset.galleryVisibility === 'both') : (asset.galleryVisibility === 'community' || asset.galleryVisibility === 'both')));
}

export const DEFAULT_PLAYER_BACKGROUND_ID = 'player-high-roller-lounge';
export const DEFAULT_COMMUNITY_BACKGROUND_ID = 'community-option-01';

export function usePortalBackground(screenTarget: ScreenTarget | null, userId?: string | null): EnvironmentAsset | null {
  const store = useEnvironmentAssets();
  const [userOverride, setUserOverride] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !screenTarget) { setUserOverride(null); return; }
    let cancelled = false;
    supabase.from('user_preferences')
      .select('backgrounds')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const bgs = (data?.backgrounds as Record<string, string>) ?? {};
        setUserOverride(bgs[screenTarget] ?? null);
      });
    return () => { cancelled = true; };
  }, [userId, screenTarget]);

  return useMemo(() => {
    if (!screenTarget || !store.ready) return null;
    if (userOverride) {
      const override = store.assets.find((a) => a.id === userOverride);
      if (override) return override;
    }
    const matching = store.assets.filter((asset) => asset.allowedScreens.includes(screenTarget));
    return matching[0] ?? null;
  }, [screenTarget, store.assets, store.ready, userOverride]);
}

export function getScreenLabel(target: ScreenTarget): string {
  for (const group of SCREEN_TARGETS) { const match = group.targets.find((item) => item.id === target); if (match) return match.label; }
  return target;
}

export interface AuthorizedScreen {
  id: ScreenTarget;
  label: string;
  group: string;
}

const SHARED_SCREENS: AuthorizedScreen[] = [
  { id: 'ACCESS_LOGIN', label: 'Login / Access', group: 'Shared / Global' },
  { id: 'COMMUNITY', label: 'Community', group: 'Shared / Global' },
  { id: 'JOBS', label: 'Jobs', group: 'Shared / Global' },
  { id: 'ADVERTISING', label: 'Advertising', group: 'Shared / Global' },
  { id: 'MARKETPLACE', label: 'Marketplace', group: 'Shared / Global' },
  { id: 'STORE', label: 'Store', group: 'Shared / Global' },
  { id: 'PERFORMANCE_CENTER', label: 'Performance Center', group: 'Shared / Global' },
  { id: 'HELP_MAIN', label: 'Help', group: 'Shared / Global' },
  { id: 'STUDENT_CENTER', label: 'Workspace', group: 'Shared / Global' },
];

const PORTAL_SCREENS: Record<string, AuthorizedScreen[]> = {
  PLAYER: [
    { id: 'PLAYER_MAIN', label: 'Home', group: 'Player' },
    { id: 'PLAYER_PEER_ROOM', label: 'Peer Room', group: 'Player' },
  ],
  COACH: [
    { id: 'COACH_MAIN', label: 'Coach Hub', group: 'Coach' },
  ],
  STABLE: [
    { id: 'STABLE_MAIN', label: 'Stable Hub', group: 'Stable' },
  ],
  CREATOR: [
    { id: 'CREATOR_MAIN', label: 'Creator Hub', group: 'Creator' },
  ],
  BUSINESS: [
    { id: 'BUSINESS_MAIN', label: 'Business Hub', group: 'Business' },
  ],
  MEDIA: [
    { id: 'MEDIA_MAIN', label: 'Media Hub', group: 'Media' },
  ],
  INVESTOR: [
    { id: 'INVESTOR_MAIN', label: 'Investor Hub', group: 'Investor' },
  ],
  AFFILIATE_PARTNER: [
    { id: 'AFFILIATE_PARTNER_MAIN', label: 'Affiliate Hub', group: 'Affiliate / Partner' },
    { id: 'AFFILIATE_PARTNER_SECOND_FLOOR', label: 'Affiliate Second Floor', group: 'Affiliate / Partner' },
  ],
  STAKEKINGS_PLAYER: [
    { id: 'STAKEKINGS_MAIN', label: 'StakeKings Hub', group: 'StakeKings' },
  ],
  STAFF: [
    { id: 'STAFF_ADMIN', label: 'Staff / Admin', group: 'Staff / Admin' },
  ],
};

export function getUserAuthorizedScreens(
  canAccess: (portal: string) => boolean,
): AuthorizedScreen[] {
  const screens: AuthorizedScreen[] = [...SHARED_SCREENS];
  for (const [portal, portalScreens] of Object.entries(PORTAL_SCREENS)) {
    if (canAccess(portal)) {
      screens.push(...portalScreens);
    }
  }
  return screens;
}
