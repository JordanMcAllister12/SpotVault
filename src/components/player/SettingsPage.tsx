import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Settings as SettingsIcon, Lock, Palette,
  Check, X, Loader2, Monitor, RefreshCw, Sparkles,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { useEnvironmentAssets, getUserAuthorizedScreens, getGalleryAssets, DEFAULT_PLAYER_BACKGROUND_ID, DEFAULT_COMMUNITY_BACKGROUND_ID, type ScreenTarget, type EnvironmentAsset, type AuthorizedScreen } from '@/data/environmentAssets';
import { canAccessPortal, type SpotVaultAccount } from '@/types';
import { PasswordSection } from '@/components/player/PasswordSection';
import { TwoFactorSection } from '@/components/player/TwoFactorSection';
import { QuickPinSection } from '@/components/player/QuickPinSection';
import { STAKEKINGS_THEME_OPTIONS, getPortalTheme, type PortalThemeId } from '@/lib/portalTheme';
import { PortalWorkspaceShell } from '@/components/shared/PortalWorkspaceShell';

const GOLD = '#d4a52c';
const GOLD_SOFT = '#f5e6b0';
const BORDER = 'rgba(212,165,44,0.18)';
const DARK_PANEL = '#0a0d10';
const PANEL_BORDER = 'rgba(212,165,44,0.12)';


interface SettingsPageProps {
  userId?: string | null;
  account?: SpotVaultAccount | null;
  portalContext?: 'player' | 'stakekings';
  embedded?: boolean;
}

export function SettingsPage({ userId, account, portalContext, embedded }: SettingsPageProps) {
  const [authedUserId, setAuthedUserId] = useState<string | null>(userId ?? null);
  const [email, setEmail] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('account');

  useEffect(() => {
    if (userId) { setAuthedUserId(userId); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) { setAuthedUserId(user.id); setEmail(user.email ?? null); }
    })();
  }, [userId]);

  useEffect(() => {
    if (email) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setEmail(user.email);
    })();
  }, [email]);

  const prefs = useUserPreferences(authedUserId);
  const assetStore = useEnvironmentAssets();

  const isStakeKings = portalContext === 'stakekings';
  const sections = [
    { id: 'account', label: 'Account', icon: SettingsIcon },
    { id: 'security', label: 'Password & Security', icon: Lock },
    ...(isStakeKings ? [{ id: 'portal-theme', label: 'Portal Appearance', icon: Sparkles }] : []),
    { id: 'backgrounds', label: 'Screen Backgrounds', icon: Monitor },
  ];

  const content = (
    <div className={embedded ? 'w-full px-5 py-4 sm:px-8 sm:py-3' : 'mx-auto w-full px-4 pt-2 sm:px-6'}>
      {/* Section selector — mobile dropdown / desktop tabs */}
      <div className="mb-4">
        {/* Mobile: compact dropdown */}
        <div className="sm:hidden">
          <div className="relative">
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              className="w-full appearance-none rounded-lg border px-3.5 py-2.5 text-[11px] font-semibold tracking-widest uppercase outline-none"
              style={{
                borderColor: GOLD,
                background: 'rgba(212,165,44,0.14)',
                color: GOLD_SOFT,
                backdropFilter: 'blur(6px)',
              }}
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#080706] text-white">{s.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: GOLD }} strokeWidth={1.5} />
          </div>
        </div>
        {/* Desktop: tab buttons */}
        <div className="hidden flex-wrap gap-2 sm:flex">
          {sections.map((s) => {
            const active = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[10px] font-semibold tracking-widest uppercase transition-all"
                style={{
                  borderColor: active ? GOLD : 'rgba(212,165,44,0.22)',
                  background: active ? 'rgba(212,165,44,0.14)' : 'rgba(8,7,6,0.82)',
                  color: active ? GOLD_SOFT : 'rgba(255,255,255,0.62)',
                  boxShadow: active
                    ? '0 0 12px rgba(212,165,44,0.18), inset 0 1px 0 rgba(255,255,255,0.04)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(6px)',
                }}>
                <s.icon size={12} strokeWidth={1.5} style={{ color: active ? GOLD : 'rgba(212,165,44,0.55)' }} /> {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {activeSection === 'account' && <AccountSection email={email} />}
      {activeSection === 'security' && (
        <div className="space-y-4">
          <PasswordSection email={email} />
          <TwoFactorSection email={email} />
          <QuickPinSection />
        </div>
      )}
      {activeSection === 'backgrounds' && (
        <AppearanceSection
          assetStore={assetStore}
          backgrounds={prefs.prefs.backgrounds}
          setBackground={prefs.setBackground}
          resetBackgrounds={prefs.resetBackgrounds}
          saving={prefs.saving}
          error={prefs.error === 'backgrounds'}
          loading={prefs.loading}
          onRetry={prefs.reload}
          account={account}
        />
      )}
      {activeSection === 'portal-theme' && isStakeKings && (
        <PortalThemeSection
          currentTheme={prefs.prefs.stakekingsTheme}
          onSave={prefs.setStakekingsTheme}
          saving={prefs.saving}
          loading={prefs.loading}
        />
      )}
    </div>
  );

  if (embedded) return content;
  return (
    <PortalWorkspaceShell maxWidth="max-w-none" contentClassName="px-4 py-4 sm:px-5 sm:py-5">
      {content}
    </PortalWorkspaceShell>
  );
}

// ── Account Section ──
function AccountSection({ email }: { email: string | null }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-5" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        <h3 className="mb-3 text-[11px] font-bold tracking-widest text-white/85 uppercase">Account Information</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/60">Email</span>
            <span className="text-[12px] text-white/85">{email ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/60">User ID</span>
            <span className="font-mono text-[10px] text-white/85">Authenticated</span>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border p-4" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        <h3 className="mb-2 text-[11px] font-bold tracking-widest text-white/85 uppercase">Build Info</h3>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/60">Build ID</span>
            <span className="font-mono text-[10px] text-white/85">{typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'unknown'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/60">Built</span>
            <span className="font-mono text-[10px] text-white/85">{typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : 'unknown'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/60">API</span>
            <span className="font-mono text-[10px] text-white/85">{import.meta.env.VITE_SUPABASE_URL ? 'production' : 'unknown'}</span>
          </div>
        </div>
      </div>
      <p className="px-1 text-[10px] text-white/50">Password and security controls are in the Password & Security tab.</p>
    </div>
  );
}

// ── Approved Background Gallery (simplified two-category) ──
function BackgroundGallery({
  title, assets, currentAssetId, onSelect, saving,
}: {
  title: string;
  assets: EnvironmentAsset[];
  currentAssetId: string | null;
  onSelect: (assetId: string | null) => void;
  saving: boolean;
}) {
  const [savedFlash, setSavedFlash] = useState(false);
  if (assets.length === 0) return null;
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: BORDER, background: DARK_PANEL }}>
      <div className="mb-3 flex items-center gap-2">
        <Monitor className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
        <h4 className="text-[10px] font-bold tracking-widest text-white/85 uppercase">{title}</h4>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        <button onClick={() => { onSelect(null); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200); }} disabled={saving}
          className="group relative aspect-video overflow-hidden rounded-lg border-2 transition-all hover:scale-[1.02] disabled:opacity-40"
          style={{ borderColor: currentAssetId === null ? GOLD : 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex h-full items-center justify-center">
            <span className="text-[9px] text-white/50">Default</span>
          </div>
          {currentAssetId === null && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5" style={{ color: GOLD }} />}
        </button>
        {assets.map((asset) => (
          <button key={asset.id} onClick={() => { onSelect(asset.id); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200); }} disabled={saving}
            className="group relative aspect-video overflow-hidden rounded-lg border-2 transition-all hover:scale-[1.02] disabled:opacity-40"
            style={{ borderColor: currentAssetId === asset.id ? GOLD : 'rgba(255,255,255,0.06)' }}>
            <div className="h-full w-full" style={{ backgroundImage: `url(${asset.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
              <span className="text-[8px] font-semibold text-white/90">{asset.name}</span>
            </div>
            {currentAssetId === asset.id && (
              <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: GOLD }}>
                <Check className="h-3 w-3 text-black" strokeWidth={3} />
              </div>
            )}
          </button>
        ))}
      </div>
      {savedFlash && (
        <div className="mt-2 flex items-center gap-1 text-[9px] text-emerald-400">
          <Check className="h-3 w-3" /> Background updated
        </div>
      )}
    </div>
  );
}

// ── Appearance & Backgrounds Section ──
function AppearanceSection({
  assetStore, backgrounds, setBackground, resetBackgrounds, saving, error, loading, onRetry, account,
}: {
  assetStore: ReturnType<typeof useEnvironmentAssets>;
  backgrounds: Record<string, string>;
  setBackground: (screen: string, assetId: string | null) => Promise<boolean>;
  resetBackgrounds: () => Promise<boolean>;
  saving: boolean;
  error: boolean;
  loading: boolean;
  onRetry: () => void;
  account?: SpotVaultAccount | null;
}) {
  const authorizedScreens = useMemo<AuthorizedScreen[]>(
    () => getUserAuthorizedScreens((portal) => account ? canAccessPortal(account, portal as any) : false),
    [account],
  );
  const [selectedScreen, setSelectedScreen] = useState<ScreenTarget>(
    authorizedScreens[0]?.id ?? 'PLAYER_MAIN',
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Group authorized screens by their group label for the optgroup dropdown
  const groupedScreens = useMemo(() => {
    const map = new Map<string, AuthorizedScreen[]>();
    for (const screen of authorizedScreens) {
      const list = map.get(screen.group) ?? [];
      list.push(screen);
      map.set(screen.group, list);
    }
    return Array.from(map.entries()).map(([group, screens]) => ({ group, screens }));
  }, [authorizedScreens]);

  const availableAssets: EnvironmentAsset[] = assetStore.assets.filter(
    (a) => a.allowedScreens.includes(selectedScreen) && a.src,
  );

  const currentAssetId = backgrounds[selectedScreen] ?? null;
  const currentAsset = assetStore.assets.find((a) => a.id === currentAssetId) ?? null;

  // Simplified two-category gallery: founder-approved backgrounds only
  const playerGalleryAssets = useMemo(() => getGalleryAssets(assetStore.assets, 'player'), [assetStore.assets]);
  const communityGalleryAssets = useMemo(() => getGalleryAssets(assetStore.assets, 'community'), [assetStore.assets]);
  const playerBackgroundId = backgrounds['PLAYER_MAIN'] ?? null;
  const communityBackgroundId = backgrounds['COMMUNITY'] ?? null;

  const handleGallerySelect = useCallback(async (destination: 'player' | 'community', assetId: string | null) => {
    const screen = destination === 'player' ? 'PLAYER_MAIN' : 'COMMUNITY';
    await setBackground(screen, assetId);
  }, [setBackground]);

  const handleSelect = useCallback(async (assetId: string | null) => {
    const ok = await setBackground(selectedScreen, assetId);
    if (ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    }
  }, [selectedScreen, setBackground]);

  const handleApplyToAll = useCallback(async () => {
    if (!currentAssetId) return;
    for (const screen of authorizedScreens) {
      await setBackground(screen.id, currentAssetId);
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }, [currentAssetId, setBackground, authorizedScreens]);

  const handleReset = useCallback(async () => {
    await resetBackgrounds();
    setShowResetConfirm(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }, [resetBackgrounds]);

  if (loading && !assetStore.ready) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-red-300">Unable to load background preferences.</p>
            <button onClick={onRetry} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-semibold tracking-widest text-white/60 uppercase hover:text-white">
              <RefreshCw className="mr-1 inline h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {/* Simplified two-category approved gallery */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <h3 className="text-[11px] font-bold tracking-widest text-white/85 uppercase">Approved Backgrounds</h3>
        </div>
        <p className="text-[10px] text-white/50">Pick from the founder-approved background library. Your selections are saved automatically.</p>
        <BackgroundGallery
          title="Player Portal"
          assets={playerGalleryAssets}
          currentAssetId={playerBackgroundId}
          onSelect={(id) => void handleGallerySelect('player', id)}
          saving={saving}
        />
        <BackgroundGallery
          title="Community"
          assets={communityGalleryAssets}
          currentAssetId={communityBackgroundId}
          onSelect={(id) => void handleGallerySelect('community', id)}
          saving={saving}
        />
      </div>

      <div className="rounded-2xl border p-5" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        <div className="mb-3 flex items-center gap-2">
          <Palette className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <h3 className="text-[11px] font-bold tracking-widest text-white/85 uppercase">Advanced: Per-Screen Backgrounds</h3>
        </div>
        <p className="mb-4 text-[10px] text-white/50">Choose a different background for each individual screen. Options come from the Staff Room asset library.</p>

        {/* Screen dropdown */}
        <div className="mb-4">
          <label className="mb-1.5 block text-[10px] font-semibold tracking-widest text-white/60 uppercase">Select Screen</label>
          <select
            value={selectedScreen}
            onChange={(e) => setSelectedScreen(e.target.value as ScreenTarget)}
            className="w-full max-w-xs rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2.5 text-[11px] text-white/85 outline-none"
          >
            {groupedScreens.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.screens.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#080706]">{s.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Current background preview */}
        <div className="mb-4 rounded-lg border border-white/[0.06] bg-black/30 p-3">
          <div className="mb-2 text-[9px] font-bold tracking-widest text-white/50 uppercase">Current Background</div>
          {currentAsset?.src ? (
            <div className="relative h-32 w-full overflow-hidden rounded-lg" style={{ backgroundImage: `url(${currentAsset.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <span className="text-[10px] font-semibold text-white/90">{currentAsset.name}</span>
              </div>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg bg-white/[0.02]">
              <span className="text-[10px] text-white/50">Default (no custom background)</span>
            </div>
          )}
        </div>

        {/* Available backgrounds grid */}
        <div className="mb-4">
          <div className="mb-2 text-[9px] font-bold tracking-widest text-white/50 uppercase">Choose Background</div>
          {availableAssets.length === 0 ? (
            <p className="text-[10px] text-white/50">No backgrounds are currently assigned to this screen in the Staff Room library.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {/* "Default" option */}
              <button onClick={() => handleSelect(null)}
                className="group relative aspect-video overflow-hidden rounded-lg border-2 transition-all hover:scale-[1.02]"
                style={{ borderColor: currentAssetId === null ? GOLD : 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="flex h-full items-center justify-center">
                  <span className="text-[9px] text-white/50">Default</span>
                </div>
                {currentAssetId === null && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5" style={{ color: GOLD }} />}
              </button>
              {availableAssets.map((asset) => (
                <button key={asset.id} onClick={() => handleSelect(asset.id)}
                  className="group relative aspect-video overflow-hidden rounded-lg border-2 transition-all hover:scale-[1.02]"
                  style={{ borderColor: currentAssetId === asset.id ? GOLD : 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full w-full" style={{ backgroundImage: `url(${asset.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                    <span className="text-[8px] font-semibold text-white/90">{asset.name}</span>
                  </div>
                  {currentAssetId === asset.id && (
                    <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: GOLD }}>
                      <Check className="h-3 w-3 text-black" strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleApplyToAll} disabled={!currentAssetId || saving}
            className="rounded-lg border px-3.5 py-2 text-[10px] font-semibold tracking-widest uppercase transition-colors disabled:opacity-40"
            style={{ borderColor: GOLD + '60', background: GOLD + '15', color: GOLD_SOFT }}>
            Apply to All Screens
          </button>
          <button onClick={() => setShowResetConfirm(true)} disabled={saving}
            className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-[10px] font-semibold tracking-widest text-white/85 uppercase hover:text-white">
            Reset All Backgrounds
          </button>
          {savedFlash && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Reset confirmation */}
      {showResetConfirm && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="mb-3 text-[11px] text-amber-300">Reset all screen backgrounds to defaults? This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={handleReset} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10px] font-semibold text-amber-300 uppercase">Yes, Reset</button>
            <button onClick={() => setShowResetConfirm(false)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-white/85 uppercase">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Portal Theme Section (StakeKings only) ──
function PortalThemeSection({
  currentTheme,
  onSave,
  saving,
  loading,
}: {
  currentTheme: PortalThemeId;
  onSave: (theme: PortalThemeId) => Promise<boolean>;
  saving: boolean;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<PortalThemeId>(currentTheme);
  const [savedFlash, setSavedFlash] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelected(currentTheme);
  }, [currentTheme]);

  const hasChanges = selected !== currentTheme;

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;
    setIsSaving(true);
    const ok = await onSave(selected);
    setIsSaving(false);
    if (ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-white/50" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-5" style={{ borderColor: BORDER, background: DARK_PANEL }}>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: GOLD }} strokeWidth={1.5} />
          <h3 className="text-[11px] font-bold tracking-widest text-white/85 uppercase">Portal Appearance</h3>
        </div>
        <p className="mb-5 text-[10px] text-white/50">
          Choose the accent theme for your StakeKings Player Development portal. This only affects the visual style — it does not change any functionality or data.
        </p>

        {/* Theme options */}
        <div className="space-y-2.5">
          {STAKEKINGS_THEME_OPTIONS.map((option) => {
            const isSelected = selected === option.id;
            const theme = getPortalTheme(option.id);
            return (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className="flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-all"
                style={{
                  borderColor: isSelected ? theme.accent + '60' : 'rgba(255,255,255,0.06)',
                  background: isSelected ? theme.accent + '0D' : 'rgba(255,255,255,0.02)',
                }}
              >
                {/* Radio indicator */}
                <div
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all"
                  style={{
                    borderColor: isSelected ? theme.accent : 'rgba(255,255,255,0.15)',
                    background: isSelected ? theme.accent : 'transparent',
                  }}
                >
                  {isSelected && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
                </div>
                {/* Theme preview swatches */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <div className="h-8 w-8 rounded-lg" style={{ background: theme.accent, boxShadow: `0 0 8px ${theme.glow}` }} />
                  <div className="h-8 w-4 rounded-lg" style={{ background: theme.accentSoft }} />
                  <div className="h-8 w-4 rounded-lg" style={{ background: theme.accentDark }} />
                </div>
                {/* Label + description */}
                <div className="flex-1">
                  <div className="text-[12px] font-semibold text-white/90">{option.label}</div>
                  <div className="text-[10px] text-white/50">{option.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Save button + confirmation */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving || saving}
            className="rounded-lg border px-5 py-2.5 text-[10px] font-bold tracking-widest uppercase transition-all disabled:opacity-40"
            style={{
              borderColor: hasChanges ? GOLD + '60' : 'rgba(255,255,255,0.10)',
              background: hasChanges ? GOLD + '15' : 'rgba(255,255,255,0.02)',
              color: hasChanges ? GOLD_SOFT : 'rgba(255,255,255,0.30)',
            }}
          >
            {isSaving ? <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" /> : null}
            Save Changes
          </button>
          {savedFlash && (
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <Check className="h-3 w-3" /> Theme saved.
            </span>
          )}
          {hasChanges && !savedFlash && (
            <span className="text-[10px] text-white/50">Press Save Changes to apply your selection.</span>
          )}
        </div>
      </div>
    </div>
  );
}


